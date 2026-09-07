#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// =============================================================================
// 1. WI-FI & BACKEND CONFIGURATION
// =============================================================================
// Configure your 2.4GHz Wi-Fi Credentials
const char* const WIFI_SSID     = "YOUR_WIFI_SSID";
const char* const WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend API Base URL (without trailing slash)
const char* const BACKEND_BASE_URL = "http://192.168.1.100:3000";

// Unique Machine / Terminal Identifier
const char* const MACHINE_ID = "SRM-CENTER-001";

// HTTP Network Timeout in milliseconds
const uint32_t HTTP_TIMEOUT_MS = 10000;

// Wi-Fi Connection Attempt Timeout in milliseconds
const uint32_t WIFI_CONNECT_TIMEOUT_MS = 15000;

// =============================================================================
// 2. MINIMAL HARDWARE GPIO PIN DEFINITIONS
// =============================================================================

// --- MFRC522 RFID Reader (SPI Bus) ---
#define PIN_RFID_SS    5    // SPI Slave Select / SDA
#define PIN_RFID_RST   27   // Hardware Reset Line
#define PIN_RFID_SCK   18   // SPI Clock
#define PIN_RFID_MISO  19   // SPI Master In Slave Out
#define PIN_RFID_MOSI  23   // SPI Master Out Slave In

// --- I2C Display (16x2 LCD) ---
#define PIN_I2C_SDA    21   // I2C Data
#define PIN_I2C_SCL    22   // I2C Clock
#define LCD_I2C_ADDR   0x27 // Common I2C Address (0x27 or 0x3F)
#define LCD_COLUMNS    16
#define LCD_ROWS       2

// --- Status Indicator / Buzzer (Optional) ---
#define PIN_BUZZER     15   // Status feedback buzzer

#endif // CONFIG_H
