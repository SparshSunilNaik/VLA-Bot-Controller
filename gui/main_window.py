# -*- coding: utf-8 -*-


import sys
from datetime import datetime

from PyQt5.QtWidgets import (
    QWidget, QPushButton,
    QVBoxLayout, QHBoxLayout, QTextEdit,
    QApplication
)
from PyQt5.QtCore import Qt, pyqtSignal

from controller import RoverController
from ps5_controller import PS5Controller





class MainWindow(QWidget):
    # 🔐 THREAD-SAFE LOG SIGNAL
    log_signal = pyqtSignal(str)

    def __init__(self):
        super().__init__()

        # ================= CONTROLLER =================
        self.ctrl = RoverController()
        self.ctrl.on_log = self.log

        # ================= WINDOW =================
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        self.setWindowState(Qt.WindowFullScreen)
        self.setStyleSheet(self.ui_style())
        self.show()



        # ================= LOG =================
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setFixedHeight(120)

        # 🔐 connect signal to GUI-safe slot
        self.log_signal.connect(self._append_log)

        # ================= MOVEMENT (TOUCH & HOLD) =================
        fwd = self.make_hold_button("▲", self.ctrl.move_forward)
        back = self.make_hold_button("▼", self.ctrl.move_backward)
        left = self.make_hold_button("◀", self.ctrl.move_left)
        right = self.make_hold_button("▶", self.ctrl.move_right)



        # ================= SPRAY (TOUCH & HOLD) =================
        spray1 = self.make_hold_button(
            "SPRAY 1", self.ctrl.manual_spray_blur, danger=True
        )
        spray2 = self.make_hold_button(
            "SPRAY 2", self.ctrl.manual_spray_mold, danger=True
        )



        emergency = QPushButton("EMERGENCY STOP")
        emergency.setObjectName("emergency")
        emergency.clicked.connect(self.ctrl.emergency)

        reset = QPushButton("RESET SYSTEM")
        reset.setObjectName("reset")
        reset.clicked.connect(self.ctrl.clear_emergency)

        # ================= CONTROL PANEL =================
        controls = QVBoxLayout()
        controls.setSpacing(10)

        move = QHBoxLayout()
        move.addWidget(left)
        move.addWidget(fwd)
        move.addWidget(back)
        move.addWidget(right)

        spray = QHBoxLayout()
        spray.addWidget(spray1)
        spray.addWidget(spray2)

        controls.addLayout(move)
        controls.addLayout(spray)
        controls.addWidget(emergency)
        controls.addWidget(reset)
        controls.addWidget(self.log_box)

        # ================= MAIN LAYOUT =================
        root = QVBoxLayout(self)
        root.setContentsMargins(20, 20, 20, 20)
        root.setSpacing(15)

        root.addLayout(controls)

        # ================= PS5 CONTROLLER =================
        self.ps5 = PS5Controller(self.ctrl)
        self.ps5.start()

        self.log("System armed")

    # ================= TOUCH & HOLD BUTTON =================
    def make_hold_button(self, text, action, danger=False, stop_action=None):
        btn = QPushButton(text)
        btn.setFixedHeight(70)
        btn.setProperty("danger", danger)

        btn.pressed.connect(action)

        if stop_action is not None:
            btn.released.connect(stop_action)
        else:
            btn.released.connect(self.ctrl.stop)

        return btn



    # ================= THREAD-SAFE LOGGING =================
    def log(self, msg):
        t = datetime.now().strftime("%H:%M:%S")
        self.log_signal.emit(f"[{t}] {msg}")

    def _append_log(self, text):
        self.log_box.append(text)

    # ================= STYLE =================
    def ui_style(self):
        return """
        QWidget { background:#0F172A; color:#E5E7EB; }
        QPushButton {
            background:#1E293B;
            border-radius:14px;
            font-size:18px;
            padding:14px;
        }
        QPushButton:hover { background:#334155; }
        QPushButton[danger="true"] { background:#7C2D12; color:white; }
        QPushButton#emergency {
            background:#B91C1C;
            color:white;
            font-size:22px;
            height:80px;
        }
        QPushButton#reset { background:#0EA5E9; color:black; }
        QTextEdit {
            background:#020617;
            border-radius:12px;
            font-size:13px;
        }
        """

    def closeEvent(self, event):
        self.ps5.stop()
        self.ctrl.emergency()
        event.accept()


def main():
    app = QApplication(sys.argv)
    win = MainWindow()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
