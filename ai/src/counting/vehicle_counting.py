
def count_vehicles(detections):
    """Count detected vehicles by type."""
    counts = {
        "car": 0,
        "motorcycle": 0,
        "bus": 0,
        "truck": 0,
    }

    for item in detections:
        vehicle = item.get("vehicle")
        if vehicle in counts:
            counts[vehicle] += 1

    return {
        "total": sum(counts.values()),
        "by_type": counts,
    }
