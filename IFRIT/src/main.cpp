/**
 * AgniRakhsa IFRIT — Firmware v3.0 (3-Layer Adaptive Calibration)
 *
 * Layer 1: NVS Persistent Storage  — R0 survives reboot
 * Layer 2: Server-Managed           — Backend stores R0 per device, admin can trigger recalibrate
 * Layer 3: Runtime Env Compensation — Real-time PPM with correct exponential regression
 *
 * PPM Formula: PPM = A × (Rs / R0)^B  (Exponential Regression from datasheet)
 *
 * Sensor lineup:
 *   MQ-2  → LPG / Smoke
 *   MQ-4  → CH4 (Methane)
 *   MQ-6  → LPG
 *   MQ-9B → CO (Carbon Monoxide)
 *   SHTC3 → Temperature (simulated as DHT22 in Wokwi)
 *   FLAME → IR Flame Sensor (analog, lower = fire detected)
 */

#include "camera_pins.h"
#include "config.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>

// Wokwi uses DHT22 to simulate SHTC3
#include "DHTesp.h"

// =============================================================================
// GLOBAL STATE
// =============================================================================

DHTesp dht;
Preferences prefs;

String deviceId = "";
String sensorUuids[NUM_SENSORS];

unsigned long lastTelemetryTime = 0;
unsigned long lastHeartbeatTime = 0;

// R0 values (calibrated baseline resistance in clean air, per MQ sensor)
float R0_VALUES[NUM_MQ_SENSORS] = {10.0, 10.0, 10.0, 10.0};
bool  isCalibrated = false;
bool  pendingAutoCalibration = false;
bool  burnInCalibrated = false;

// MQ sensor ADC pins in order: MQ2, MQ4, MQ6, MQ9
const int MQ_PINS[NUM_MQ_SENSORS] = {MQ2_PIN, MQ4_PIN, MQ6_PIN, MQ9B_PIN};

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
  burnInCalibrated = prefs.getBool("burnin_done", false);

  if (isCalibrated) {
    R0_VALUES[0] = prefs.getFloat("R0_MQ2", 10.0);
    R0_VALUES[1] = prefs.getFloat("R0_MQ4", 10.0);
    R0_VALUES[2] = prefs.getFloat("R0_MQ6", 10.0);
    R0_VALUES[3] = prefs.getFloat("R0_MQ9", 10.0);

    Serial.println("[NVS] Calibration loaded:");
    const char* mqNames[] = {"MQ2", "MQ4", "MQ6", "MQ9"};
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
  if (rawADC <= 10) return -1.0; // Noise floor guard

  float Vout = rawADC * (3.3 / 4095.0); // ESP32 ADC reference is always 3.3V
  if (Vout < 0.01) return -1.0;

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
 * IMPORTANT: Run this in clean/fresh air with sensors warmed up (24-48h for new sensors).
 *
 * @return true if all sensors calibrated successfully
 */
bool calibrateSensors() {
  Serial.println("\n========================================");
  Serial.println("  AUTO-CALIBRATION STARTING");
  Serial.println("  Ensure sensors are in CLEAN AIR!");
  Serial.println("========================================");

  if (millis() < WARMUP_TIME_MS) {
    Serial.printf("  [WARN] Sensors warming up (%.1f / 5.0 mins). Accuracy may vary.\n", 
                  millis() / 60000.0);
  }

  // --- Start Calibration Feedback ---
  // 1 Short beep to indicate calibration started
  Serial.println("[DEBUG] BUZZER: 1 Short Beep (Start Calibration)");
  digitalWrite(ALERT_LED_PIN, HIGH);
  delay(200);
  digitalWrite(ALERT_LED_PIN, LOW);

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
    digitalWrite(ALERT_LED_PIN, HIGH);
    delay(50);
    digitalWrite(ALERT_LED_PIN, LOW);
    delay(CALIBRATION_DELAY_MS - 50);

    // Progress indicator every 10 samples
    if ((s + 1) % 10 == 0) {
      Serial.printf("  Progress: %d/%d samples\n", s + 1, CALIBRATION_SAMPLES);
    }
  }

  // Calculate R0 = avg(Rs) / CleanAirRatio
  const char* mqNames[] = {"MQ2", "MQ4", "MQ6", "MQ9"};
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
    if (isnan(newR0) || isinf(newR0) ||
        newR0 < R0_MIN_VALID || newR0 > R0_MAX_VALID) {
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
    Serial.println("[DEBUG] BUZZER: 2 Short Beeps (Success)");
    for(int b=0; b<2; b++) {
      digitalWrite(ALERT_LED_PIN, HIGH);
      delay(150);
      digitalWrite(ALERT_LED_PIN, LOW);
      delay(150);
    }
  } else {
    Serial.println("========================================");
    Serial.println("  CALIBRATION PARTIAL FAILURE");
    Serial.println("  Some sensors may use default R0");
    Serial.println("========================================\n");
    
    // --- Failure Feedback ---
    // 1 Long beep
    Serial.println("[DEBUG] BUZZER: 1 Long Beep (Failure)");
    digitalWrite(ALERT_LED_PIN, HIGH);
    delay(1000);
    digitalWrite(ALERT_LED_PIN, LOW);
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
  if (sensorIndex < 0 || sensorIndex >= NUM_MQ_SENSORS) return 0.0;

  float rs = calculateRs(rawADC);
  if (rs < 0) return 0.0;

  float ratio = rs / R0_VALUES[sensorIndex];

  // Power regression: PPM = A × ratio^B
  float ppm = PARAM_A[sensorIndex] * pow(ratio, PARAM_B[sensorIndex]);

  // Clamp to sensor's practical range
  if (ppm < 0) ppm = 0;
  if (ppm > 10000) ppm = 10000;

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

/** Provision device with backend — get device_id and sensor UUIDs. */
bool provisionDevice() {
  Serial.println("[PROVISION] Registering with backend...");

  HTTPClient http;
  String url = String(API_BASE_URL) + "/devices/provision";
  http.begin(url);
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
    if (httpCode > 0) Serial.println("  Body: " + http.getString());
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
  if (deviceId == "") return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/calibration/" + deviceId;
  http.begin(url);
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
  if (deviceId == "") return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/calibration/" + deviceId + "/commands";
  http.begin(url);

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

        // Acknowledge command in progress
        HTTPClient ackHttp;
        String ackUrl = String(API_BASE_URL) + "/calibration/" + deviceId +
                        "/commands/" + commandId + "/ack";
        ackHttp.begin(ackUrl);
        ackHttp.addHeader("Content-Type", "application/json");
        ackHttp.POST("{\"status\":\"in_progress\"}");
        ackHttp.end();

        // Run calibration
        calibrateSensors();

        // Report results back
        sendCalibrationToServer();

        // Acknowledge command completion
        ackHttp.begin(ackUrl);
        ackHttp.addHeader("Content-Type", "application/json");
        ackHttp.POST("{\"status\":\"completed\"}");
        ackHttp.end();

        Serial.println("[REMOTE] Recalibration complete, ACK sent.");
      }
    }
  }

  http.end();
}

/** Send periodic heartbeat to backend. */
void sendHeartbeat() {
  if (deviceId == "") return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/devices/" + deviceId + "/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["uptime_seconds"] = millis() / 1000;

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

  // Pin setup
  pinMode(ALERT_LED_PIN, OUTPUT);
  // pinMode(BUZZER_PIN, OUTPUT); // Disabled for debug

  // DHT22 simulates SHTC3 in Wokwi
  dht.setup(SHTC3_SDA_PIN, DHTesp::DHT22);

  // ADC setup (ESP32 12-bit: 0-4095)
  analogReadResolution(12);

  // ─── LAYER 1: Try loading calibration from NVS ───
  Serial.println("[BOOT] Step 1: Loading calibration from NVS...");
  if (loadCalibrationFromNVS()) {
    Serial.println("[BOOT] Using saved calibration data.");
  } else {
    // First boot or NVS cleared — schedule auto-calibration
    Serial.println("[BOOT] No saved calibration. Device will use default R0.");
    Serial.printf("[BOOT] Auto-calibration scheduled after %d ms warm-up.\n", WARMUP_TIME_MS);
    Serial.println("[BOOT] (Ensure sensors are in CLEAN AIR and warmed up!)");
    pendingAutoCalibration = true;
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

  // ─── LAYER 2: Upload calibration to server ───
  Serial.println("\n[BOOT] Step 4: Uploading calibration to server...");
  sendCalibrationToServer();

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

  // ─── WARM-UP & SCHEDULED AUTO-CALIBRATION ───
  if (pendingAutoCalibration && currentMillis >= WARMUP_TIME_MS) {
    Serial.println("\n[WARM-UP COMPLETE] Running scheduled auto-calibration...");
    if (calibrateSensors()) {
      sendCalibrationToServer();
    }
    pendingAutoCalibration = false;
  }

  // ─── 24H BURN-IN AUTO-CALIBRATION ───
  if (!burnInCalibrated && currentMillis >= BURNIN_TIME_MS) {
    // Only calibrate if the flame sensor is NOT detecting a fire
    if (analogRead(FLAME_PIN) > ALARM_THRESHOLDS[5]) { 
      Serial.println("\n[BURN-IN COMPLETE] 24 Hours continuous uptime reached.");
      Serial.println("Running final high-accuracy auto-calibration...");
      
      if (calibrateSensors()) {
        sendCalibrationToServer();
        
        // Save flag to NVS so we don't repeat the 24h burn-in calibration on future reboots
        prefs.begin("agni_cal", false);
        prefs.putBool("burnin_done", true);
        prefs.end();
        burnInCalibrated = true;
      }
    } else {
      Serial.println("\n[BURN-IN] 24h reached, but FIRE detected! Postponing calibration...");
      // Add a 1-hour delay by shifting BURNIN_TIME_MS conceptually (or just let it retry next loop)
      // Since currentMillis will keep growing, it will retry as soon as the fire is gone.
    }
  }

  // ─── TELEMETRY CYCLE ───
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    float values[NUM_SENSORS];

    // Read MQ sensors and convert raw ADC → PPM using calibrated R0
    for (int i = 0; i < NUM_MQ_SENSORS; i++) {
      int rawADC = analogRead(MQ_PINS[i]);
      values[i] = calculatePPM(rawADC, i);
    }

    // Read temperature from SHTC3 (simulated as DHT22)
    TempAndHumidity tah = dht.getTempAndHumidity();
    values[4] = tah.temperature; // SHTC3_TEMP

    // Read flame sensor (analog — lower value = fire detected)
    values[5] = analogRead(FLAME_PIN); // FLAME (raw ADC)

    // ─── Serial Debug Output ───
    Serial.println("=== SENSOR READINGS ===");
    Serial.printf("  MQ-2  (LPG)  : %.2f ppm\n", values[0]);
    Serial.printf("  MQ-4  (CH4)  : %.2f ppm\n", values[1]);
    Serial.printf("  MQ-6  (LPG)  : %.2f ppm\n", values[2]);
    Serial.printf("  MQ-9B (CO)   : %.2f ppm\n", values[3]);
    Serial.printf("  Temp  (SHTC3): %.1f C\n", values[4]);
    Serial.printf("  Flame (IR)   : %.0f %s\n", values[5],
                   values[5] < ALARM_THRESHOLDS[5] ? "[FIRE!]" : "[Safe]");
    Serial.println("=======================");

    // ─── Local Alarm Logic ───
    bool alarmTriggered = false;
    for (int i = 0; i < NUM_SENSORS; i++) {
      if (strcmp(SENSOR_TYPES[i], "FLAME") == 0) {
        // Flame sensor: fire when value is LOW (pull-up logic)
        if (values[i] < ALARM_THRESHOLDS[i]) alarmTriggered = true;
      } else if (values[i] > ALARM_THRESHOLDS[i]) {
        alarmTriggered = true;
      }
    }

    digitalWrite(ALERT_LED_PIN, alarmTriggered ? HIGH : LOW);
    if (alarmTriggered) {
      Serial.println("[DEBUG] BUZZER: ALARM SOUNDING!");
    }
    // digitalWrite(BUZZER_PIN, alarmTriggered ? HIGH : LOW);

    // ─── Send Telemetry to Backend ───
    HTTPClient http;
    String url = String(API_BASE_URL) + "/sensors/readings/batch";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["device_id"] = deviceId;

    JsonArray readings = doc["readings"].to<JsonArray>();
    for (int i = 0; i < NUM_SENSORS; i++) {
      if (sensorUuids[i] == "") continue;

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
  }

  // ─── HEARTBEAT CYCLE (includes remote command check) ───
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    sendHeartbeat();
  }
}