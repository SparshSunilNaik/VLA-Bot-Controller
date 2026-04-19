import RPi.GPIO as GPIO
import time

RELAY_PIN = 17   # GPIO you connected

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)

GPIO.setup(RELAY_PIN, GPIO.OUT)

print("Relay OFF")
GPIO.output(RELAY_PIN, GPIO.HIGH)   # OFF (active LOW)
time.sleep(2)

print("Relay ON")
GPIO.output(RELAY_PIN, GPIO.LOW)    # ON
time.sleep(2)

print("Relay OFF")
GPIO.output(RELAY_PIN, GPIO.HIGH)

GPIO.cleanup()
print("Test done")
