/**
 * =============================================================================
 * SMART RATION MACHINE (SRM) - ESP32 RFID & OTP VERIFICATION FIRMWARE
 * =============================================================================
 * Functionality:
 *  1. Connects to local 2.4GHz Wi-Fi
 *  2. Connects to existing Node.js / Express backend
 *  3. Reads beneficiary RFID UID via MFRC522 SPI module
 *  4. Queries POST /api/machine/rfid to authenticate and retrieve beneficiaryId
 *  5. Triggers POST /api/machine/generate-otp to issue cryptographic OTP
 *  6. Displays confirmation on 16x2 LCD ("OTP Generated / Check Reg. Mobile")
 *  7. Never exposes the actual raw OTP to the LCD screen
 * =============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Wire.h>
#include <ArduinoJson.h>
#include <MFRC522.h>
#include <LiquidCrystal_I2C.h>

#include "config.h"

// =============================================================================
// HARDWARE DRIVER INSTANCES
// =============================================================================
MFRC522 rfid(PIN_RFID_SS, PIN_RFID_RST);
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLUMNS, LCD_ROWS);

// =============================================================================
// STATE & RUNTIME VARIABLES
// =============================================================================
enum DeviceState {
  STATE_IDLE,
  STATE_AUTHENTICATING,
  STATE_GENERATING_OTP,
  STATE_CONFIRMATION
};

DeviceState currentState = STATE_IDLE;
uint32_t lastHealthPingMs = 0;

// Runtime beneficiary variables for most recently scanned RFID card
String currentBeneficiaryId = "";
String currentFullName = "";
String currentRationCardNumber = "";
float currentRiceQuota = 0.0;
float currentOilQuota = 0.0;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
void updateLcd(const String& line1, const String& line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, LCD_COLUMNS));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, LCD_COLUMNS));
}

void formatQuotaString(char* buffer, size_t bufSize, const char* label, float value, const char* unit) {
  float intPart;
  float fracPart = modff(value, &intPart);
  if (fabsf(fracPart) < 0.001f) {
    snprintf(buffer, bufSize, "%s: %d %s", label, (int)intPart, unit);
  } else if (fabsf(modff(value * 10.0f, &intPart)) < 0.001f) {
    snprintf(buffer, bufSize, "%s: %.1f %s", label, value, unit);
  } else {
    snprintf(buffer, bufSize, "%s: %.2f %s", label, value, unit);
  }
}

void buzzerBeep(uint16_t durationMs) {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(durationMs);
  digitalWrite(PIN_BUZZER, LOW);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WIFI] Connecting to SSID: ");
  Serial.println(WIFI_SSID);
  updateLcd("Connecting WiFi", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected! IP: " + WiFi.localIP().toString());
    updateLcd("WiFi Connected", WiFi.localIP().toString());
    buzzerBeep(120);
    delay(1000);
  } else {
    Serial.println("\n[WIFI] Connection failed. Retrying...");
    updateLcd("WiFi Failed!", "Check Router");
    delay(2000);
  }
}

bool checkBackendStatus() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String url = String(BACKEND_BASE_URL) + "/api/machine/status?machineId=" + String(MACHINE_ID);
  http.begin(url);
  http.setTimeout(HTTP_TIMEOUT_MS);

  int httpCode = http.GET();
  bool isOnline = false;

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payload);
    if (!err && doc["success"].as<bool>()) {
      Serial.println("[STATUS] Backend is operational.");
      isOnline = true;
    }
  }
  http.end();
  return isOnline;
}

// =============================================================================
// BACKEND API CLIENT FUNCTIONS
// =============================================================================

/**
 * 1. POST /api/machine/rfid
 * Sends scanned RFID UID to identify the beneficiary and retrieve allocation quotas.
 */
bool apiAuthenticateRfid(const String& uid,
                         String& outBeneficiaryId,
                         String& outFullName,
                         String& outRationCardNumber,
                         float& outRiceQuota,
                         float& outOilQuota) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(String(BACKEND_BASE_URL) + "/api/machine/rfid");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  StaticJsonDocument<128> reqDoc;
  reqDoc["rfidUid"] = uid;

  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = http.POST(reqBody);
  bool success = false;

  if (httpCode == HTTP_CODE_OK) {
    String resBody = http.getString();
    DynamicJsonDocument resDoc(1024);
    DeserializationError err = deserializeJson(resDoc, resBody);

    if (!err && resDoc["success"].as<bool>()) {
      JsonObject beneficiary = resDoc["data"]["beneficiary"];
      String status = beneficiary["status"].as<String>();

      if (status.equalsIgnoreCase("Active") || status.equalsIgnoreCase("Approved")) {
        outBeneficiaryId    = beneficiary["_id"].as<String>();
        outFullName         = beneficiary["fullName"].as<String>();
        outRationCardNumber = beneficiary["rationCardNumber"].as<String>();

        // Prefer available quota if calculated by backend, otherwise beneficiary quota
        if (resDoc["data"].containsKey("availableRice")) {
          outRiceQuota = resDoc["data"]["availableRice"].as<float>();
        } else {
          outRiceQuota = beneficiary["riceQuota"].as<float>();
        }

        if (resDoc["data"].containsKey("availableOil")) {
          outOilQuota = resDoc["data"]["availableOil"].as<float>();
        } else {
          outOilQuota = beneficiary["oilQuota"].as<float>();
        }

        Serial.println("[API] Beneficiary Authenticated Successfully:");
        Serial.println("  ID:         " + outBeneficiaryId);
        Serial.println("  Name:       " + outFullName);
        Serial.println("  RationCard: " + outRationCardNumber);
        Serial.printf("  Rice Quota: %.2f KG\n", outRiceQuota);
        Serial.printf("  Oil Quota:  %.2f L\n", outOilQuota);
        success = true;
      } else {
        Serial.printf("[API] Beneficiary status is '%s', not Active/Approved. Access denied.\n", status.c_str());
        updateLcd("Status: " + status, "Access Denied");
        buzzerBeep(400);
        delay(2500);
      }
    } else {
      Serial.println("[API] Failed to parse beneficiary response or success is false");
    }
  } else if (httpCode == 403) {
    String resBody = http.getString();
    DynamicJsonDocument resDoc(512);
    deserializeJson(resDoc, resBody);
    String status = resDoc["beneficiaryStatus"].as<String>();
    if (status.length() == 0) status = "Not Active";
    Serial.printf("[API] Beneficiary disallowed (Status: %s)\n", status.c_str());
    updateLcd("Status: " + status, "Access Denied");
    buzzerBeep(400);
    delay(2500);
  } else if (httpCode == 404) {
    Serial.println("[API] RFID UID not found in database");
    updateLcd("Card Not Found!", "Access Denied");
    buzzerBeep(400);
    delay(2500);
  } else {
    Serial.printf("[API] RFID Identification Failed (HTTP %d)\n", httpCode);
    updateLcd("Auth Failed!", "Code: " + String(httpCode));
    buzzerBeep(400);
    delay(2500);
  }

  http.end();
  return success;
}

/**
 * 2. POST /api/machine/generate-otp
 * Requests backend to generate an OTP for the identified beneficiary.
 */
bool apiGenerateOtp(const String& beneficiaryId) {
  if (WiFi.status() != WL_CONNECTED || beneficiaryId.length() == 0) return false;

  HTTPClient http;
  http.begin(String(BACKEND_BASE_URL) + "/api/machine/generate-otp");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  StaticJsonDocument<128> reqDoc;
  reqDoc["beneficiaryId"] = beneficiaryId;

  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = http.POST(reqBody);
  bool success = false;

  if (httpCode == 201 || httpCode == HTTP_CODE_OK) {
    String resBody = http.getString();
    StaticJsonDocument<512> resDoc;
    DeserializationError err = deserializeJson(resDoc, resBody);

    if (!err && resDoc["success"].as<bool>()) {
      Serial.println("[API] OTP successfully generated in backend database.");
      // For developer console debugging only (NEVER displayed on LCD screen)
      if (resDoc.containsKey("otp")) {
        Serial.printf("[DEBUG] (Server OTP: %s)\n", resDoc["otp"].as<const char*>());
      }
      success = true;
    }
  } else {
    Serial.printf("[API] OTP Generation Failed (HTTP %d)\n", httpCode);
  }

  http.end();
  return success;
}

/**
 * 3. POST /api/machine/dispense
 * Validates requested dispense quantities against beneficiary quota and distributor stock.
 */
bool apiValidateDispense(const String& beneficiaryId, float riceQty, float oilQty) {
  if (WiFi.status() != WL_CONNECTED || beneficiaryId.length() == 0) return false;

  HTTPClient http;
  http.begin(String(BACKEND_BASE_URL) + "/api/machine/dispense");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  StaticJsonDocument<256> reqDoc;
  reqDoc["beneficiaryId"] = beneficiaryId;
  reqDoc["riceQuantity"] = riceQty;
  reqDoc["oilQuantity"] = oilQty;
  reqDoc["machineId"] = MACHINE_ID;

  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = http.POST(reqBody);
  bool valid = false;

  if (httpCode == HTTP_CODE_OK) {
    String resBody = http.getString();
    StaticJsonDocument<512> resDoc;
    DeserializationError err = deserializeJson(resDoc, resBody);
    if (!err && resDoc["valid"].as<bool>()) {
      valid = true;
      Serial.println("[API] Dispense validation approved.");
    }
  } else {
    Serial.printf("[API] Dispense Validation Rejected (HTTP %d)\n", httpCode);
  }

  http.end();
  return valid;
}

/**
 * 4. POST /api/machine/complete
 * Records dispense completion, deducts inventory, and updates allocation status.
 */
bool apiCompleteDispense(const String& beneficiaryId, float riceQty, float oilQty, const String& requestId = "") {
  if (WiFi.status() != WL_CONNECTED || beneficiaryId.length() == 0) return false;

  HTTPClient http;
  http.begin(String(BACKEND_BASE_URL) + "/api/machine/complete");
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  StaticJsonDocument<256> reqDoc;
  reqDoc["beneficiaryId"] = beneficiaryId;
  reqDoc["riceQuantity"] = riceQty;
  reqDoc["oilQuantity"] = oilQty;
  reqDoc["machineId"] = MACHINE_ID;
  if (requestId.length() > 0) {
    reqDoc["requestId"] = requestId;
  }

  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = http.POST(reqBody);
  bool success = false;

  if (httpCode == HTTP_CODE_OK || httpCode == 201) {
    String resBody = http.getString();
    StaticJsonDocument<512> resDoc;
    DeserializationError err = deserializeJson(resDoc, resBody);
    if (!err && resDoc["success"].as<bool>()) {
      success = true;
      Serial.println("[API] Dispense transaction successfully completed and saved.");
    }
  } else {
    Serial.printf("[API] Complete Dispense Failed (HTTP %d)\n", httpCode);
  }

  http.end();
  return success;
}

// =============================================================================
// MAIN ARDUINO ENTRY POINTS
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==================================================");
  Serial.println("  SMART RATION MACHINE - RFID/OTP TERMINAL BOOT   ");
  Serial.println("==================================================");

  // Initialize Buzzer
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // Initialize I2C LCD Display
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  lcd.init();
  lcd.backlight();
  updateLcd("Smart Ration Sys", "Initializing...");

  // Initialize SPI & RC522 RFID Reader
  SPI.begin(PIN_RFID_SCK, PIN_RFID_MISO, PIN_RFID_MOSI, PIN_RFID_SS);
  rfid.PCD_Init();
  delay(100);
  Serial.print("[INIT] RFID Reader initialized. Version: 0x");
  Serial.println(rfid.PCD_ReadRegister(MFRC522::VersionReg), HEX);

  // Connect to Wi-Fi
  connectWiFi();

  // Initial Backend Health Ping
  checkBackendStatus();

  // Ready State
  updateLcd("Smart Ration Sys", "Tap RFID Card");
  Serial.println("[READY] Ready for RFID scan.");
  buzzerBeep(100);
}

void loop() {
  // Maintain Wi-Fi Connection
  if (WiFi.status() != WL_CONNECTED) {
    updateLcd("Wi-Fi Lost!", "Reconnecting...");
    connectWiFi();
    updateLcd("Smart Ration Sys", "Tap RFID Card");
    return;
  }

  // Periodic Backend Health Check (every 60s while idle)
  if (millis() - lastHealthPingMs > 60000) {
    lastHealthPingMs = millis();
    checkBackendStatus();
  }

  // Check for RFID Card Presence
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Read Card UID and convert to Upper-case Hex string (e.g. "A1B2C3D4")
  String scannedUid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) scannedUid += "0";
    scannedUid += String(rfid.uid.uidByte[i], HEX);
  }
  scannedUid.toUpperCase();

  // Halt PICC to prevent duplicate reads
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  Serial.print("\n[RFID] Card Detected! UID: ");
  Serial.println(scannedUid);
  buzzerBeep(80);

  // Step 1: Identify Beneficiary via Backend
  updateLcd("Verifying Card...", "UID: " + scannedUid);

  if (!apiAuthenticateRfid(scannedUid, currentBeneficiaryId, currentFullName, currentRationCardNumber, currentRiceQuota, currentOilQuota)) {
    updateLcd("Smart Ration Sys", "Tap RFID Card");
    return;
  }

  // Step 2: Display Beneficiary Name & Ration Card Number
  String line1 = currentFullName;
  String line2 = "RC: " + currentRationCardNumber;
  updateLcd(line1, line2);
  buzzerBeep(80);
  delay(2000);

  // Zero-Quota / Unallocated check
  if (currentRiceQuota <= 0.0f && currentOilQuota <= 0.0f) {
    Serial.println("[SRM] Beneficiary has 0 allocated quota. Dispensing disallowed.");
    updateLcd("No Quota Alloc.", "Cannot Dispense");
    buzzerBeep(300);
    delay(3000);
    updateLcd("Smart Ration Sys", "Tap RFID Card");
    return;
  }

  // Step 3: Display Dynamic Rice & Oil Quotas from MongoDB (decimal precision preserved)
  char riceLine[17];
  char oilLine[17];
  formatQuotaString(riceLine, sizeof(riceLine), "Rice", currentRiceQuota, "KG");
  formatQuotaString(oilLine, sizeof(oilLine), "Oil", currentOilQuota, "L");
  updateLcd(String(riceLine), String(oilLine));
  buzzerBeep(80);
  delay(2500);

  // Step 4: Request OTP Generation from Backend
  updateLcd("Generating OTP", "Please wait...");
  buzzerBeep(60);

  if (!apiGenerateOtp(currentBeneficiaryId)) {
    updateLcd("OTP Gen Failed!", "Try Again Later");
    buzzerBeep(400);
    delay(3000);
    updateLcd("Smart Ration Sys", "Tap RFID Card");
    return;
  }

  // Step 5: Display Confirmation (Raw OTP is NEVER displayed on the screen)
  updateLcd("OTP Generated", "Check Reg. Mobile");
  buzzerBeep(100);
  delay(100);
  buzzerBeep(100);

  delay(4000);

  // Return to Idle
  updateLcd("Smart Ration Sys", "Tap RFID Card");
  Serial.println("[READY] Ready for next card scan.\n");
}
