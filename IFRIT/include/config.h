#ifndef CONFIG_H
#define CONFIG_H

// --- Firmware Version ---
#define FIRMWARE_VERSION "3.0.0-ADAPTIVE-CAL"

// --- WiFi Configuration ---
const char *WIFI_SSID = "Wokwi-GUEST";
const char *WIFI_PASSWORD = "";

// --- Backend API Configuration ---
const char *API_BASE_URL = "http://20.198.89.199:8000/api/v1";

// --- Device Configuration ---
const char *DEVICE_NAME = "Ifrit Test";
const char *ROOM_NAME = "Wokwi Test Vps";

// --- Telemetry Configuration ---
const unsigned long TELEMETRY_INTERVAL_MS = 2000;  // Send readings every 2s
const unsigned long HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30s

// --- Sensor Configuration & Thresholds ---
const int NUM_SENSORS = 6;
const char *SENSOR_TYPES[NUM_SENSORS] = {
    "MQ2", "MQ4", "MQ6", "MQ9B",
    "SHTC3_TEMP", "FLAME"
};

// Thresholds for triggering local alarm (LED + Buzzer)
const float ALARM_THRESHOLDS[NUM_SENSORS] = {
    600.0, // MQ2 (ppm)
    600.0, // MQ4 (ppm)
    600.0, // MQ6 (ppm)
    600.0, // MQ9B (ppm)
    45.0,  // TEMP (Celsius)
    2000.0 // FLAME (Raw ADC - lower is flame!)
};

// =============================================================================
// MQ SENSOR CALIBRATION CONSTANTS (from MQUnifiedsensor library + datasheets)
// =============================================================================

// Number of MQ gas sensors (subset of NUM_SENSORS)
#define NUM_MQ_SENSORS 4

// Load Resistance on the MQ module (in kΩ). Check the SMD resistor on your board.
// Most common: 10kΩ (marked "103"). Change if yours is different.
const float RL_VALUE = 10.0;

// Supply voltage feeding the MQ sensor heater circuit.
// Your module outputs 0-5V analog, so Vc = 5.0
const float VC_VALUE = 5.0;

// Clean Air Ratio (Rs/R0 in clean air) — from each sensor's datasheet
// Order: MQ2, MQ4, MQ6, MQ9
const float CLEAN_AIR_RATIO[NUM_MQ_SENSORS] = {9.83, 4.4, 10.0, 9.9};

// Exponential Regression: PPM = A × (Rs/R0)^B
// Source: MQUnifiedsensor library (extracted from official datasheets via WebPlotDigitizer)
// Order: MQ2(LPG), MQ4(CH4), MQ6(LPG), MQ9(CO)
const float PARAM_A[NUM_MQ_SENSORS] = {574.25, 1012.7, 1009.2, 599.65};
const float PARAM_B[NUM_MQ_SENSORS] = {-2.222, -2.786, -2.35, -2.244};

// --- Calibration Tuning ---
#define CALIBRATION_SAMPLES    50    // Number of ADC samples to average
#define CALIBRATION_DELAY_MS   200   // Delay between samples (total = 50*200 = 10s)
#define R0_MIN_VALID           0.1   // Min valid R0 (kΩ)
#define R0_MAX_VALID           100.0 // Max valid R0 (kΩ)
#define WARMUP_TIME_MS         300000// 5 minutes (300,000 ms) warm-up for heater stabilization
#define BURNIN_TIME_MS         86400000// 24 hours (86,400,000 ms) for new sensor burn-in

#endif // CONFIG_H
