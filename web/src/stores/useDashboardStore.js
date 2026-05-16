import { create } from 'zustand';
import { customFetch } from '@/lib/api';
import { useNotificationStore } from './useNotificationStore';

export const useDashboardStore = create((set, get) => ({
  summary: {
    totalDevices: 0,
    onlineDevices: 0,
    totalRooms: 0,
    activeAlerts: 0,
    highRiskRooms: 0,
  },
  recentAlerts: [],
  recentDetections: [],
  devices: [],
  sensorHistory: [],
  sensorHealth: null, // { total, summary, sensors: [] }
  isLoading: true,
  error: null,
  socket: null,
  isConnected: false,
  cameraFrames: {},
  latestReadings: {}, // { [deviceId]: { SHTC3_TEMP: 25.5, MQ9B: 400, ... } }

  fetchSensorHealth: async () => {
    try {
      const response = await customFetch('/api/v1/sensors/health?window_minutes=5');
      if (response.ok) {
        const data = await response.json();
        set({ sensorHealth: data });
      }
    } catch (error) {
      console.error('Failed to fetch sensor health', error);
    }
  },

  fetchSummary: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await customFetch('/api/v1/dashboard/summary');
      if (response.ok) {
        const data = await response.json();
        set({ summary: data, isLoading: false });
      } else {
        throw new Error('Failed to fetch dashboard summary');
      }
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchDevices: async () => {
    try {
      const response = await customFetch('/api/v1/devices/');
      if (response.ok) {
        const data = await response.json();
        set({ devices: data || [] });
      }
    } catch (error) {
      console.error('Failed to fetch devices', error);
    }
  },

  fetchRecentAlerts: async () => {
    try {
      const response = await customFetch('/api/v1/dashboard/alerts?page_size=10');
      if (response.ok) {
        const data = await response.json();
        set({ recentAlerts: data.items || [] });
      }
    } catch (error) {
      console.error('Failed to fetch recent alerts', error);
    }
  },

  fetchSensorHistory: async (deviceId) => {
    try {
      const params = new URLSearchParams({ minutes: '30' });
      if (deviceId && deviceId !== 'ALL') {
        params.set('device_id', deviceId);
      }
      const response = await customFetch(`/api/v1/sensors/history?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        set({ sensorHistory: data || [] });
      }
    } catch (error) {
      console.error('Failed to fetch sensor history', error);
    }
  },

  // Initialize WebSocket connection
  connectWebSocket: () => {
    const { socket } = get();
    if (socket?.readyState === WebSocket.OPEN) return;

    // Use same-origin host behind reverse proxy; only add port in localhost dev
    const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = globalThis.location.hostname === 'localhost'
      ? 'localhost:8000'
      : globalThis.location.host; // host includes port if non-standard, otherwise just hostname
    const wsUrl = `${protocol}//${host}/api/v1/dashboard/ws`;

    const newSocket = new WebSocket(wsUrl);

    newSocket.onopen = () => {
      set({ isConnected: true, socket: newSocket });
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'NEW_ALERT') {
          // Prepend new alert and update summary count
          set((state) => ({
            recentAlerts: [message.data, ...state.recentAlerts].slice(0, 10),
            summary: {
              ...state.summary,
              activeAlerts: state.summary.activeAlerts + 1,
              highRiskRooms: message.data.severity === 'critical' 
                ? state.summary.highRiskRooms + 1 
                : state.summary.highRiskRooms,
            },
          }));
        }
        
        if (message.type === 'SENSOR_UPDATE') {
          const { device_id, readings, timestamp } = message.data || {};
          if (!readings || readings.length === 0) return;

          const newPoint = { time: timestamp };
          const deviceReadings = {};

          for (const r of readings) {
            newPoint[r.sensor_type] = r.value;
            deviceReadings[r.sensor_type] = r.value;
          }

          set((state) => {
            // Merge with existing device readings
            const updatedLatest = {
              ...state.latestReadings,
              [device_id]: {
                ...(state.latestReadings[device_id] || {}),
                ...deviceReadings,
                _lastUpdate: timestamp
              }
            };

            return {
              sensorHistory: [...state.sensorHistory, newPoint].slice(-180),
              latestReadings: updatedLatest,
            };
          });
        }

        if (message.type === 'SENSOR_BATCH_UPDATE') {
          const { devices } = message.data || {};
          if (!devices || Object.keys(devices).length === 0) return;

          set((state) => {
            const updatedLatest = { ...state.latestReadings };
            const newPoints = [];

            for (const [device_id, devData] of Object.entries(devices)) {
              const { readings, timestamp } = devData;
              if (!readings || readings.length === 0) continue;

              const deviceReadings = {};
              const historyPoint = { time: timestamp, device_id };

              for (const r of readings) {
                deviceReadings[r.sensor_type] = r.value;
                historyPoint[r.sensor_type] = r.value;
              }

              // Update latestReadings for this device
              updatedLatest[device_id] = {
                ...(updatedLatest[device_id] || {}),
                ...deviceReadings,
                _lastUpdate: timestamp
              };

              newPoints.push(historyPoint);
            }

            return {
              sensorHistory: [...state.sensorHistory, ...newPoints].slice(-180),
              latestReadings: updatedLatest,
            };
          });
        }

        if (message.type === 'DEVICE_STATUS_CHANGE') {
          const { device_id, status } = message.data;
          set((state) => {
            // Update the device in the devices array
            const updatedDevices = state.devices.map((d) =>
              d.id === device_id ? { ...d, status } : d
            );
            
            // Recalculate online count
            const onlineCount = updatedDevices.filter((d) => d.status === 'online' || d.status === 'calibrating').length;
            
            return {
              devices: updatedDevices,
              summary: {
                ...state.summary,
                onlineDevices: onlineCount,
              },
            };
          });
        }
        
        if (message.type === 'DETECTION_FRAME') {
          set((state) => ({
             // Store the latest frame payload by camera_id
             cameraFrames: {
                ...(state.cameraFrames || {}),
                [message.data.camera_id]: message.data
             }
          }));
        }

        // Route FIRE_ALERT events to the notification store for toast + sound
        if (message.type === 'FIRE_ALERT') {
          useNotificationStore.getState().addNotification(message.data);
        }
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    newSocket.onclose = () => {
      set({ isConnected: false, socket: null });
      // Reconnect logic
      setTimeout(() => {
        get().connectWebSocket();
      }, 5000);
    };

    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      newSocket.close();
    };
  },

  disconnectWebSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false });
    }
  },
}));
