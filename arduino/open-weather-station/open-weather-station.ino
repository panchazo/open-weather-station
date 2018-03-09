/**********************************************************************
                    Open Weather Station
                https://OpenWeatherStation.com

  PROJECT
  This software reads data from the sensors and sends the samples via
  bluetooth. It has been build a part of a larger solution that
  integrates with an external device to connect, store, visualize and
  send data to external services.

  LICENCE
  Copyright 2017 Francisco Claria

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
***********************************************************************/

/**********************************************************************
   LIBS
***********************************************************************/

#include <avr/wdt.h> //watchdog
#include <SimpleTimer.h> //repetitive tasks
#include <SoftwareSerial.h>//bluetooth
#include <Wire.h> //barometer
#include <BME280I2C.h> //barometer https://github.com/finitespace/BME280/
#include <BH1750.h> //light sensor

/**********************************************************************
   ENABLE SERIAL DEBUG (disable for production)
***********************************************************************/
#define ENABLE_DEBUG_SERIAL_OUTPUT true //outputs debug data via serial monitor

/**********************************************************************
   CONFIGS
***********************************************************************/

#define ARDUINO_AUTOREBOOT_MINUTES 30 //if no ack is received within this minutes arduino autoreboots
#define ANEMOMETER_PIN 2 //digital pin 2 (interrupt 0)
#define RAINGAUGE_PIN 3 //digital pin 3 (interrupt 1)
#define WINDVANE_PIN A2 //analog 2
#define STATUS_LED_PIN 13
#define BLUETOOTH_PWR_PIN 12
#define BLUETOOTH_SERIAL_TX_PIN 10
#define BLUETOOTH_SERIAL_RX_PIN 9
#define BLUETOOTH_SERIAL_SPEED 9600
#define WIND_SAMPLING_SECONDS 5 //from 5 to 15 seconds would be recommended
#define WIND_SAMPLES_SIZE 12 //this value MUST be 60secs/WIND_SAMPLING_SECONDS, eg. 60/6 => 10=WIND_SAMPLES_SIZE
#define WIND_AVG_MINUTE_LOG_SIZE 18 //this MUST be equal or greater than 1 to store the current sample

/**********************************************************************
  WIND/RAIN CALIBRATION VALUES - SPEED, RAIN & WIND ANGLE
***********************************************************************/

#define ANEMOMETER_SPEED_FACTOR 3.0 //if no specs available use this setting
#define ANEMOMETER_CIRCUMFERENCE_MTS 0.4367 // circumference in meters from center cup of anemometer
#define ANEMOMETER_CYCLES_PER_LOOP 2 // tipically cup anemometers count twice on a full loop
#define RAIN_BUCKET_MM_PER_CYCLE 0.3 //if no specs available use this setting 

//Arduino A/D values for each wind vane direction
#define VANE_AD_N 784
#define VANE_AD_NE 456
#define VANE_AD_E 89
#define VANE_AD_SE 180
#define VANE_AD_S 282
#define VANE_AD_SW 625
#define VANE_AD_W 943
#define VANE_AD_NW 886

/**********************************************************************
   VARS
***********************************************************************/

SimpleTimer timerManager;
BME280I2C pressureSensor;
SoftwareSerial bluetooth(BLUETOOTH_SERIAL_RX_PIN, BLUETOOTH_SERIAL_TX_PIN);
BH1750 lightMeter;

volatile unsigned long nextTimeAnemometerInterrupt = 0 , nextTimeRainIterrupt = 0  ; //software debounce variables
volatile int anemometerCyclesCounter = 0, anemometerMinuteCyclesCounter = 0, rainCyclesCounter = 0; //interrupt counters
unsigned long lastMinuteSampleMillis = 0;
boolean enableSendWindPartialSamples = true;
int arduinoAutorebootTimer, statusLedOutputVal = 0;

int windvaneADRefValues[] = { VANE_AD_N, VANE_AD_NE, VANE_AD_E, VANE_AD_SE, VANE_AD_S, VANE_AD_SW, VANE_AD_W, VANE_AD_NW };

struct WindSample {
  float windCyclesPerSecond;
  int windAngle;
  unsigned long sampleMillis;
};

struct SensorsSample {
  float temperature;//Cº
  float humidity;//%
  float pressure;//Pa
  int lux;
  float windCyclesPerSecond;
  int windAngle;
  float gustCyclesPerSecond;
  int gustAngle;
  int rainCyclesPerMinute;
  unsigned long  sampleMillis;
};

SensorsSample avgMinuteSamplesLog[WIND_AVG_MINUTE_LOG_SIZE];
WindSample windSamples[WIND_SAMPLES_SIZE];

/**********************************************************************
  ARDUINO SETUP & MAIN LOOP
***********************************************************************/

void setup() {
  wdt_disable();//must always begin with this

  if (ENABLE_DEBUG_SERIAL_OUTPUT) {
    Serial.begin(9600);
    Serial.println(F("ON"));
  }

  initSamplesArrays();
  setupPins();
  rebootBluetooth();

  Wire.begin();
  pressureSensor.begin();
  if (ENABLE_DEBUG_SERIAL_OUTPUT) {
    switch (pressureSensor.chipModel()) {
      case BME280::ChipModel_BME280:
        Serial.println(F("BME"));
        break;
      case BME280::ChipModel_BMP280:
        Serial.println(F("BPM"));
        break;
      default:
        Serial.println(F("?"));
    }
  }
  lightMeter.begin();

  timerManager.setInterval(1000, blinkStatusLed);
  timerManager.setInterval(WIND_SAMPLING_SECONDS * 1000, captureAndSendPartialSample);
  timerManager.setInterval(60000L, captureAndSendMinuteSample);
  arduinoAutorebootTimer = timerManager.setTimeout((long)ARDUINO_AUTOREBOOT_MINUTES * 60L * 1000L, resetArduino);

  wdt_enable(WDTO_4S);//enable watchdog

  if (ENABLE_DEBUG_SERIAL_OUTPUT) {
    Serial.println(F("RUN"));
  }
}

void loop() {
  timerManager.run();
  readCmdFromBluetooth();
  wdt_reset();
}

/***********************************************************************
  OPERATIONAL FUNCTIONS
***********************************************************************/

void captureAndSendPartialSample() {
  shiftArrayToRight(windSamples, WIND_SAMPLES_SIZE);
  float prevSampleMillis = windSamples[1].sampleMillis;
  unsigned long currentSampleMillis = millis();
  float elapsedSeconds = (float)(currentSampleMillis - prevSampleMillis) / (float)1000;
  float windCyclesPerSecond = (float)anemometerCyclesCounter / elapsedSeconds;
  anemometerCyclesCounter = 0;//reset the partial interrupt counter to 0
  int windAngle = analogToAngleDirection(analogRead(WINDVANE_PIN), windvaneADRefValues);
  windSamples[0] = {windCyclesPerSecond, windAngle, currentSampleMillis};
  if (enableSendWindPartialSamples) {
    sendWindPartialSample(bluetooth, windSamples[0]);
    if (ENABLE_DEBUG_SERIAL_OUTPUT) {
      sendWindPartialSample(Serial, windSamples[0]);
    }
  }
}

void sendWindPartialSample(Stream &port, WindSample ws) {
  port.print(F("{"));
  port.print(F("\"rt\""));
  port.print(F(":"));
  port.print(1);
  port.print(F(","));
  port.print(F("\"ws\""));
  port.print(F(":"));
  port.print(ws.windCyclesPerSecond / (float)ANEMOMETER_CYCLES_PER_LOOP * (float)ANEMOMETER_CIRCUMFERENCE_MTS * (float)ANEMOMETER_SPEED_FACTOR);
  port.print(F(","));
  port.print(F("\"a\""));
  port.print(F(":"));
  port.print(ws.windAngle);
  port.print(F(","));
  port.print(F("\"ms\""));
  port.print(F(":"));
  port.print(ws.sampleMillis);
  port.print(F("}"));
  port.println();
  port.flush();
}

void captureAndSendMinuteSample() {
  float prevSampleMillis = lastMinuteSampleMillis;
  unsigned long currentSampleMillis = millis();
  float elapsedSeconds = (float)(currentSampleMillis - prevSampleMillis) / (float)1000;
  float windCyclesPerSecond = (float)anemometerMinuteCyclesCounter / elapsedSeconds;
  float pressureSensorTemp(NAN), pressureSensorHum(NAN), pressureSensorPressure(NAN);

  BME280::TempUnit tempUnit(BME280::TempUnit_Celsius);
  BME280::PresUnit presUnit(BME280::PresUnit_Pa);
  pressureSensor.read(pressureSensorPressure, pressureSensorTemp, pressureSensorHum, tempUnit, presUnit);

  if (isnan(pressureSensorPressure) || pressureSensorPressure < 0) {
    pressureSensorPressure = -500;
  }
  if (isnan(pressureSensorTemp) || pressureSensorTemp < -273 || pressureSensorTemp > 100) {
    pressureSensorTemp = -500;
  }
  if (isnan(pressureSensorHum) || pressureSensorHum < 0 || pressureSensorHum > 100) {
    pressureSensorHum = -500;
  }

  int avgWindAngle = 0, gustAngle = 0;
  float gustCyclesPerSecond = 0;

  calcValuesFromWindSamples(windSamples, WIND_SAMPLES_SIZE, avgWindAngle, gustCyclesPerSecond, gustAngle);

  int lightLvl = lightMeter.readLightLevel();
  lightLvl = (lightLvl > 54612 || lightLvl < 0) ? -500 : lightLvl;

  SensorsSample avgMinuteSample = {
    pressureSensorTemp,
    pressureSensorHum,
    pressureSensorPressure,
    lightLvl,
    windCyclesPerSecond,
    avgWindAngle,
    gustCyclesPerSecond,
    gustAngle,
    rainCyclesCounter,
    currentSampleMillis
  };

  rainCyclesCounter = 0;//reset the interrupt counter to 0
  anemometerMinuteCyclesCounter = 0;//reset the interrupt counter to 0
  lastMinuteSampleMillis = currentSampleMillis;
  shiftArrayToRight(avgMinuteSamplesLog, WIND_AVG_MINUTE_LOG_SIZE);
  avgMinuteSamplesLog[0] = avgMinuteSample;
  sendFullSamples(bluetooth, avgMinuteSamplesLog, 1);
  if (ENABLE_DEBUG_SERIAL_OUTPUT) {
    sendFullSamples(Serial, avgMinuteSamplesLog, 1);
  }
}

void sendFullSamples(Stream &port, SensorsSample * samples, int samplesToSend) {
  for (int i = 0; i < samplesToSend; i++) {
    port.print(F("{"));
    port.print(F("\"log\""));
    port.print(F(":"));
    port.print(i);
    port.print(F(","));
    port.print(F("\"rt\""));
    port.print(F(":"));
    port.print(0);
    port.print(F(","));
    port.print(F("\"t\""));
    port.print(F(":"));
    port.print(samples[i].temperature);
    port.print(F(","));
    port.print(F("\"h\""));
    port.print(F(":"));
    port.print(samples[i].humidity);
    port.print(F(","));
    port.print(F("\"p\""));
    port.print(F(":"));
    port.print(samples[i].pressure);
    port.print(F(","));
    port.print(F("\"l\""));
    port.print(F(":"));
    port.print(samples[i].lux);
    port.print(F(","));
    port.print(F("\"ws\""));
    port.print(F(":"));
    port.print(samples[i].windCyclesPerSecond / (float)ANEMOMETER_CYCLES_PER_LOOP * (float)ANEMOMETER_CIRCUMFERENCE_MTS * (float)ANEMOMETER_SPEED_FACTOR);
    port.print(F(","));
    port.print(F("\"wa\""));
    port.print(F(":"));
    port.print(samples[i].windAngle);
    port.print(F(","));
    port.print(F("\"gs\""));
    port.print(F(":"));
    port.print(samples[i].gustCyclesPerSecond / (float)ANEMOMETER_CYCLES_PER_LOOP * (float)ANEMOMETER_CIRCUMFERENCE_MTS * (float)ANEMOMETER_SPEED_FACTOR);
    port.print(F(","));
    port.print(F("\"ga\""));
    port.print(F(":"));
    port.print(samples[i].gustAngle);
    port.print(F(","));
    port.print(F("\"rmm\""));
    port.print(F(":"));
    port.print((float)samples[i].rainCyclesPerMinute * (float)RAIN_BUCKET_MM_PER_CYCLE);
    port.print(F(","));
    port.print(F("\"ms\""));
    port.print(F(":"));
    port.print(samples[i].sampleMillis);
    port.print(F("}"));
    port.println();
    port.flush();
  }
}

void readCmdFromBluetooth() {
  if (bluetooth.available())
  {
    char c = (char)bluetooth.read();
    if (c == 'R') {
      bluetooth.println(F("RST"));
      bluetooth.flush();
      if (ENABLE_DEBUG_SERIAL_OUTPUT) {
        Serial.println(F("RST"));
        Serial.println(c);
        Serial.flush();
      }
      resetArduino();
    }
    if (c == 'T') {
      timerManager.restartTimer(arduinoAutorebootTimer);
      if (ENABLE_DEBUG_SERIAL_OUTPUT) {
        Serial.println(F("EXT"));
        Serial.flush();
      }
    }
    if (c == 'S') {
      enableSendWindPartialSamples = true;
      if (ENABLE_DEBUG_SERIAL_OUTPUT) {
        Serial.println(F("RT1"));
        Serial.flush();
      }
    }
    if (c == 'Q') {
      enableSendWindPartialSamples = false;
      if (ENABLE_DEBUG_SERIAL_OUTPUT) {
        Serial.println(F("RT0"));
        Serial.flush();
      }
    }
    if (c == 'L') {
      sendFullSamples(bluetooth, avgMinuteSamplesLog, WIND_AVG_MINUTE_LOG_SIZE);
    }
    if (ENABLE_DEBUG_SERIAL_OUTPUT) {
      Serial.println(c);
      Serial.flush();
    }
  }
}


void rebootBluetooth() {
  digitalWrite(BLUETOOTH_PWR_PIN, LOW);
  delay(250);
  digitalWrite(BLUETOOTH_PWR_PIN, HIGH);
  delay(250);
  bluetooth.begin(BLUETOOTH_SERIAL_SPEED);
  delay(500);
  if (ENABLE_DEBUG_SERIAL_OUTPUT) {
    Serial.println(F("BLT"));
  }
}

void blinkStatusLed() {
  analogWrite(STATUS_LED_PIN, statusLedOutputVal);
  statusLedOutputVal = statusLedOutputVal > 0 ? 0 : 255;
}

void resetArduino() {
  if (ENABLE_DEBUG_SERIAL_OUTPUT) {
    Serial.println();
    Serial.println(F("BYE"));
  }
  delay(5000);//watchdog timeout will reset the station
}

void setupPins() {
  pinMode (BLUETOOTH_PWR_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(ANEMOMETER_PIN), countAnemometerCycles, FALLING);
  attachInterrupt(digitalPinToInterrupt(RAINGAUGE_PIN), countRainCycles, FALLING);
}

void initSamplesArrays() {
  for (int i = 0; i < WIND_SAMPLES_SIZE; i++) {
    windSamples[i] = {0};
  }
  for (int c = 0; c < WIND_AVG_MINUTE_LOG_SIZE; c++) {
    avgMinuteSamplesLog[c] = {0};
  }
}


/***********************************************************************
   INTERRUPT FUNCTIONS
***********************************************************************/

void countRainCycles() {
  if (nextTimeRainIterrupt == 0 || nextTimeRainIterrupt < millis()) {
    rainCyclesCounter++;
    nextTimeRainIterrupt = millis() + 100;
  }
}

void countAnemometerCycles() {
  if (nextTimeAnemometerInterrupt == 0 || nextTimeAnemometerInterrupt < millis()) {
    anemometerCyclesCounter++;
    anemometerMinuteCyclesCounter++;
    nextTimeAnemometerInterrupt = millis() + 10;
  }

}

/***********************************************************************
   UTILITY FUNCTIONS
***********************************************************************/

void calcValuesFromWindSamples(WindSample * ws, int windSamplesSize, int & avgWindAngle, float & gustCyclesPerSecond, int & gustAngle) {
  int tempAngles[windSamplesSize] = {0};
  for (int i = 0; i < windSamplesSize; i++) {
    if (ws[i].windCyclesPerSecond >= gustCyclesPerSecond) {
      gustCyclesPerSecond = ws[i].windCyclesPerSecond;
      gustAngle = ws[i].windAngle;
    }
    tempAngles[i] = ws[i].windAngle;
  }
  avgWindAngle = meanAngle(tempAngles, windSamplesSize);
}

/**
  Shift array to the right.
  Element on index 0 goes to 1, 1 to 2,..., latest one goes out,
  First element (index 0) is reseted to 0
*/
void shiftArrayToRight(WindSample* arrayToShift, int arraySize) {
  for (int i = arraySize - 1; i > 0; i--) {
    arrayToShift[i] = arrayToShift[i - 1];
  }
  arrayToShift[0] = {0};
}

/**
  Shift array to the right.
  Element on index 0 goes to 1, 1 to 2,..., latest one goes out,
  First element (index 0) is reseted to 0
*/
void shiftArrayToRight(SensorsSample* arrayToShift, int arraySize) {
  for (int i = arraySize - 1; i > 0; i--) {
    arrayToShift[i] = arrayToShift[i - 1];
  }
  arrayToShift[0] = {0};
}

/**
  return the angle closest to the InputValue reference
*/
int analogToAngleDirection(int adInputValue, int * referenceValues) {
  int angles[] = {
    0/*N*/, 45/*NE*/, 90/*E*/, 135/*SE*/, 180/*S*/, 225/*SW*/, 270/*W*/, 315/*NW*/
  };
  int lowerDiff = 0, angle = 0, i = 0;
  for (i = 0; i < 8; i++) {
    int tempDiff = adInputValue - referenceValues[i];
    tempDiff = abs(tempDiff);
    if (i == 0 || tempDiff < lowerDiff) {
      lowerDiff = tempDiff;
      angle = angles[i];
    }
  }
  return angle;
}

/**
  function to average angles using its cos and sin components,
  (averaging angles by its nominal value (180º, 350º, etc) wouldn't result in a meaningfull value
*/
int meanAngle (int *angles, int size)
{
  double yPart = 0, xPart = 0;
  int i;

  for (i = 0; i < size; i++)
  {
    double angle = (double)angles[i];
    xPart += cos (angle * M_PI / 180);
    yPart += sin (angle * M_PI / 180);
  }
  //if y and x is 0, then the atan2 is undefined, so we return the first angle as average result
  if (yPart == 0 and xPart == 0) {
    return angles[0];
  }
  else {
    double avgAngle =  atan2 (yPart / size, xPart / size) * 180 / M_PI;
    if (avgAngle < 0)
      return (int)(avgAngle + 360);
    else
      return (int)avgAngle;
  }
}

