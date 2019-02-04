#include <stdbool.h>
#include <stdint.h>

#define PIN_LED D7
#define PIN_BTN D3

#define BAUD_RATE 9600
#define LOOP_DELAY 1000
#define BTN_READ_RATE 50

void check_btn_press(void);

bool isLedOn = false;
Timer btnTimer(BTN_READ_RATE, check_btn_press);

void check_btn_press(void) {
  static uint32_t lastHigh = 0;
  uint32_t currentTime = millis();

  if (digitalRead(PIN_BTN) == HIGH) {
    if ((currentTime - lastHigh) > 150) {
      Particle.publish("event_btnPress", PRIVATE);
    }

    lastHigh = currentTime;
  } 
}

void setup_serial(void) {
  Serial.begin(BAUD_RATE);
}

void setup_pins(void) {
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  pinMode(PIN_BTN, INPUT);
}

void set_led_on(void) {
  digitalWrite(PIN_LED, HIGH);
  isLedOn = true;
}

void set_led_off(void) {
  digitalWrite(PIN_LED, LOW);
  isLedOn = false;
}

bool handler_led(String state) {
  Serial.printf("Event triggered! state: %s\n", state.c_str());

  if (state == "ON") {
    set_led_on();
  } else if (state == "OFF") {
    set_led_off();
  } else {
    return false;
  }

  return true;
}

void setup_events(void) {
  // Expose the LED state to the cloud
  Particle.variable("isLedOn", isLedOn);
  // Expose a function to change state
  Particle.function("setLed", handler_led);
}

void setup_timers(void) {
  btnTimer.start();
}

void setup(void) {
  setup_serial();
  setup_pins();
  setup_events();
  setup_timers();
}

void loop(void) {
  Serial.println("looping");
  delay(LOOP_DELAY);
}
