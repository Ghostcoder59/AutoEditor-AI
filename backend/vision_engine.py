import cv2
import numpy as np
import os
from ultralytics import YOLO

class VisionEngine:
    def __init__(self, model_name="yolov8n.pt"):
        """
        Initializes the YOLOv8 model (uses the nano version by default for speed).
        """
        self.model = YOLO(model_name)
        # We track 'person', 'sports ball', 'baseball bat', 'tennis racket', etc.
        # Check ultralytics/cfg/datasets/coco8.yaml for full list
        self.target_indices = [0, 32, 34, 38] # person, sports ball, etc.

    def get_action_center(self, frame):
        """
        Detects objects in the frame and returns the weighted center (x, y) of action.
        """
        results = self.model(frame, verbose=False)[0]
        boxes = results.boxes.data.cpu().numpy() # [x1, y1, x2, y2, conf, cls]
        
        centers = []
        confidences = []
        
        for box in boxes:
            x1, y1, x2, y2, conf, cls = box
            if int(cls) in self.target_indices:
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                centers.append((center_x, center_y))
                confidences.append(conf)
        
        if not centers:
            return None, 0
            
        # Geometric center weighted by confidence
        avg_x = sum(c[0] * w for c, w in zip(centers, confidences)) / sum(confidences)
        avg_y = sum(c[1] * w for c, w in zip(centers, confidences)) / sum(confidences)
        
        return (avg_x, avg_y), max(confidences)

    def calculate_crop_box(self, center_x, center_y, frame_w, frame_h, target_ratio=9/16):
        """
        Calculates the 9:16 crop box based on a target center point.
        """
        # Calculate target dimensions
        # If original is 16:9, we want a 9:16 slice from the center
        target_w = int(frame_h * target_ratio)
        target_h = frame_h
        
        # Ensure we don't go out of bounds
        x_min = int(center_x - target_w / 2)
        x_max = x_min + target_w
        
        if x_min < 0:
            x_min = 0
            x_max = target_w
        elif x_max > frame_w:
            x_max = frame_w
            x_min = frame_w - target_w
            
        return x_min, 0, x_max, target_h

class SmoothingBuffer:
    def __init__(self, window_size=30):
        self.window_size = window_size
        self.buffer = []

    def smooth(self, value):
        self.buffer.append(value)
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)
        return np.mean(self.buffer)
