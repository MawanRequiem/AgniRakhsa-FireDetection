#include "camera_pins.h"
#include "config.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

// Wokwi simulation uses DHT22 for temp/humidity, but we map it to SHTC3 backend
// mapping
#include "DHTesp.h"
DHTesp dht;

// Globals
String deviceId = "";
String sensorUuids[NUM_SENSORS];

unsigned long lastTelemetryTime = 0;
unsigned long lastHeartbeatTime = 0;

// Setup WiFi connection
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  Serial.print("MAC address: ");
  Serial.println(WiFi.macAddress());
}

// Provision device with backend
bool provisionDevice() {
  Serial.println("Provisioning device with backend...");

  HTTPClient http;
  String url = String(API_BASE_URL) + "/devices/provision";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Build JSON request
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

  Serial.println("Sending provision request:");
  Serial.println(payload);

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      String response = http.getString();
      Serial.println("Provision response: " + response);

      // Parse response to get UUIDs
      JsonDocument respDoc;
      DeserializationError error = deserializeJson(respDoc, response);

      if (!error) {
        deviceId = respDoc["device_id"].as<String>();
        Serial.println("Device UUID: " + deviceId);

        for (int i = 0; i < NUM_SENSORS; i++) {
          sensorUuids[i] = respDoc["sensors"][SENSOR_TYPES[i]].as<String>();
          Serial.println(String(SENSOR_TYPES[i]) + " UUID: " + sensorUuids[i]);
        }

        http.end();
        return true;
      } else {
        Serial.println("Failed to parse JSON response");
      }
    } else {
      Serial.println("HTTP error code: " + String(httpCode));
      Serial.println("Response: " + http.getString());
    }
  } else {
    Serial.println("HTTP POST failed, error: " + http.errorToString(httpCode));
  }

  http.end();
  return false;
}

// Send periodic heartbeat
void sendHeartbeat() {
  if (deviceId == "")
    return;

  HTTPClient http;
  String url = String(API_BASE_URL) + "/devices/" + deviceId + "/heartbeat";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["firmware_version"] = "1.0.0-WOKWI";
  doc["uptime_seconds"] = millis() / 1000;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode <= 0 || httpCode >= 400) {
    Serial.println("Heartbeat failed: " + String(httpCode));
  }

  http.end();
}

// Main logic
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- AgniRakhsa IFRIT Starting ---");

  // Pin setup
  pinMode(ALERT_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Simulated Sensors Setup
  dht.setup(SHTC3_SDA_PIN, DHTesp::DHT22);

  // ADC setup
  analogReadResolution(12); // 0-4095

  connectWiFi();

  // Keep trying to provision until successful
  while (!provisionDevice()) {
    Serial.println("Retrying provision in 5 seconds...");
    delay(5000);
  }

  Serial.println("Initialization complete!");
}

void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  unsigned long currentMillis = millis();

  // Handle Telemetry
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;

    // Read sensors
    float values[NUM_SENSORS];
    values[0] = analogRead(MQ2_PIN);  // MQ2
    values[1] = analogRead(MQ4_PIN);  // MQ4
    values[2] = analogRead(MQ6_PIN);  // MQ6
    values[3] = analogRead(MQ9B_PIN); // MQ9B

    TempAndHumidity tah = dht.getTempAndHumidity();
    values[4] = tah.temperature; // SHTC3_TEMP

    values[5] = analogRead(FLAME_PIN); // FLAME

    // Check Alarms
    bool alarmTriggered = false;
    for (int i = 0; i < NUM_SENSORS; i++) {
      // Special logic for flame: flame is detected when value is LOW (pull-up)
      if (strcmp(SENSOR_TYPES[i], "FLAME") == 0) {
        if (values[i] < ALARM_THRESHOLDS[i]) {
          alarmTriggered = true;
        }
      }
      // Normal logic: triggered if value exceeds threshold
      else if (values[i] > ALARM_THRESHOLDS[i]) {
        alarmTriggered = true;
      }
    }

    // Toggle Local Alarm
    if (alarmTriggered) {
      digitalWrite(ALERT_LED_PIN, HIGH);
      digitalWrite(BUZZER_PIN, HIGH);
    } else {
      digitalWrite(ALERT_LED_PIN, LOW);
      digitalWrite(BUZZER_PIN, LOW);
    }

    // Build Telemetry Payload
    HTTPClient http;
    String url = String(API_BASE_URL) + "/sensors/readings/batch";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["device_id"] = deviceId;

    JsonArray readings = doc["readings"].to<JsonArray>();

    for (int i = 0; i < NUM_SENSORS; i++) {
      if (sensorUuids[i] == "")
        continue;

      JsonObject reading = readings.add<JsonObject>();
      reading["sensor_id"] = sensorUuids[i];
      // Limit to 2 decimal places manually, though Backend handles floats
      reading["value"] = int(values[i] * 100) / 100.0;
    }

    String payload;
    serializeJson(doc, payload);

    int httpCode = http.POST(payload);
    if (httpCode > 0 && httpCode < 400) {
      Serial.println("Telemetry sent OK. (" + String(httpCode) +
                     ") Alarm: " + (alarmTriggered ? "ON" : "OFF"));
    } else {
      Serial.println("Telemetry failed: " + String(httpCode) + " - " +
                     http.getString());
    }

    http.end();
  }

  // Handle Heartbeat
  if (currentMillis - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = currentMillis;
    sendHeartbeat();
  }
}