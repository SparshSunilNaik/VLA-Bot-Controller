
from gpiozero import DigitalOutputDevice

pump = DigitalOutputDevice(17, active_high=False)
blur = DigitalOutputDevice(27, active_high=False)
mold = DigitalOutputDevice(22, active_high=False)

def spray_blur():
    pump.on()
    blur.on()

def spray_mold():
    pump.on()
    mold.on()

def spray_stop():
    blur.off()
    mold.off()
    pump.off()
