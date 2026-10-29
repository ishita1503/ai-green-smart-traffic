from ultralytics import YOLO

VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}


def load_model():
    """Load the pretrained YOLO model."""
    return YOLO("yolov8n.pt")


def detect_vehicles(frame, model):
    """Detect vehicles in an image or video frame."""
    results = model.predict(
        frame,
        conf=0.40,
        iou=0.45,
        verbose=False
    )

    detections = []

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])

            if class_id not in VEHICLE_CLASSES:
                continue

            confidence = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            detections.append({
                "vehicle": VEHICLE_CLASSES[class_id],
                "confidence": round(confidence, 2),
                "box": [x1, y1, x2, y2],
            })

    annotated_frame = results[0].plot()

    return annotated_frame, len(detections), detections
