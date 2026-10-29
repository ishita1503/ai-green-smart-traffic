
from pathlib import Path
import sys
import cv2

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent.parent

sys.path.insert(0, str(BASE_DIR / "detection"))
sys.path.insert(0, str(BASE_DIR / "counting"))
sys.path.insert(0, str(BASE_DIR / "density"))
sys.path.insert(0, str(BASE_DIR / "emergency"))

from vehicle_detection import load_model, detect_vehicles
from vehicle_counting import count_vehicles
from traffic_density import calculate_density
from emergency_detection import detect_emergency


IMAGE_PATH = PROJECT_DIR / "ai" / "test" / "traffic.png"
OUTPUT_PATH = PROJECT_DIR / "ai" / "test" / "traffic_detected.png"


def main():
    image = cv2.imread(str(IMAGE_PATH))

    if image is None:
        print("Error: traffic.png image not found.")
        return

    print("Loading YOLO model...")
    model = load_model()

    annotated_image, _, detections = detect_vehicles(image, model)

    counts = count_vehicles(detections)
    density = calculate_density(counts["total"])
    emergency = detect_emergency(detections)

    cv2.imwrite(str(OUTPUT_PATH), annotated_image)

    print("\n--- TRAFFIC ANALYSIS ---")
    print("Total vehicles:", counts["total"])
    print("Vehicle counts:", counts["by_type"])
    print("Traffic density:", density)
    print("Emergency detected:", emergency["emergency_detected"])
    print("Output image:", OUTPUT_PATH)


if __name__ == "__main__":
    main()
