# vision/detector.py

class PlantDiseaseDetector:
    def __init__(self):
        global torch, model, transforms, classes

        # Lazy imports
        if 'torch' not in globals():
            import torch
            import json
            import torchvision.transforms as transforms
            from torchvision.models import resnet18

            globals()['torch'] = torch
            globals()['transforms'] = transforms

            # Load model
            model = resnet18(weights=None)
            model.fc = torch.nn.Linear(512, 38)

            state = torch.load("finetuned_resnet.pth", map_location="cpu")
            model.load_state_dict(state)
            model.eval()

            globals()['model'] = model

            # Load class labels (LIST)
            with open("classes.json", "r") as f:
                classes = json.load(f)

            globals()['classes'] = classes

        self.model = globals()['model']
        self.transforms = globals()['transforms']
        self.classes = globals()['classes']
        self.torch = globals()['torch']

    def predict(self, image):
        transform = self.transforms.Compose([
            self.transforms.Resize((224, 224)),
            self.transforms.ToTensor(),
            self.transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])

        tensor = transform(image).unsqueeze(0)

        with self.torch.no_grad():
            output = self.model(tensor)
            probs = self.torch.softmax(output, dim=1)
            conf, idx = probs.max(1)

        label = self.classes[idx.item()]
        confidence = conf.item()

        return label, confidence
