import cv2
import numpy as np
import random

class DiseaseModel:
    def __init__(self):
        # Same labels as final system
        self.labels = ["Healthy", "Blight", "Mold"]

    def preprocess(self, image):
        # Simulate preprocessing
        img = cv2.resize(image, (224, 224))
        img = img / 255.0
        return img

    def predict(self, image):
        """
        MOCK CNN PREDICTION
        (Replace with real TensorFlow model later on Pi / supported Python)
        """
        _ = self.preprocess(image)

        # Simulated intelligent output
        return random.choice(self.labels)
