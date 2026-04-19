from config import RUN_ON_PI

if RUN_ON_PI:
    # -------- REAL HARDWARE --------
    from hardware.motor_gpiozero import *
    from hardware.relay_gpiozero import *
    from hardware.stepper_gpiozero import *
    from hardware.servo_spray import *

    # -------- CAMERA ↔ SPRAY COMPENSATION --------
    def servo_x_plus():
        spray_left()     # camera right → spray left

    def servo_x_minus():
        spray_right()    # camera left → spray right

    def servo_y_up():
        spray_up()

    def servo_y_down():
        spray_down()

    def emergency_stop():
        stop()                 # DC motors
        stepper_stop()         # stepper
        stop_spray_motion()    # servos
        spray_stop()           # relays

else:
    # -------- MOCK MODE --------
    from hardware.mock_gpio import *

    def servo_x_plus():
        print("[MOCK] servo x +")

    def servo_x_minus():
        print("[MOCK] servo x -")

    def servo_y_up():
        print("[MOCK] servo y up")

    def servo_y_down():
        print("[MOCK] servo y down")

    def emergency_stop():
        print("[MOCK] EMERGENCY STOP")
