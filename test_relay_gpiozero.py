from gpiozero import DigitalOutputDevice
from time import sleep

# GPIO 17, active LOW relay
relay = DigitalOutputDevice(17, active_high=False, initial_value=False)

print("Relay OFF")
sleep(2)

print("Relay ON")
relay.on()
sleep(2)

print("Relay OFF")
relay.off()

print("Test done")
