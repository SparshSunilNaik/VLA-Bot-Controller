from gpiozero import OutputDevice
import threading, time

IN1 = OutputDevice(21)
IN2 = OutputDevice(26)
IN3 = OutputDevice(23)
IN4 = OutputDevice(24)

SEQ = [
    (1,0,0,0),
    (1,0,1,0),
    (0,0,1,0),
    (0,1,1,0),
    (0,1,0,0),
    (0,1,0,1),
    (0,0,0,1),
    (1,0,0,1),
]

STEP_DELAY = 0.01
STEPS = 400
_running = False

def _apply(s):
    IN1.value, IN2.value, IN3.value, IN4.value = s

def _rotate(direction):
    global _running
    _running = True
    seq = SEQ if direction > 0 else SEQ[::-1]

    for _ in range(STEPS):
        if not _running:
            break
        for s in seq:
            if not _running:
                break
            _apply(s)
            time.sleep(STEP_DELAY)
    stop()

def pan_left():
    threading.Thread(target=_rotate, args=(-1,), daemon=True).start()

def pan_right():
    threading.Thread(target=_rotate, args=(1,), daemon=True).start()

def stepper_stop():
    global _running
    _running = False
    stop()

def stop():
    IN1.off(); IN2.off(); IN3.off(); IN4.off()
