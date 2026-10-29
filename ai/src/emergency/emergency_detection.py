
def detect_emergency(detections):
    """Check whether an emergency vehicle is detected."""

    emergency_vehicles = [
        "ambulance",
        "fire_truck",
        "police_car",
    ]

    detected = []

    for item in detections:
        vehicle = item.get("vehicle", "").lower()

        if vehicle in emergency_vehicles:
            detected.append(vehicle)

    return {
        "emergency_detected": len(detected) > 0,
        "emergency_vehicles": detected,
        "count": len(detected),
    }
