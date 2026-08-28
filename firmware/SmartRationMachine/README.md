# Smart Ration Machine (ESP32) - RFID & OTP Verification Terminal

## Overview
This lightweight firmware powers the **ESP32 RFID & OTP Terminal** for the Smart Ration Distribution System:
1. Connects to 2.4GHz Wi-Fi.
2. Reads the beneficiary's RFID card UID via SPI (RC522 module).
3. Authenticates the card against the Node.js backend (`POST /api/machine/rfid`).
4. Requests cryptographic OTP generation (`POST /api/machine/generate-otp`).
5. Displays a confirmation message on the 16x2 LCD (*"OTP Generated / Check Reg. Mobile"*).

---

## Directory Structure
```
firmware/
└── SmartRationMachine/
    ├── SmartRationMachine.ino   # Main RFID read and OTP generation logic
    ├── config.h                 # Network and GPIO pin definitions
    ├── diagram.json             # Wokwi simulation diagram
    ├── wokwi.toml               # Wokwi project configuration
    └── README.md                # Wiring & setup guide
```

---

## Minimum Hardware Components
1. **ESP32 DevKit V1** (30 or 38 pins)
2. **MFRC522 RFID Reader Module** (13.56 MHz SPI) + MIFARE 1K Card / Tag
3. **16x2 I2C LCD Display** (PCF8574 I2C backpack)
4. **5V Active Buzzer** (Audio feedback)
5. **Micro-USB cable / 5V DC Power Supply**

---

## Conflict-Free Hardware Pin Assignment

| Component | Pin Function | ESP32 GPIO | Description / Notes |
|---|---|---|---|
| **RC522 RFID** | MOSI | **GPIO 23** | SPI Master Out Slave In |
| **RC522 RFID** | MISO | **GPIO 19** | SPI Master In Slave Out |
| **RC522 RFID** | SCK | **GPIO 18** | SPI Clock |
| **RC522 RFID** | SDA / SS | **GPIO 5** | SPI Slave Select |
| **RC522 RFID** | RST | **GPIO 27** | Hardware Reset |
| **I2C LCD 16x2** | SDA | **GPIO 21** | I2C Serial Data |
| **I2C LCD 16x2** | SCL | **GPIO 22** | I2C Serial Clock |
| **Buzzer** | Signal | **GPIO 15** | Active Buzzer (Card tap beep) |

---

## Required Arduino IDE Libraries
1. **`ArduinoJson`** (by *Benoît Blanchon*, v6.x or v7.x)
2. **`MFRC522`** (by *GithubCommunity / miguelbalboa*, v1.4.10+)
3. **`LiquidCrystal I2C`** (by *Frank de Brabander*, v1.1.2+)
4. **`WiFi`** & **`HTTPClient`** (Built into ESP32 Arduino Core)
