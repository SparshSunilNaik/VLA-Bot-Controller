# ================= SYSTEM =================
RUN_ON_PI = True   # True = Raspberry Pi, False = Laptop (mock)

# ================= DC MOTORS (L298N) =================
# ENA / ENB JUMPERS SHOULD BE USED → DO NOT CONTROL ENABLE FROM PI
IN1 = 5
IN2 = 6

IN3 = 20
IN4 = 16

# ================= RELAYS =================
RELAY_PUMP = 17
RELAY_SOLENOID_1 = 27   # Blight
RELAY_SOLENOID_2 = 22   # Mold

SPRAY_TIME = 10  # seconds

# ================= STEPPER (L298N) =================
STEPPER_PINS = [21, 26, 23, 24]

# ================= SERVOS =================
SERVO_X = 18   # CHANGED (PWM-safe)
SERVO_Y = 13
