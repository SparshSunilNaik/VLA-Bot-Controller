# controller.py
# Hardware-accurate controller for L298N + Pumps

from gpiozero import Motor, DigitalOutputDevice


class RoverController:
    def __init__(self):
        self.on_log = None
        self.emergency_active = False

        # ================= DC MOTORS (L298N) =================
        self.left_motor = Motor(forward=16, backward=20)
        self.right_motor = Motor(forward=5, backward=6)

        # ================= PUMP & SOLENOIDS (ACTIVE LOW) =================
        self.pump = DigitalOutputDevice(17, active_high=False)
        self.blur = DigitalOutputDevice(27, active_high=False)
        self.mold = DigitalOutputDevice(22, active_high=False)

    # ================= LOG =================
    def log(self, msg):
        if self.on_log:
            self.on_log(msg)

    def check_emergency(self):
        return self.emergency_active

    # ================= DC MOTOR CONTROL =================
    def move_forward(self):
        if self.check_emergency(): return
        self.left_motor.forward()
        self.right_motor.forward()
        self.log("Move forward")

    def move_backward(self):
        if self.check_emergency(): return
        self.left_motor.backward()
        self.right_motor.backward()
        self.log("Move backward")

    def move_left(self):
        if self.check_emergency(): return
        self.left_motor.backward()
        self.right_motor.forward()
        self.log("Turn left")

    def move_right(self):
        if self.check_emergency(): return
        self.left_motor.forward()
        self.right_motor.backward()
        self.log("Turn right")

    def stop(self):
        self.left_motor.stop()
        self.right_motor.stop()

        self.pump.off()
        self.blur.off()
        self.mold.off()
        self.log("All stopped")



    # ================= SPRAY CONTROL =================
    def manual_spray_blur(self):
        if self.check_emergency(): return
        self.pump.on()
        self.blur.on()
        self.log("Spraying Fertilizer 1 (Blight)")

    def manual_spray_mold(self):
        if self.check_emergency(): return
        self.pump.on()
        self.mold.on()
        self.log("Spraying Fertilizer 2 (Mold)")

    # ================= SAFETY =================
    def emergency(self):
        self.emergency_active = True
        self.stop()
        self.log("!!! EMERGENCY STOP !!!")

    def clear_emergency(self):
        self.emergency_active = False
        self.log("System reset & armed")
