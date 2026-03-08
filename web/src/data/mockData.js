// ============================================
// AgniRaksha — Mock Data for Dashboard
// ============================================

export const ROOMS = [
  { id: 'R001', name: 'Server Room', floor: 'B1', status: 'safe', sensorStatus: 'online', lastUpdated: '2026-03-08T15:30:00' },
  { id: 'R002', name: 'Main Lobby', floor: '1F', status: 'safe', sensorStatus: 'online', lastUpdated: '2026-03-08T15:31:00' },
  { id: 'R003', name: 'Kitchen Area', floor: '2F', status: 'warning', sensorStatus: 'online', lastUpdated: '2026-03-08T15:29:00' },
  { id: 'R004', name: 'Warehouse A', floor: 'B1', status: 'safe', sensorStatus: 'online', lastUpdated: '2026-03-08T15:30:30' },
  { id: 'R005', name: 'Office Floor 3', floor: '3F', status: 'safe', sensorStatus: 'online', lastUpdated: '2026-03-08T15:31:15' },
  { id: 'R006', name: 'Electrical Room', floor: 'B1', status: 'fire', sensorStatus: 'online', lastUpdated: '2026-03-08T15:32:00' },
  { id: 'R007', name: 'Meeting Room A', floor: '2F', status: 'safe', sensorStatus: 'offline', lastUpdated: '2026-03-08T15:30:45' },
  { id: 'R008', name: 'Parking Garage', floor: 'B2', status: 'safe', sensorStatus: 'online', lastUpdated: '2026-03-08T15:31:30' },
];

export const SENSOR_TYPES = [
  { key: 'co', label: 'CO', unit: 'ppm', safeMax: 35, warnMax: 70 },
  { key: 'lpg', label: 'LPG', unit: 'ppm', safeMax: 1000, warnMax: 2000 },
  { key: 'cng', label: 'CNG', unit: 'ppm', safeMax: 500, warnMax: 1000 },
  { key: 'smoke', label: 'Smoke', unit: '%', safeMax: 10, warnMax: 30 },
  { key: 'flame', label: 'Flame', unit: 'IR', safeMax: 100, warnMax: 300 },
];

// Current sensor readings per room
export const SENSOR_READINGS = {
  R001: { co: 12, lpg: 180, cng: 90, smoke: 3, flame: 20 },
  R002: { co: 8, lpg: 120, cng: 60, smoke: 2, flame: 15 },
  R003: { co: 45, lpg: 800, cng: 420, smoke: 18, flame: 85 },
  R004: { co: 15, lpg: 200, cng: 110, smoke: 4, flame: 25 },
  R005: { co: 10, lpg: 150, cng: 75, smoke: 2, flame: 18 },
  R006: { co: 85, lpg: 2500, cng: 1200, smoke: 55, flame: 450 },
  R007: { co: 9, lpg: 100, cng: 55, smoke: 1, flame: 12 },
  R008: { co: 20, lpg: 350, cng: 180, smoke: 6, flame: 30 },
};

// Generate trend data (last 30 minutes, every 30s = 60 data points)
function generateTrendData(baseValues, roomStatus) {
  const data = [];
  const now = new Date('2026-03-08T15:32:00');
  const variance = roomStatus === 'fire' ? 0.3 : roomStatus === 'warning' ? 0.15 : 0.05;

  for (let i = 59; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 30000);
    const progress = (60 - i) / 60;
    const entry = {
      time: time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    for (const [key, base] of Object.entries(baseValues)) {
      const trend = roomStatus === 'fire' ? base * (0.3 + 0.7 * progress) :
                    roomStatus === 'warning' ? base * (0.7 + 0.3 * progress) : base;
      entry[key] = Math.round(trend * (1 + (Math.random() - 0.5) * variance));
    }
    data.push(entry);
  }
  return data;
}

export const SENSOR_TRENDS = {};
ROOMS.forEach(room => {
  SENSOR_TRENDS[room.id] = generateTrendData(SENSOR_READINGS[room.id], room.status);
});

// Alert history
export const ALERTS = [
  { id: 'A001', roomId: 'R006', severity: 'fire', message: 'Flame detected — IR level exceeds 400', timestamp: '2026-03-08T15:32:00', acknowledged: false },
  { id: 'A002', roomId: 'R006', severity: 'fire', message: 'Smoke concentration critical at 55%', timestamp: '2026-03-08T15:31:45', acknowledged: false },
  { id: 'A003', roomId: 'R003', severity: 'warning', message: 'CO level elevated to 45 ppm', timestamp: '2026-03-08T15:29:00', acknowledged: true },
  { id: 'A004', roomId: 'R006', severity: 'fire', message: 'LPG concentration exceeds safe limit', timestamp: '2026-03-08T15:31:30', acknowledged: false },
  { id: 'A005', roomId: 'R003', severity: 'warning', message: 'Smoke detected at 18%', timestamp: '2026-03-08T15:28:30', acknowledged: true },
  { id: 'A006', roomId: 'R008', severity: 'info', message: 'Sensor calibration completed', timestamp: '2026-03-08T14:00:00', acknowledged: true },
  { id: 'A007', roomId: 'R001', severity: 'info', message: 'Routine sensor check passed', timestamp: '2026-03-08T12:00:00', acknowledged: true },
  { id: 'A008', roomId: 'R004', severity: 'warning', message: 'Brief LPG spike detected (resolved)', timestamp: '2026-03-08T10:15:00', acknowledged: true },
  { id: 'A009', roomId: 'R005', severity: 'info', message: 'System restart completed', timestamp: '2026-03-08T08:00:00', acknowledged: true },
  { id: 'A010', roomId: 'R002', severity: 'info', message: 'New sensor node connected', timestamp: '2026-03-07T16:30:00', acknowledged: true },
  { id: 'A011', roomId: 'R007', severity: 'warning', message: 'Temperature anomaly detected', timestamp: '2026-03-07T14:20:00', acknowledged: true },
  { id: 'A012', roomId: 'R003', severity: 'warning', message: 'LPG above baseline for 5 minutes', timestamp: '2026-03-07T11:45:00', acknowledged: true },
];

// Camera feeds
export const CAMERAS = [
  { id: 'CAM01', roomId: 'R001', name: 'Server Room Cam', status: 'online', hasDetection: false },
  { id: 'CAM02', roomId: 'R002', name: 'Lobby Main Cam', status: 'online', hasDetection: false },
  { id: 'CAM03', roomId: 'R003', name: 'Kitchen Cam', status: 'online', hasDetection: true },
  { id: 'CAM04', roomId: 'R004', name: 'Warehouse Cam', status: 'online', hasDetection: false },
  { id: 'CAM05', roomId: 'R005', name: 'Office Floor 3 Cam', status: 'online', hasDetection: false },
  { id: 'CAM06', roomId: 'R006', name: 'Electrical Room Cam', status: 'online', hasDetection: true },
  { id: 'CAM07', roomId: 'R007', name: 'Meeting Room Cam', status: 'offline', hasDetection: false },
  { id: 'CAM08', roomId: 'R008', name: 'Parking Garage Cam', status: 'online', hasDetection: false },
];

// Notification contacts
export const CONTACTS = [
  { id: 'C001', name: 'Budi Santoso', phone: '+6281234567890', role: 'admin', active: true, lastNotified: '2026-03-08T15:32:00' },
  { id: 'C002', name: 'Siti Rahayu', phone: '+6289876543210', role: 'security', active: true, lastNotified: '2026-03-08T15:31:45' },
  { id: 'C003', name: 'Ahmad Fadli', phone: '+6285551234567', role: 'manager', active: true, lastNotified: '2026-03-07T14:20:00' },
  { id: 'C004', name: 'Dewi Lestari', phone: '+6282345678901', role: 'security', active: false, lastNotified: null },
  { id: 'C005', name: 'Riko Pratama', phone: '+6287654321098', role: 'admin', active: true, lastNotified: '2026-03-08T08:00:00' },
];

// System stats
export const SYSTEM_STATS = {
  totalRooms: ROOMS.length,
  activeSensors: ROOMS.length * SENSOR_TYPES.length,
  activeAlerts: ALERTS.filter(a => !a.acknowledged).length,
  systemUptime: 99.8,
  whatsappStatus: 'connected',
};
