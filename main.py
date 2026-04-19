import sys
from PyQt5.QtWidgets import QApplication
from gui.main_window import MainWindow

app = QApplication(sys.argv)

window = MainWindow()   # fullscreen handled inside class

sys.exit(app.exec_())
