import { create } from 'zustand';
import { customFetch } from '@/lib/api';

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

    // Use absolute URL based on window location but change protocol to ws/wss
    const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = globalThis.location.hostname === 'localhost' ? 'localhost:8000' : globalThis.location.host;
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

        if (message.type === 'DEVICE_STATUS_CHANGE') {
          const { device_id, status } = message.data;
          set((state) => {
            // Update the device in the devices array
            const updatedDevices = state.devices.map((d) =>
              d.id === device_id ? { ...d, status } : d
            );
            
            // Recalculate online count
            const onlineCount = updatedDevices.filter((d) => d.status === 'online').length;
            
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
