
def calculate_density(total_vehicles, low_limit=5, medium_limit=15):
    """Classify traffic density based on vehicle count."""

    if total_vehicles <= low_limit:
        return "Low"

    elif total_vehicles <= medium_limit:
        return "Medium"

    else:
        return "High"
