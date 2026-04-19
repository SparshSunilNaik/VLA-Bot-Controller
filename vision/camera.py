import cv2

class Camera:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)

    def get_frame(self):
        ret, frame = self.cap.read()
        if ret:
            return cv2.resize(frame, (640, 480))
        return None
