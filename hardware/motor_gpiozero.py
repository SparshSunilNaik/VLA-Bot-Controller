from gpiozero import Motor

left_motor = Motor(forward=20, backward=16)
right_motor = Motor(forward=5, backward=6)

def forward():
    left_motor.forward()
    right_motor.forward()

def backward():
    left_motor.backward()
    right_motor.backward()

def left():
    left_motor.backward()
    right_motor.forward()

def right():
    left_motor.forward()
    right_motor.backward()

def stop():
    left_motor.stop()
    right_motor.stop()
