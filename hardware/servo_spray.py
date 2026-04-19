from gpiozero import Servo
import threading
import time

# ================= SERVO OBJECTS =================
servo_x = Servo(12)   # left / right spray
servo_y = Servo(13)   # up / down spray

# ================= INTERNAL STATE =================
_sweep_thread = None
_sweep_running = False

# ================= X AXIS =================
def spray_left():
    servo_x.value = -0.6

def spray_right():
    servo_x.value = 0.6

def spray_center_x():
    servo_x.value = 0

# ================= Y AXIS =================
def spray_up():
    servo_y.value = -0.6

def spray_down():
    servo_y.value = 0.6

def spray_center_y():
    servo_y.value = 0

# ================= AUTO SWEEP =================
def start_spray_motion():
    global _sweep_running, _sweep_thread

    if _sweep_running:
        return

    _sweep_running = True

    def sweep_loop():
        while _sweep_running:
            servo_y.value = -0.6   # up
            time.sleep(0.6)
            servo_y.value = 0.6    # down
            time.sleep(0.6)
            servo_y.value = 0.0    # center
            time.sleep(0.4)

    _sweep_thread = threading.Thread(target=sweep_loop, daemon=True)
    _sweep_thread.start()

def stop_spray_motion():
    global _sweep_running
    _sweep_running = False
    spray_center_x()
    spray_center_y()
