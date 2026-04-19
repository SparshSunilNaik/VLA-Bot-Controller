# ps5_controller.py
# PS5 controller integration (parallel input, safe & edge-triggered)

import pygame
import threading
import time


class PS5Controller:
    def __init__(self, rover_ctrl):
        self.ctrl = rover_ctrl
        self.running = False
        self.thread = None

        # Track previous button states for edge-triggering
        self.prev_buttons = {}

    # ================= START =================
    def start(self):
        pygame.init()
        pygame.joystick.init()

        if pygame.joystick.get_count() == 0:
            print("PS5 controller not detected")
            return

        self.joy = pygame.joystick.Joystick(0)
        self.joy.init()

        self.running = True
        self.thread = threading.Thread(
            target=self.loop,
            daemon=True
        )
        self.thread.start()

        print("PS5 controller started")

    # ================= STOP =================
    def stop(self):
        self.running = False

    # ================= EDGE-TRIGGER HELPER =================
    def pressed_once(self, btn_id):
        current = self.joy.get_button(btn_id)
        prev = self.prev_buttons.get(btn_id, 0)
        self.prev_buttons[btn_id] = current
        return current == 1 and prev == 0

    # ================= MAIN LOOP =================
    def loop(self):
        while self.running:
            pygame.event.pump()

            # ================= LEFT STICK (MOVEMENT) =================
            x = self.joy.get_axis(0)   # left / right
            y = self.joy.get_axis(1)   # up / down

            # Deadzone
            if abs(x) < 0.2:
                x = 0
            if abs(y) < 0.2:
                y = 0

            if y < -0.5:
                self.ctrl.move_forward()
            elif y > 0.5:
                self.ctrl.move_backward()
            elif x < -0.5:
                self.ctrl.move_left()
            elif x > 0.5:
                self.ctrl.move_right()
            else:
                self.ctrl.stop()

            # ================= SPRAY (HOLD) =================
            # R1 ? Fertilizer 1
            # R2 ? Fertilizer 2
            if self.joy.get_button(5):       # R1
                self.ctrl.manual_spray_blur()
            elif self.joy.get_button(7):     # R2
                self.ctrl.manual_spray_mold()

            # ================= SINGLE-PRESS ACTIONS =================

            # OPTIONS ? Emergency stop
            if self.pressed_once(9):
                self.ctrl.emergency()

            # PS ? Reset system
            if self.pressed_once(12):
                self.ctrl.stop()
                self.ctrl.clear_emergency()

            time.sleep(0.05)
