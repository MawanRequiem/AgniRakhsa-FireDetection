/**
 * AgniRakhsa IFRIT - Camera Pin Definitions
 * Board: ESP32-S3-DevKitC-1 with OV2640 Camera Module
 *
 * Standard ESP32-S3 CAM pinout for OV2640
 * NOTE: Camera is NOT simulatable in Wokwi.
 *       These pins are reserved for camera and should not be used for sensors.
 */

// =============================================================================
// Sensor Pin Mapping (used in Wokwi diagram)
// =============================================================================

// Gas Sensors (Analog - ADC)
#define MQ2_PIN 34
#define MQ4_PIN 35
#define MQ6_PIN 32
#define MQ9_PIN 33
#define FLAME_PIN 19
#define LDR_PIN 25

// --- Firmware Version ---
#define FIRMWARE_VERSION "3.0.0-ADAPTIVE-CAL"

// --- WiFi Configuration ---
const char *WIFI_SSID = "MaOne_Cisco";
const char *WIFI_PASSWORD = "networkasik";

// --- Backend API Configuration ---
const char *API_BASE_URL = "https://ifrit.space/api/v1";

// --- Device Configuration ---
const char *DEVICE_NAME = "Demo Hari Selasa";
const char *ROOM_NAME = "Ruang Raka Herdika";

// --- Telemetry Configuration ---
const unsigned long TELEMETRY_INTERVAL_MS = 2000;  // Send readings every 2s
const unsigned long HEARTBEAT_INTERVAL_MS = 30000; // Send heartbeat every 30s

// --- Sensor Configuration & Thresholds ---
const int NUM_SENSORS = 8;
const char *SENSOR_TYPES[NUM_SENSORS] = {"MQ2",       "MQ4",      "MQ6",  "MQ9",
                                         "SHTC_TEMP", "SHTC_HUM", "FLAME", "LDR"};

// Thresholds for triggering local alarm
const float ALARM_THRESHOLDS[NUM_SENSORS] = {
    600.0, // MQ2 (ppm)
    600.0, // MQ4 (ppm)
    600.0, // MQ6 (ppm)
    600.0, // MQ9 (ppm)
    45.0,  // TEMP (Celsius)
    100.0, // HUMIDITY (%)
    0.5,   // FLAME (Digital: 0 is fire)
    4095.0 // LDR (raw light, will not trigger local alarm)
};

// =============================================================================
// MQ SENSOR CALIBRATION CONSTANTS (from MQUnifiedsensor library + datasheets)
// =============================================================================

// Number of MQ gas sensors (subset of NUM_SENSORS)
#define NUM_MQ_SENSORS 4

// Load Resistance on the MQ module (in kΩ). Check the SMD resistor on your
// board. Most common: 10kΩ (marked "103"). Change if yours is different.
const float RL_VALUE = 10.0;

// Supply voltage feeding the MQ sensor heater circuit.
// Your module outputs 0-5V analog, so Vc = 5.0
const float VC_VALUE = 5.0;

// Clean Air Ratio (Rs/R0 in clean air) — from each sensor's datasheet
// Order: MQ2, MQ4, MQ6, MQ9
const float CLEAN_AIR_RATIO[NUM_MQ_SENSORS] = {9.83, 4.4, 10.0, 9.9};

// Exponential Regression: PPM = A × (Rs/R0)^B
// Source: MQUnifiedsensor library (extracted from official datasheets via
// WebPlotDigitizer) Order: MQ2(LPG), MQ4(CH4), MQ6(LPG), MQ9(CO)
const float PARAM_A[NUM_MQ_SENSORS] = {574.25, 1012.7, 1009.2, 599.65};
const float PARAM_B[NUM_MQ_SENSORS] = {-2.222, -2.786, -2.35, -2.244};

// --- Calibration Tuning ---
#define CALIBRATION_SAMPLES 900   // Number of ADC samples to average (900 samples * 1000ms = 15 minutes)
#define CALIBRATION_DELAY_MS 1000 // Delay between samples (1 second)
#define R0_MIN_VALID 0.1         // Min valid R0 (kΩ)
#define R0_MAX_VALID 100.0       // Max valid R0 (kΩ)
#define WARMUP_TIME_MS                                                         \
  300000 // 5 minutes (300,000 ms) warm-up for heater stabilization
#define BURNIN_TIME_MS                                                         \
  86400000 // 24 hours (86,400,000 ms) for new sensor burn-in

/**
 * AgniRakhsa IFRIT — Firmware v3.0 (3-Layer Adaptive Calibration)
 *
 * Layer 1: NVS Persistent Storage  — R0 survives reboot
 * Layer 2: Server-Managed           — Backend stores R0 per device, admin can
 * trigger recalibrate Layer 3: Runtime Env Compensation — Real-time PPM with
 * correct exponential regression
 *
 * PPM Formula: PPM = A × (Rs / R0)^B  (Exponential Regression from datasheet)
 *
 * Sensor lineup:
 *   MQ-2  → LPG / Smoke
 *   MQ-4  → CH4 (Methane)
 *   MQ-6  → LPG
 *   MQ-9  → CO (Carbon Monoxide)
 *   SHTC3 → Temperature (simulated as DHT22 in Wokwi)
 *   FLAME → IR Flame Sensor (analog, lower = fire detected)
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// Wokwi uses DHT22 to simulate SHTC3
#include "Adafruit_SHTC3.h"
#include <Wire.h>

// =============================================================================
// GLOBAL STATE
// =============================================================================

Adafruit_SHTC3 shtc3 = Adafruit_SHTC3();
Preferences prefs;

String deviceId = "";
String sensorUuids[NUM_SENSORS];

unsigned long lastTelemetryTime = 0;
unsigned long lastHeartbeatTime = 0;

// R0 values (calibrated baseline resistance in clean air, per MQ sensor)
float R0_VALUES[NUM_MQ_SENSORS] = {10.0, 10.0, 10.0, 10.0};
bool isCalibrated = false;
bool pendingAutoCalibration = false;

// Standalone cumulative operating minutes & burn-in flag
unsigned long cumulativeMins = 0;
bool burninDone = false;

// MQ sensor ADC pins in order: MQ2, MQ4, MQ6, MQ9
const int MQ_PINS[NUM_MQ_SENSORS] = {MQ2_PIN, MQ4_PIN, MQ6_PIN, MQ9_PIN};

// =============================================================================
// LAYER 1: NVS PERSISTENT STORAGE
// =============================================================================

/**
 * Load saved R0 values from ESP32 NVS flash.
 * Returns true if valid calibration data was found.
 */
bool loadCalibrationFromNVS() {
  prefs.begin("agni_cal", true); // Read-only mode
  isCalibrated = prefs.getBool("calibrated", false);

  if (isCalibrated) {
    R0_VALUES[0] = prefs.getFloat("R0_MQ2", 10.0);
    R0_VALUES[1] = prefs.getFloat("R0_MQ4", 10.0);
    R0_VALUES[2] = prefs.getFloat("R0_MQ6", 10.0);
    R0_VALUES[3] = prefs.getFloat("R0_MQ9", 10.0);

    Serial.println("[NVS] Calibration loaded:");
    const char *mqNames[] = {"MQ2", "MQ4", "MQ6", "MQ9"};
    for (int i = 0; i < NUM_MQ_SENSORS; i++) {
      Serial.printf("  %s R0 = %.4f kOhm\n", mqNames[i], R0_VALUES[i]);
    }
  } else {
    Serial.println("[NVS] No calibration data found.");
  }

  prefs.end();
  return isCalibrated;
}

/**
 * Save R0 values to NVS flash after successful calibration.
 * Data persists across reboots and firmware updates.
 */
void saveCalibrationToNVS() {
  prefs.begin("agni_cal", false); // Read-write mode
  prefs.putFloat("R0_MQ2", R0_VALUES[0]);
  prefs.putFloat("R0_MQ4", R0_VALUES[1]);
  prefs.putFloat("R0_MQ6", R0_VALUES[2]);
  prefs.putFloat("R0_MQ9", R0_VALUES[3]);
  prefs.putBool("calibrated", true);
  prefs.putULong("cal_time", millis() / 1000);
  prefs.end();

  isCalibrated = true;
  Serial.println("[NVS] Calibration saved to flash!");
}

// =============================================================================
// LAYER 3: RUNTIME CALIBRATION & PPM CONVERSION
// =============================================================================

/**
 * Calculate sensor resistance (Rs) from raw ADC value.
 * Uses voltage divider formula: Rs = RL × (Vc - Vout) / Vout
 *
 * @param rawADC  Raw 12-bit ADC reading (0-4095)
 * @return Rs in kΩ, or -1.0 if invalid
 */
float calculateRs(int rawADC) {
  if (rawADC <= 10)
    return -1.0; // Noise floor guard

  float Vout = rawADC * (3.3 / 4095.0); // ESP32 ADC reference is always 3.3V
  if (Vout < 0.01)
    return -1.0;

  // Voltage divider: Rs = RL × (Vc - Vout) / Vout
  // Vc = 5.0V (sensor supply voltage — the module outputs 0-5V range)
  // BUT: ESP32 ADC reads max 3.3V, so if raw reading hits 4095 the output
  // was ≥3.3V. The math still works because we know the circuit topology.
  float Rs = RL_VALUE * (VC_VALUE - Vout) / Vout;
  return Rs;
}

/**
 * Auto-calibrate R0 in clean air.
 *
 * Takes CALIBRATION_SAMPLES readings over ~10 seconds, averages Rs for each
 * sensor, then divides by the clean air ratio from the datasheet.
 *
 * IMPORTANT: Run this in clean/fresh air with sensors warmed up (24-48h for new
 * sensors).
 *
 * @return true if all sensors calibrated successfully
 */
bool calibrateSensors() {
  Serial.println("\n========================================");
  Serial.println("  AUTO-CALIBRATION STARTING");
  Serial.println("  Ensure sensors are in CLEAN AIR!");
  Serial.println("========================================");

  if (millis() < WARMUP_TIME_MS) {
    Serial.printf(
        "  [WARN] Sensors warming up (%.1f / 5.0 mins). Accuracy may vary.\n",
        millis() / 60000.0);
  }

  // --- Start Calibration Feedback ---
  // 1 Short beep to indicate calibration started
  delay(200);
  float rsSum[NUM_MQ_SENSORS] = {0};
  int validSamples[NUM_MQ_SENSORS] = {0};

  for (int s = 0; s < CALIBRATION_SAMPLES; s++) {
    for (int i = 0; i < NUM_MQ_SENSORS; i++) {
      float rs = calculateRs(analogRead(MQ_PINS[i]));
      if (rs > 0) {
        rsSum[i] += rs;
        validSamples[i]++;
      }
    }

    // Blink LED briefly to indicate active sampling
    delay(50);
    delay(CALIBRATION_DELAY_MS - 50);

    // Progress indicator every 10 samples
    if ((s + 1) % 10 == 0) {
      Serial.printf("  Progress: %d/%d samples\n", s + 1, CALIBRATION_SAMPLES);
    }
  }

  // Calculate R0 = avg(Rs) / CleanAirRatio
  const char *mqNames[] = {"MQ2", "MQ4", "MQ6", "MQ9"};
  bool allValid = true;

  for (int i = 0; i < NUM_MQ_SENSORS; i++) {
    if (validSamples[i] < 10) {
      Serial.printf("  [FAIL] %s: only %d valid samples (need >=10)\n",
                    mqNames[i], validSamples[i]);
      allValid = false;
      continue;
    }

    float avgRs = rsSum[i] / validSamples[i];
    float newR0 = avgRs / CLEAN_AIR_RATIO[i];

    // Sanity check: R0 must be in a reasonable range
    if (isnan(newR0) || isinf(newR0) || newR0 < R0_MIN_VALID ||
        newR0 > R0_MAX_VALID) {
      Serial.printf("  [FAIL] %s: R0=%.4f out of range [%.1f, %.1f]\n",
                    mqNames[i], newR0, R0_MIN_VALID, R0_MAX_VALID);
      allValid = false;
      continue;
    }

    R0_VALUES[i] = newR0;
    Serial.printf("  [ OK ] %s: R0 = %.4f kOhm (%d samples, avgRs=%.2f)\n",
                  mqNames[i], newR0, validSamples[i], avgRs);
  }

  if (allValid) {
    saveCalibrationToNVS();
    Serial.println("========================================");
    Serial.println("  CALIBRATION COMPLETE — saved to NVS");
    Serial.println("========================================\n");

    // --- Success Feedback ---
    // 2 Short beeps
    for (int b = 0; b < 2; b++) {
      delay(150);
      delay(150);
    }
  } else {
    Serial.println("========================================");
    Serial.println("  CALIBRATION PARTIAL FAILURE");
    Serial.println("  Some sensors may use default R0");
    Serial.println("========================================\n");

    // --- Failure Feedback ---
    // 1 Long beep
    delay(1000);
  }

  return allValid;
}

/**
 * Convert raw ADC reading to gas concentration in PPM.
 * Uses exponential regression: PPM = A × (Rs/R0)^B
 *
 * @param rawADC       Raw 12-bit ADC reading (0-4095)
 * @param sensorIndex  Index into PARAM_A/B and R0_VALUES arrays (0-3)
 * @return Estimated gas concentration in PPM, clamped to [0, 10000]
 */
float calculatePPM(int rawADC, int sensorIndex) {
  if (sensorIndex < 0 || sensorIndex >= NUM_MQ_SENSORS)
    return 0.0;

  float rs = calculateRs(rawADC);
  if (rs < 0)
    return 0.0;

  float ratio = rs / R0_VALUES[sensorIndex];

  // Power regression: PPM = A × ratio^B
  float ppm = PARAM_A[sensorIndex] * pow(ratio, PARAM_B[sensorIndex]);

  // Clamp to sensor's practical range
  if (ppm < 0)
    ppm = 0;
  if (ppm > 10000)
    ppm = 10000;

  return ppm;
}

// =============================================================================
// NETWORKING
// =============================================================================

/** Connect to WiFi, blocking until successful. */
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());
}

#include <WiFiClient.h>

void beginHttp(HTTPClient &http, WiFiClientSecure &secureClient, WiFiClient &plainClient, const String &url) {
  if (url.startsWith("https://")) {
    secureClient.setInsecure();
    http.begin(secureClient, url);
  } else {
    http.begin(plainClient, url);
  }
  http.setTimeout(15000); // 15 seconds timeout
  http.addHeader("User-Agent", "ESP32-AgniRakhsa-MCU"); // Avoid being flagged or stalled by Cloudflare WAF/Shield
}

/** Provision device with backend — get device_id and sensor UUIDs. */
bool provisionDevice() {
  Serial.println("[PROVISION] Registering with backend...");

  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/devices/provision";
  beginHttp(http, secureClient, plainClient, url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["name"] = DEVICE_NAME;
  doc["mac_address"] = WiFi.macAddress();
  doc["room_name"] = ROOM_NAME;

  JsonArray types = doc["sensor_types"].to<JsonArray>();
  for (int i = 0; i < NUM_SENSORS; i++) {
    types.add(SENSOR_TYPES[i]);
  }

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode > 0 && (httpCode == HTTP_CODE_OK || httpCode == 201)) {
    String response = http.getString();
    JsonDocument respDoc;
    DeserializationError error = deserializeJson(respDoc, response);

    if (!error) {
      deviceId = respDoc["device_id"].as<String>();
      Serial.println("[PROVISION] Device UUID: " + deviceId);

      for (int i = 0; i < NUM_SENSORS; i++) {
        sensorUuids[i] = respDoc["sensors"][SENSOR_TYPES[i]].as<String>();
        Serial.println("  " + String(SENSOR_TYPES[i]) + " → " + sensorUuids[i]);
      }

      http.end();
      return true;
    } else {
      Serial.println("[PROVISION] JSON parse error");
    }
  } else {
    Serial.println("[PROVISION] HTTP error: " + String(httpCode));
    if (httpCode > 0)
      Serial.println("  Body: " + http.getString());
  }

  http.end();
  return false;
}

// =============================================================================
// LAYER 2: SERVER-MANAGED CALIBRATION
// =============================================================================

/**
 * Upload current R0 calibration data to backend for tracking and audit.
 * Called after calibration and on boot.
 */
void sendCalibrationToServer() {
  if (deviceId == "")
    return;

  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/calibration/" + deviceId;
  beginHttp(http, secureClient, plainClient, url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["calibrated"] = isCalibrated;
  doc["r0_mq2"] = R0_VALUES[0];
  doc["r0_mq4"] = R0_VALUES[1];
  doc["r0_mq6"] = R0_VALUES[2];
  doc["r0_mq9"] = R0_VALUES[3];
  doc["firmware_version"] = FIRMWARE_VERSION;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode > 0 && httpCode < 400) {
    Serial.println("[CAL→SERVER] Calibration data uploaded OK");
  } else {
    Serial.println("[CAL→SERVER] Upload failed: " + String(httpCode));
  }

  http.end();
}

/**
 * Poll backend for pending commands (e.g., RECALIBRATE).
 * Called during heartbeat cycle.
 */
void checkRemoteCalibrationCommand() {
  if (deviceId == "")
    return;

  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/calibration/" + deviceId + "/commands";
  beginHttp(http, secureClient, plainClient, url);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err && doc.containsKey("command")) {
      String command = doc["command"].as<String>();
      String commandId = doc["command_id"].as<String>();

      if (command == "RECALIBRATE") {
        Serial.println("\n[REMOTE] Server requested RECALIBRATE!");

        WiFiClientSecure secureAckClient;
        WiFiClient plainAckClient;
        HTTPClient ackHttp;
        String ackUrl = String(API_BASE_URL) + "/calibration/" + deviceId +
                        "/commands/" + commandId + "/ack";

        // Acknowledge command in progress
        beginHttp(ackHttp, secureAckClient, plainAckClient, ackUrl);
        ackHttp.addHeader("Content-Type", "application/json");
        ackHttp.POST("{\"status\":\"in_progress\"}");
        ackHttp.end();

        // Run calibration
        bool success = calibrateSensors();

        if (success) {
          // Report results back
          sendCalibrationToServer();

          // Acknowledge command completion
          beginHttp(ackHttp, secureAckClient, plainAckClient, ackUrl);
          ackHttp.addHeader("Content-Type", "application/json");
          ackHttp.POST("{\"status\":\"completed\"}");
          ackHttp.end();

          Serial.println(
              "[REMOTE] Recalibration complete, ACK completed sent.");
        } else {
          // Acknowledge command failure
          beginHttp(ackHttp, secureAckClient, plainAckClient, ackUrl);
          ackHttp.addHeader("Content-Type", "application/json");
          ackHttp.POST("{\"status\":\"failed\"}");
          ackHttp.end();

          Serial.println("[REMOTE] Recalibration failed, ACK failed sent.");
        }
      } else if (command == "REBURNIN") {
        Serial.println("\n[REMOTE] Server requested REBURNIN!");

        WiFiClientSecure secureAckClient;
        WiFiClient plainAckClient;
        HTTPClient ackHttp;
        String ackUrl = String(API_BASE_URL) + "/calibration/" + deviceId +
                        "/commands/" + commandId + "/ack";

        // Acknowledge command in progress
        beginHttp(ackHttp, secureAckClient, plainAckClient, ackUrl);
        ackHttp.addHeader("Content-Type", "application/json");
        ackHttp.POST("{\"status\":\"in_progress\"}");
        ackHttp.end();

        // Perform re-burnin NVS and memory reset
        prefs.begin("ifrit_time", false); // read-write
        prefs.putBool("burnin_done", false);
        prefs.putULong("cum_mins", 0);
        prefs.end();

        prefs.begin("agni_cal", false); // read-write
        prefs.clear();
        prefs.end();

        isCalibrated = false;
        cumulativeMins = 0;
        burninDone = false;

        // Acknowledge command completion
        beginHttp(ackHttp, secureAckClient, plainAckClient, ackUrl);
        ackHttp.addHeader("Content-Type", "application/json");
        ackHttp.POST("{\"status\":\"completed\"}");
        ackHttp.end();

        Serial.println("[REMOTE] Re-burnin initiated. Restarting device...");
        delay(1500);
        ESP.restart();
      }
    }
  }

  http.end();
}

/** Send periodic heartbeat to backend. */
void sendHeartbeat() {
  if (deviceId == "")
    return;

  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/devices/" + deviceId + "/heartbeat";
  beginHttp(http, secureClient, plainClient, url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["uptime_seconds"] = millis() / 1000;
  if (!burninDone || pendingAutoCalibration) {
    if (millis() < WARMUP_TIME_MS) {
      doc["status"] = "warming_up";
    } else if (!burninDone) {
      doc["status"] = "burn_in";
    }
  }

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode <= 0 || httpCode >= 400) {
    Serial.println("[HEARTBEAT] Failed: " + String(httpCode));
  }

  http.end();

  // Check for remote commands during heartbeat cycle
  checkRemoteCalibrationCommand();
}

/** Download latest calibration from the server (Plug & Play) */
bool downloadCalibrationFromServer() {
  if (deviceId == "")
    return false;

  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  HTTPClient http;
  String url = String(API_BASE_URL) + "/calibration/" + deviceId + "/latest";
  beginHttp(http, secureClient, plainClient, url);
  int httpCode = http.GET();

  bool success = false;
  if (httpCode == 200) {
    String response = http.getString();
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err && doc.containsKey("r0_mq2") && !doc["r0_mq2"].isNull()) {
      R0_VALUES[0] = doc["r0_mq2"].as<float>();
      R0_VALUES[1] = doc["r0_mq4"].as<float>();
      R0_VALUES[2] = doc["r0_mq6"].as<float>();
      R0_VALUES[3] = doc["r0_mq9"].as<float>();

      Serial.println("[SERVER] Downloaded calibration data:");
      Serial.printf("  MQ2: %.4f | MQ4: %.4f | MQ6: %.4f | MQ9: %.4f\n",
                    R0_VALUES[0], R0_VALUES[1], R0_VALUES[2], R0_VALUES[3]);

      saveCalibrationToNVS();
      success = true;
    } else {
      Serial.println("[SERVER] No valid calibration data on server.");
    }
  } else {
    Serial.println("[SERVER] Failed to download calibration: " +
                   String(httpCode));
  }

  http.end();
  return success;
}

// =============================================================================
// ARDUINO SETUP & LOOP
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=============================================");
  Serial.println("  AgniRakhsa IFRIT " FIRMWARE_VERSION);
  Serial.println("  3-Layer Adaptive Calibration System");
  Serial.println("=============================================\n");

  pinMode(FLAME_PIN, INPUT);
  pinMode(LDR_PIN, INPUT);

  // Inisialisasi SHTC3 via I2C
  if (!shtc3.begin()) {
    Serial.println("Warning: SHTC3 tidak terdeteksi! Cek kabel SDA/SCL.");
  } else {
    Serial.println("SHTC3 OK!");
  }

  // ADC setup (ESP32 12-bit: 0-4095)
  analogReadResolution(12);

  // ─── LAYER 1: Try loading calibration from NVS ───
  Serial.println("[BOOT] Step 1: Loading calibration from NVS...");

  // Read cumulative operating minutes and burnin done flag
  prefs.begin("ifrit_time", true); // read-only
  cumulativeMins = prefs.getULong("cum_mins", 0);
  burninDone = prefs.getBool("burnin_done", false);
  prefs.end();
  Serial.printf("[BOOT] Cumulative Operating Time loaded: %lu minutes / 1440\n",
                cumulativeMins);

  if (burninDone) {
    Serial.println(
        "[BOOT] Cumulative 24h burn-in period has been COMPLETED previously.");
    if (loadCalibrationFromNVS()) {
      Serial.println("[BOOT] Using saved calibration data.");
      pendingAutoCalibration = false;
    } else {
      // Burn-in is completed but no R0 found in NVS -> schedule a 5-min warm-up calibration
      Serial.println("[BOOT] No saved calibration. Device will use default R0.");
      Serial.printf("[BOOT] Auto-calibration scheduled after %d ms warm-up.\n",
                    WARMUP_TIME_MS);
      Serial.println("[BOOT] (Ensure sensors are in CLEAN AIR and warmed up!)");
      pendingAutoCalibration = true;
    }
  } else {
    Serial.println("[BOOT] Brand new sensor detected. Device is in 24-Hour BURN-IN phase.");
    Serial.println("[BOOT] Normal 5-minute warm-up calibration is bypassed during burn-in.");
    Serial.println("[BOOT] Final calibration will be triggered automatically after 24 hours (1440 mins).");
    pendingAutoCalibration = false;
  }

  // ─── Connect to network ───
  Serial.println("\n[BOOT] Step 2: Connecting to WiFi...");
  connectWiFi();

  // ─── Provision with backend ───
  Serial.println("\n[BOOT] Step 3: Provisioning device...");
  while (!provisionDevice()) {
    Serial.println("  Retrying in 5 seconds...");
    delay(5000);
  }

  // ─── NEW: LAYER 2.5: Download Calibration ───
  Serial.println("\n[BOOT] Step 4: Checking server for existing calibration...");
  if (downloadCalibrationFromServer()) {
    Serial.println(
        "[BOOT] Plug & Play successful! Calibration loaded from server.");
    pendingAutoCalibration = false; // We have valid data!
    
    // Mark burn-in as done since we have valid remote calibration
    if (!burninDone) {
      prefs.begin("ifrit_time", false);
      prefs.putBool("burnin_done", true);
      prefs.end();
      burninDone = true;
    }
  } else {
    Serial.println("\n[BOOT] Step 5: No calibration found on server. Calibration record remains clean.");
  }

  Serial.println("\n=============================================");
  Serial.println("  INITIALIZATION COMPLETE");
  Serial.println("=============================================\n");
}

void loop() {
  // Auto-reconnect WiFi
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long currentMillis = millis();

  // ─── MINUTE PERSISTENT TIMER & STANDALONE BURN-IN TRIGGER ───
  static unsigned long lastMinuteTime = 0;
  if (currentMillis - lastMinuteTime >= 60000) {
    lastMinuteTime = currentMillis;
    cumulativeMins++;

    prefs.begin("ifrit_time", false); // read-write
    prefs.putULong("cum_mins", cumulativeMins);
    prefs.end();
    Serial.printf("[TIME] Cumulative Operating Time: %lu minutes / 1440\n",
                  cumulativeMins);

    // Autonomous standalone 24h burn-in trigger
    if (cumulativeMins >= 1440 && !burninDone) {
      Serial.println(
          "\n[BURN-IN COMPLETE] Running autonomous burn-in calibration...");
      if (calibrateSensors()) {
        sendCalibrationToServer();

        prefs.begin("ifrit_time", false);
        prefs.putBool("burnin_done", true);
        prefs.end();
        burninDone = true;
      }
    }
  }

  // ─── WARM-UP & SCHEDULED AUTO-CALIBRATION ───
  if (pendingAutoCalibration && currentMillis >= WARMUP_TIME_MS) {
    Serial.println(
        "\n[WARM-UP COMPLETE] Running scheduled auto-calibration...");
    if (calibrateSensors()) {
      sendCalibrationToServer();
    }
    pendingAutoCalibration = false;
  }

  // ─── TELEMETRY CYCLE ───
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    float values[NUM_SENSORS];

    // Read MQ sensors and convert raw ADC → Rs (during burn-in) or PPM (after calibration)
    for (int i = 0; i < NUM_MQ_SENSORS; i++) {
      int rawADC = analogRead(MQ_PINS[i]);
      if (!burninDone) {
        values[i] = calculateRs(rawADC); // Use raw resistance (kOhm) during burn-in
      } else {
        values[i] = calculatePPM(rawADC, i); // Use calibrated PPM after burn-in and calibration
      }
    }

    // Baca data lingkungan dari sensor digital SHTC3
    sensors_event_t humidity, temp;
    shtc3.getEvent(&humidity, &temp);
    values[4] = temp.temperature;
    values[5] = humidity.relative_humidity;

    // Baca status api dari sensor Flame (Logika Biner)
    values[6] = digitalRead(FLAME_PIN);

    // Baca tingkat kecerahan cahaya dari LDR sensor (raw analog)
    values[7] = analogRead(LDR_PIN);

    // ─── Serial Debug Output ───
    bool isWarmingUp = pendingAutoCalibration && (currentMillis < WARMUP_TIME_MS);
    if (isWarmingUp) {
      const char* mqNames[] = {"MQ-2  (LPG)", "MQ-4  (CH4)", "MQ-6  (LPG)", "MQ-9  (CO) "};
      Serial.printf("=== SENSOR READINGS (⏳ WARMING UP: %.1f / 5.0 mins) ===\n", currentMillis / 60000.0);
      Serial.println("  [STABILIZING] MQ heaters are currently stabilizing.");
      for (int i = 0; i < NUM_MQ_SENSORS; i++) {
        int rawADC = analogRead(MQ_PINS[i]);
        float rs = calculateRs(rawADC);
        Serial.printf("  %s: Raw ADC: %4d | Rs: %7.2f kOhm (Stabilizing...)\n", mqNames[i], rawADC, rs);
      }
    } else if (!burninDone) {
      Serial.printf("=== SENSOR READINGS (🔥 24H BURN-IN: %lu / 1440 mins) ===\n", cumulativeMins);
      const char* mqNames[] = {"MQ-2  (LPG)", "MQ-4  (CH4)", "MQ-6  (LPG)", "MQ-9  (CO) "};
      for (int i = 0; i < NUM_MQ_SENSORS; i++) {
        int rawADC = analogRead(MQ_PINS[i]);
        Serial.printf("  %s: Raw ADC: %4d | Rs: %7.2f kOhm (Burning-in...)\n", mqNames[i], rawADC, values[i]);
      }
    } else {
      Serial.println("=== SENSOR READINGS ===");
      Serial.printf("  MQ-2  (LPG)  : %.2f ppm\n", values[0]);
      Serial.printf("  MQ-4  (CH4)  : %.2f ppm\n", values[1]);
      Serial.printf("  MQ-6  (LPG)  : %.2f ppm\n", values[2]);
      Serial.printf("  MQ-9  (CO)   : %.2f ppm\n", values[3]);
    }
    Serial.printf("  Temp  (SHTC3): %.1f C\n", values[4]);
    Serial.printf("  Hum   (SHTC3): %.1f %%\n", values[5]);
    Serial.printf("  Flame (IR)   : %.0f %s\n", values[6],
                  values[6] == LOW ? "[FIRE!]" : "[Safe]");
    Serial.printf("  LDR   (Light): %.1f raw\n", values[7]);
    Serial.println("=======================");

    // ─── Local Alarm Logic ───
    bool alarmTriggered = false;
    for (int i = 0; i < NUM_SENSORS; i++) {
      if (strcmp(SENSOR_TYPES[i], "LDR") == 0) {
        // Skip LDR from alarm trigger logic
        continue;
      }
      if (strcmp(SENSOR_TYPES[i], "FLAME") == 0) {
        // Flame sensor: fire when value is LOW (pull-up logic)
        if (values[i] < ALARM_THRESHOLDS[i])
          alarmTriggered = true;
      } else if (i < NUM_MQ_SENSORS) {
        // Skip gas alarms during warm-up countdown OR during burn-in phase to prevent false alarms
        bool gasAlarmsActive = (burninDone && !pendingAutoCalibration) || 
                               (burninDone && !isWarmingUp);
        if (gasAlarmsActive && values[i] > ALARM_THRESHOLDS[i]) {
          alarmTriggered = true;
        }
      } else if (values[i] > ALARM_THRESHOLDS[i]) {
        alarmTriggered = true;
      }
    }
    if (alarmTriggered) {
      Serial.println("[DEBUG] BUZZER: ALARM SOUNDING!");
    }

    // ─── Send Telemetry to Backend (Bypassed only during heater warm-up) ───
    if (!isWarmingUp) {
      WiFiClientSecure secureClient;
      WiFiClient plainClient;
      HTTPClient http;
      String url = String(API_BASE_URL) + "/sensors/readings/batch";
      beginHttp(http, secureClient, plainClient, url);
      http.addHeader("Content-Type", "application/json");

      JsonDocument doc;
      doc["device_id"] = deviceId;

      JsonArray readings = doc["readings"].to<JsonArray>();
      for (int i = 0; i < NUM_SENSORS; i++) {
        if (sensorUuids[i] == "")
          continue;

        // Skip sending uncalibrated MQ sensor readings during burn-in phase to prevent DB pollution
        if (i < NUM_MQ_SENSORS && !burninDone)
          continue;

        JsonObject reading = readings.add<JsonObject>();
        reading["sensor_id"] = sensorUuids[i];
        reading["value"] = int(values[i] * 100) / 100.0; // 2 decimal places
      }

      String payload;
      serializeJson(doc, payload);

      int httpCode = http.POST(payload);
      if (httpCode > 0 && httpCode < 400) {
        Serial.println("[TELEMETRY] Sent OK (" + String(httpCode) +
                       ") Alarm: " + (alarmTriggered ? "ON" : "OFF"));
      } else {
        Serial.println("[TELEMETRY] Failed: " + String(httpCode));
      }

      http.end();
    } else {
      Serial.println("[TELEMETRY] Bypassed: Waiting for heater stabilization...");
    }
  }

  // ─── HEARTBEAT CYCLE (includes remote command check) ───
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    sendHeartbeat();
  }
}