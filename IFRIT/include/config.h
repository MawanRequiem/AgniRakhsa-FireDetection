#ifndef CONFIG_H
#define CONFIG_H

// --- WiFi Configuration ---
// Wokwi simulation uses the special "Wokwi-GUEST" network
const char *WIFI_SSID = "Wokwi-GUEST";
const char *WIFI_PASSWORD = "";

// --- Backend API Configuration ---
// In Wokwi with VS Code, host.wokwi.internal forwards to localhost
const char *API_BASE_URL = "http://20.198.89.199:8000/api/v1";

// --- Device Configuration ---
const char *DEVICE_NAME = "Ifrit Test";
const char *ROOM_NAME = "Wokwi Test Vps";

// --- Telemetry Configuration ---
const unsigned long TELEMETRY_INTERVAL_MS = 2000;  // Send readings every 2s
const unsigned long HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30s

// --- Sensor Configuration & Thresholds ---
// Note: These arrays must match in size and order.
const int NUM_SENSORS = 6;
const char *SENSOR_TYPES[NUM_SENSORS] = {
    "MQ2",        "MQ4",  "MQ6", "MQ9B",
    "SHTC3_TEMP", "FLAME"
    // "SHTC3_HUMIDITY" is omitted intentionally to keep demo simple, can be
    // added later
};

// Thresholds for triggering local alarm (LED + Buzzer)
// Values matched roughly to what mock_sensor_data.py uses for anomalies
const float ALARM_THRESHOLDS[NUM_SENSORS] = {
    600.0, // MQ2 (ppm)
    600.0, // MQ4 (ppm)
    600.0, // MQ6 (ppm)
    600.0, // MQ9B (ppm)
    45.0,  // TEMP (Celsius)
    2000.0 // FLAME (Raw ADC - lower is flame!) NOTE: Flame is pull-up, check
           // logic
};

#endif // CONFIG_H
