/**
 * AgniRakhsa IFRIT - Camera Pin Definitions
 * Board: ESP32-S3-DevKitC-1 with OV2640 Camera Module
 *
 * Standard ESP32-S3 CAM pinout for OV2640
 * NOTE: Camera is NOT simulatable in Wokwi.
 *       These pins are reserved for camera and should not be used for sensors.
 */

#ifndef CAMERA_PINS_H
#define CAMERA_PINS_H

// =============================================================================
// OV2640 Camera Pin Mapping (ESP32-S3)
// =============================================================================

// SCCB (I2C) interface for camera configuration
#define CAM_PIN_SIOD    8   // SDA - Camera I2C Data
#define CAM_PIN_SIOC    9   // SCL - Camera I2C Clock

// DVP (Digital Video Port) data bus
#define CAM_PIN_D0      11
#define CAM_PIN_D1      12
#define CAM_PIN_D2      13
#define CAM_PIN_D3      14
#define CAM_PIN_D4      47
#define CAM_PIN_D5      48
#define CAM_PIN_D6      21
#define CAM_PIN_D7      38

// DVP clock and sync signals
#define CAM_PIN_XCLK    10  // External clock input to camera
#define CAM_PIN_PCLK    39  // Pixel clock output from camera
#define CAM_PIN_VSYNC   40  // Vertical sync
#define CAM_PIN_HREF    41  // Horizontal reference

// Camera power control
#define CAM_PIN_PWDN    -1  // Power down (not connected, set -1)
#define CAM_PIN_RESET   -1  // Reset (not connected, set -1)

// =============================================================================
// Sensor Pin Mapping (used in Wokwi diagram)
// =============================================================================

// Gas Sensors (Analog - ADC)
#define MQ2_PIN         4   // MQ-2: Smoke/Combustible gas
#define MQ4_PIN         5   // MQ-4: Methane/CNG
#define MQ6_PIN         6   // MQ-6: LPG/Butane
#define MQ9B_PIN        7   // MQ-9B: CO/Flammable gas

// Flame Sensor (Analog - ADC)
#define FLAME_PIN       15  // TO-39: Flame/IR detection

// Temperature & Humidity (Digital - one-wire/I2C)
#define SHTC3_SDA_PIN   16  // SHTC3: Data pin (simulated as DHT22 in Wokwi)

// Output Pins
#define ALERT_LED_PIN   17  // Fire alert RED LED
#define BUZZER_PIN      18  // Alarm buzzer

#endif // CAMERA_PINS_H
