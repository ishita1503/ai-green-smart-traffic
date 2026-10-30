
from pathlib import Path
from datetime import datetime
from threading import Lock

import cv2
import numpy as np
from ultralytics import YOLO

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import (
    create_engine, Column, Integer, Float, String, DateTime
)
from sqlalchemy.orm import declarative_base, sessionmaker


# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = "sqlite:///./traffic.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


class CameraTrafficRecord(Base):
    __tablename__ = "camera_traffic_records"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.now)

    vehicle_count = Column(Integer, nullable=False)
    density = Column(Float, nullable=False)
    signal_status = Column(String, nullable=False)
    detections = Column(Integer, nullable=False)


Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="AI Green Smart Traffic Management System",
    version="2.0.0"
)

# CORS: allow Vite frontend on ports 5173 and 5174.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# YOLO MODEL
# ============================================================

MODEL_PATH = Path(__file__).resolve().parent.parent / "yolov8n.pt"

if not MODEL_PATH.exists():
    raise FileNotFoundError(f"YOLO model not found: {MODEL_PATH}")

model = YOLO(str(MODEL_PATH))
model_lock = Lock()

VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

# Project assumption: 20 vehicles = 100% density.
ROAD_CAPACITY = 20

latest_camera_data = {
    "vehicle_count": 0,
    "density": 0,
    "signal_status": "RED",
    "timestamp": None
}


# ============================================================
# HOME AND HEALTH
# ============================================================

@app.get("/")
def home():
    return {
        "message": "AI Green Smart Traffic Backend is running"
    }


@app.get("/health")
def health():
    return {"status": "online"}


# ============================================================
# YOLO VEHICLE DETECTION
# ============================================================

@app.post("/detect")
async def detect_vehicles(file: UploadFile = File(...)):

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image")

    image_array = np.frombuffer(image_bytes, np.uint8)
    frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image")

    try:
        with model_lock:
            results = model.predict(
                source=frame,
                conf=0.25,
                iou=0.45,
                imgsz=640,
                verbose=False
            )

        detections = []

        for result in results:
            if result.boxes is None:
                continue

            for box in result.boxes:
                class_id = int(box.cls[0])

                if class_id not in VEHICLE_CLASSES:
                    continue

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                detections.append({
                    "vehicle": VEHICLE_CLASSES[class_id],
                    "confidence": round(float(box.conf[0]), 2),
                    "box": [
                        round(float(x1), 2),
                        round(float(y1), 2),
                        round(float(x2), 2),
                        round(float(y2), 2)
                    ]
                })

        return {
            "vehicle_count": len(detections),
            "detections": detections,
            "frame_width": int(frame.shape[1]),
            "frame_height": int(frame.shape[0])
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"YOLO detection failed: {str(error)}"
        )


# ============================================================
# SINGLE CAMERA TRAFFIC UPDATE
# ============================================================

class CameraTrafficData(BaseModel):
    vehicle_count: int = Field(ge=0)
    density: float = Field(ge=0, le=100)
    detections: int = Field(ge=0)


@app.post("/camera-traffic")
def save_camera_traffic(data: CameraTrafficData):

    signal_status = "GREEN" if data.density >= 40 else "RED"

    latest_camera_data.update({
        "vehicle_count": data.vehicle_count,
        "density": data.density,
        "signal_status": signal_status,
        "timestamp": datetime.now().isoformat()
    })

    db = SessionLocal()

    try:
        record = CameraTrafficRecord(
            vehicle_count=data.vehicle_count,
            density=data.density,
            signal_status=signal_status,
            detections=data.detections
        )

        db.add(record)
        db.commit()
        db.refresh(record)

        return {
            "message": "Camera traffic data saved",
            "record_id": record.id,
            "vehicle_count": data.vehicle_count,
            "density": data.density,
            "signal_status": signal_status
        }

    finally:
        db.close()


# ============================================================
# CAMERA SIGNAL STATUS
# ============================================================

@app.get("/camera-signal")
def camera_signal():
    return latest_camera_data


# ============================================================
# CAMERA TRAFFIC HISTORY
# ============================================================

@app.get("/camera-history")
def camera_history():

    db = SessionLocal()

    try:
        records = (
            db.query(CameraTrafficRecord)
            .order_by(CameraTrafficRecord.id.desc())
            .limit(100)
            .all()
        )

        return {
            "total_records": db.query(CameraTrafficRecord).count(),
            "records": [
                {
                    "id": record.id,
                    "timestamp": record.timestamp.isoformat(),
                    "vehicle_count": record.vehicle_count,
                    "density": record.density,
                    "signal_status": record.signal_status,
                    "detections": record.detections
                }
                for record in records
            ]
        }

    finally:
        db.close()


# ============================================================
# CAMERA ANALYTICS
# ============================================================

@app.get("/camera-analytics")
def camera_analytics():

    db = SessionLocal()

    try:
        records = db.query(CameraTrafficRecord).all()

        if not records:
            return {
                "total_records": 0,
                "total_vehicles_processed": 0,
                "average_density": 0,
                "average_waiting_time_seconds": 0,
                "estimated_fuel_saved_litres": 0,
                "estimated_co2_reduction_kg": 0
            }

        total_vehicles = sum(r.vehicle_count for r in records)
        average_density = sum(r.density for r in records) / len(records)

        # Estimates based on project assumptions.
        estimated_waiting = round(average_density * 0.6, 2)
        estimated_fuel = round(total_vehicles * 0.002, 2)
        estimated_co2 = round(estimated_fuel * 2.31, 2)

        return {
            "total_records": len(records),
            "total_vehicles_processed": total_vehicles,
            "average_density": round(average_density, 2),
            "average_waiting_time_seconds": estimated_waiting,
            "estimated_fuel_saved_litres": estimated_fuel,
            "estimated_co2_reduction_kg": estimated_co2,
            "note": "Fuel, CO2 and waiting values are project estimates."
        }

    finally:
        db.close()


# ============================================================
# LEGACY FOUR-DIRECTION API
# ============================================================

latest_signal = {
    "North": "RED",
    "South": "RED",
    "East": "RED",
    "West": "RED",
    "active_direction": "None",
    "green_time": 0
}


class TrafficData(BaseModel):
    north_vehicles: int
    south_vehicles: int
    east_vehicles: int
    west_vehicles: int

    north_density: float
    south_density: float
    east_density: float
    west_density: float

    north_waiting: float
    south_waiting: float
    east_waiting: float
    west_waiting: float

    north_emergency: bool = False
    south_emergency: bool = False
    east_emergency: bool = False
    west_emergency: bool = False


def calculate_green_time(density: float, waiting_time: float):
    score = density * 0.7 + waiting_time * 0.3
    return max(15, min(round(15 + (score / 100) * 45), 60))


@app.post("/traffic")
def receive_traffic(data: TrafficData):

    green_times = {
        "North": calculate_green_time(data.north_density, data.north_waiting),
        "South": calculate_green_time(data.south_density, data.south_waiting),
        "East": calculate_green_time(data.east_density, data.east_waiting),
        "West": calculate_green_time(data.west_density, data.west_waiting)
    }

    scores = {
        "North": data.north_density * 0.7 + data.north_waiting * 0.3,
        "South": data.south_density * 0.7 + data.south_waiting * 0.3,
        "East": data.east_density * 0.7 + data.east_waiting * 0.3,
        "West": data.west_density * 0.7 + data.west_waiting * 0.3
    }

    emergency = {
        "North": data.north_emergency,
        "South": data.south_emergency,
        "East": data.east_emergency,
        "West": data.west_emergency
    }

    emergency_direction = next(
        (direction for direction, active in emergency.items() if active),
        None
    )

    priority = emergency_direction or max(scores, key=scores.get)

    for direction in ["North", "South", "East", "West"]:
        latest_signal[direction] = "RED"

    latest_signal[priority] = "GREEN"
    latest_signal["active_direction"] = priority
    latest_signal["green_time"] = green_times[priority]

    return {
        "priority_direction": priority,
        "priority_scores": scores,
        "green_times": green_times
    }


@app.get("/signal-status")
def signal_status():
    return latest_signal


class ManualOverride(BaseModel):
    direction: str


@app.post("/manual-override")
def manual_override(data: ManualOverride):

    direction = data.direction.capitalize()

    if direction not in ["North", "South", "East", "West"]:
        raise HTTPException(status_code=400, detail="Invalid direction")

    for item in ["North", "South", "East", "West"]:
        latest_signal[item] = "RED"

    latest_signal[direction] = "GREEN"
    latest_signal["active_direction"] = direction
    latest_signal["green_time"] = 30

    return {
        "message": "Manual signal override activated",
        "signal_status": latest_signal
    }
