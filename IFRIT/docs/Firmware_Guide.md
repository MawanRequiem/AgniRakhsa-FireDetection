# IFRIT IoT Sensor Firmware

IFRIT is the hardware component of the Ifrit system. It is a microcontroller-based IoT device responsible for gathering environmental data and transmitting it to the backend.

## Hardware & Stack

- **Microcontroller:** ESP32 (Wi-Fi enabled).
- **Framework:** Arduino framework via PlatformIO.
- **Sensors:** 
  - MQ2 (Smoke/Combustible Gas)
  - MQ4 (Methane/CNG)
  - MQ6 (LPG/Butane)
  - MQ9 (Carbon Monoxide)
  - SHTC3 (Precision Temperature & Humidity)
  - *(Flame sensor hardware support exists but is currently disabled due to hardware fault tolerances).*

## Firmware Architecture

The firmware (`src/main.cpp`) is designed for stability and continuous operation:

1. **Initialization:** Connects to the configured Wi-Fi network and initializes the I2C (for SHTC3) and Analog pins (for MQ sensors).
2. **Reading Loop:** Reads analog values from the gas sensors and digital values from the temp/humidity sensor at fixed intervals.
3. **Data Transmission:** Packages the sensor snapshot into a JSON payload and transmits it to the backend via HTTP POST (`/api/v1/sensors/readings/batch`) or MQTT.
4. **Watchdog:** The firmware includes an internal watchdog timer to automatically reboot the ESP32 if the network hangs or the main loop gets stuck.

## Compilation & Upload

The project is managed using PlatformIO.

```bash
cd IFRIT
pio run -t upload
```

Make sure to configure the correct Wi-Fi credentials and the Backend API URL in the `platformio.ini` or header configuration before uploading the code to the ESP32.
