from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, Float, Boolean, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime


# ============================================================
# SQLITE DATABASE
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


# ============================================================
# TRAFFIC DATABASE TABLE
# ============================================================

class TrafficRecord(Base):

    __tablename__ = "traffic_records"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

    # --------------------------------------------------------
    # Vehicle counts
    # --------------------------------------------------------

    north_vehicles = Column(Integer)
    south_vehicles = Column(Integer)
    east_vehicles = Column(Integer)
    west_vehicles = Column(Integer)

    # --------------------------------------------------------
    # Traffic density
    # --------------------------------------------------------

    north_density = Column(Float)
    south_density = Column(Float)
    east_density = Column(Float)
    west_density = Column(Float)

    # --------------------------------------------------------
    # Waiting time
    # --------------------------------------------------------

    north_waiting = Column(Float)
    south_waiting = Column(Float)
    east_waiting = Column(Float)
    west_waiting = Column(Float)

    # --------------------------------------------------------
    # Emergency vehicle status
    # --------------------------------------------------------

    north_emergency = Column(
        Boolean,
        default=False
    )

    south_emergency = Column(
        Boolean,
        default=False
    )

    east_emergency = Column(
        Boolean,
        default=False
    )

    west_emergency = Column(
        Boolean,
        default=False
    )

    # --------------------------------------------------------
    # Signal decision
    # --------------------------------------------------------

    priority_direction = Column(String)

    green_time = Column(Integer)


# Create database table
Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="AI Green Smart Traffic Management System",
    description="Backend API for adaptive traffic signal management",
    version="1.0.0"
)


# ============================================================
# LATEST SIGNAL STATUS
# ============================================================

latest_signal = {

    "North": "RED",

    "South": "RED",

    "East": "RED",

    "West": "RED",

    "active_direction": "None",

    "green_time": 0
}


# ============================================================
# TRAFFIC DATA MODEL
# ============================================================

class TrafficData(BaseModel):

    # Vehicle counts
    north_vehicles: int
    south_vehicles: int
    east_vehicles: int
    west_vehicles: int

    # Traffic density
    north_density: float
    south_density: float
    east_density: float
    west_density: float

    # Waiting time
    north_waiting: float
    south_waiting: float
    east_waiting: float
    west_waiting: float

    # Emergency vehicles
    north_emergency: bool = False
    south_emergency: bool = False
    east_emergency: bool = False
    west_emergency: bool = False


# ============================================================
# HOME API
# ============================================================

@app.get("/")
def home():

    return {
        "message":
        "AI Green Smart Traffic Backend is running"
    }


# ============================================================
# HEALTH API
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "online"
    }


# ============================================================
# GREEN TIME CALCULATION
# ============================================================

def calculate_green_time(
    density: float,
    waiting_time: float
):

    MIN_GREEN = 15
    MAX_GREEN = 60

    # Priority score
    priority_score = (
        density * 0.7
        + waiting_time * 0.3
    )

    # Convert priority score to green time
    green_time = MIN_GREEN + (
        priority_score / 100
    ) * (
        MAX_GREEN - MIN_GREEN
    )

    green_time = round(
        green_time
    )

    # Keep green time between 15 and 60 seconds
    return max(
        MIN_GREEN,
        min(
            green_time,
            MAX_GREEN
        )
    )


# ============================================================
# TRAFFIC API
# ============================================================

@app.post("/traffic")
def receive_traffic(
    data: TrafficData
):

    # Open database connection
    db = SessionLocal()

    # --------------------------------------------------------
    # Calculate Green Times
    # --------------------------------------------------------

    green_times = {

        "North":
        calculate_green_time(
            data.north_density,
            data.north_waiting
        ),

        "South":
        calculate_green_time(
            data.south_density,
            data.south_waiting
        ),

        "East":
        calculate_green_time(
            data.east_density,
            data.east_waiting
        ),

        "West":
        calculate_green_time(
            data.west_density,
            data.west_waiting
        )
    }

    # --------------------------------------------------------
    # Calculate Priority Scores
    # --------------------------------------------------------

    priority_scores = {

        "North":
        (
            data.north_density * 0.7
            + data.north_waiting * 0.3
        ),

        "South":
        (
            data.south_density * 0.7
            + data.south_waiting * 0.3
        ),

        "East":
        (
            data.east_density * 0.7
            + data.east_waiting * 0.3
        ),

        "West":
        (
            data.west_density * 0.7
            + data.west_waiting * 0.3
        )
    }

    # --------------------------------------------------------
    # Emergency Vehicle Priority
    # --------------------------------------------------------

    emergency_directions = {

        "North":
        data.north_emergency,

        "South":
        data.south_emergency,

        "East":
        data.east_emergency,

        "West":
        data.west_emergency
    }

    emergency_direction = next(

        (
            direction

            for direction, emergency
            in emergency_directions.items()

            if emergency
        ),

        None
    )

    # --------------------------------------------------------
    # Select Priority Direction
    # --------------------------------------------------------

    if emergency_direction:

        # Emergency vehicle gets priority
        priority_direction = (
            emergency_direction
        )

    else:

        # Highest priority gets GREEN
        priority_direction = max(
            priority_scores,
            key=priority_scores.get
        )

    # --------------------------------------------------------
    # Update Signal Status
    # --------------------------------------------------------

    latest_signal["North"] = "RED"

    latest_signal["South"] = "RED"

    latest_signal["East"] = "RED"

    latest_signal["West"] = "RED"

    latest_signal[
        priority_direction
    ] = "GREEN"

    latest_signal[
        "active_direction"
    ] = priority_direction

    latest_signal[
        "green_time"
    ] = green_times[
        priority_direction
    ]

    # --------------------------------------------------------
    # SAVE TRAFFIC RECORD
    # --------------------------------------------------------

    record = TrafficRecord(

        # Vehicle counts
        north_vehicles=data.north_vehicles,

        south_vehicles=data.south_vehicles,

        east_vehicles=data.east_vehicles,

        west_vehicles=data.west_vehicles,

        # Density
        north_density=data.north_density,

        south_density=data.south_density,

        east_density=data.east_density,

        west_density=data.west_density,

        # Waiting time
        north_waiting=data.north_waiting,

        south_waiting=data.south_waiting,

        east_waiting=data.east_waiting,

        west_waiting=data.west_waiting,

        # Emergency status
        north_emergency=data.north_emergency,

        south_emergency=data.south_emergency,

        east_emergency=data.east_emergency,

        west_emergency=data.west_emergency,

        # Decision
        priority_direction=priority_direction,

        green_time=green_times[
            priority_direction
        ]
    )

    db.add(record)

    db.commit()

    db.refresh(record)

    db.close()

    # --------------------------------------------------------
    # RETURN RESULT
    # --------------------------------------------------------

    return {

        "message":
        "Adaptive traffic decision calculated successfully",

        "traffic_data":
        data,

        "priority_scores":
        priority_scores,

        "green_times":
        green_times,

        "priority_direction":
        priority_direction,

        "database_record_id":
        record.id
    }


# ============================================================
# SIGNAL STATUS API
# ============================================================

@app.get("/signal-status")
def signal_status():

    return latest_signal


# ============================================================
# MANUAL SIGNAL OVERRIDE
# ============================================================

class ManualOverride(BaseModel):

    direction: str


@app.post("/manual-override")
def manual_override(
    data: ManualOverride
):

    direction = (
        data.direction.capitalize()
    )

    # --------------------------------------------------------
    # Validate Direction
    # --------------------------------------------------------

    if direction not in [

        "North",
        "South",
        "East",
        "West"

    ]:

        return {

            "error":
            "Invalid direction. Use North, South, East, or West."
        }

    # --------------------------------------------------------
    # Set All Directions RED
    # --------------------------------------------------------

    latest_signal["North"] = "RED"

    latest_signal["South"] = "RED"

    latest_signal["East"] = "RED"

    latest_signal["West"] = "RED"

    # --------------------------------------------------------
    # Set Selected Direction GREEN
    # --------------------------------------------------------

    latest_signal[
        direction
    ] = "GREEN"

    latest_signal[
        "active_direction"
    ] = direction

    latest_signal[
        "green_time"
    ] = 30

    # --------------------------------------------------------
    # Return Result
    # --------------------------------------------------------

    return {

        "message":
        "Manual signal override activated",

        "active_direction":
        direction,

        "signal_status":
        latest_signal
    }


# ============================================================
# TRAFFIC HISTORY API
# ============================================================

@app.get("/traffic-history")
def traffic_history():

    db = SessionLocal()

    # --------------------------------------------------------
    # Get all records
    # --------------------------------------------------------

    records = (
        db.query(TrafficRecord)
        .order_by(
            TrafficRecord.id.desc()
        )
        .all()
    )

    result = []

    # --------------------------------------------------------
    # Convert database records to JSON
    # --------------------------------------------------------

    for record in records:

        result.append({

            "id":
            record.id,

            "timestamp":
            record.timestamp,

            # Vehicle counts
            "north_vehicles":
            record.north_vehicles,

            "south_vehicles":
            record.south_vehicles,

            "east_vehicles":
            record.east_vehicles,

            "west_vehicles":
            record.west_vehicles,

            # Density
            "north_density":
            record.north_density,

            "south_density":
            record.south_density,

            "east_density":
            record.east_density,

            "west_density":
            record.west_density,

            # Waiting time
            "north_waiting":
            record.north_waiting,

            "south_waiting":
            record.south_waiting,

            "east_waiting":
            record.east_waiting,

            "west_waiting":
            record.west_waiting,

            # Emergency
            "north_emergency":
            record.north_emergency,

            "south_emergency":
            record.south_emergency,

            "east_emergency":
            record.east_emergency,

            "west_emergency":
            record.west_emergency,

            # Signal decision
            "priority_direction":
            record.priority_direction,

            "green_time":
            record.green_time
        })

    db.close()

    return {

        "total_records":
        len(result),

        "records":
        result
    }


# ============================================================
# ANALYTICS API
# ============================================================

@app.get("/analytics")
def analytics():

    db = SessionLocal()

    # --------------------------------------------------------
    # Get all traffic records
    # --------------------------------------------------------

    records = (
        db.query(TrafficRecord)
        .all()
    )

    # --------------------------------------------------------
    # No records available
    # --------------------------------------------------------

    if not records:

        db.close()

        return {

            "message":
            "No traffic data available for analytics"
        }

    # --------------------------------------------------------
    # Initialize calculations
    # --------------------------------------------------------

    total_vehicles = 0

    total_waiting_time = 0

    total_vehicle_waiting = 0

    # --------------------------------------------------------
    # Process each traffic record
    # --------------------------------------------------------

    for record in records:

        # Total vehicles in this record
        vehicles = (

            (record.north_vehicles or 0)

            + (record.south_vehicles or 0)

            + (record.east_vehicles or 0)

            + (record.west_vehicles or 0)
        )

        total_vehicles += vehicles

        # Average waiting time for four directions
        average_waiting = (

            (record.north_waiting or 0)

            + (record.south_waiting or 0)

            + (record.east_waiting or 0)

            + (record.west_waiting or 0)

        ) / 4

        total_waiting_time += (
            average_waiting
        )

        # Vehicle waiting measure
        total_vehicle_waiting += (

            vehicles
            * average_waiting
        )

    # --------------------------------------------------------
    # Average waiting time
    # --------------------------------------------------------

    average_waiting_time = (

        total_waiting_time
        / len(records)
    )

    # --------------------------------------------------------
    # Estimated fuel saving
    # --------------------------------------------------------
    #
    # Project assumption:
    #
    # 0.002 litres of fuel saved
    # per vehicle for every minute
    # of waiting-time reduction.
    #
    # This is an academic/project estimate.
    # --------------------------------------------------------

    estimated_fuel_saved = (

        total_vehicle_waiting
        * 0.002
    )

    # --------------------------------------------------------
    # Estimated CO2 reduction
    # --------------------------------------------------------
    #
    # Approximate emission factor:
    #
    # 2.31 kg CO2 per litre of petrol.
    # --------------------------------------------------------

    estimated_co2_reduction = (

        estimated_fuel_saved
        * 2.31
    )

    db.close()

    # --------------------------------------------------------
    # Return analytics
    # --------------------------------------------------------

    return {

        "total_records":
        len(records),

        "total_vehicles_processed":
        total_vehicles,

        "average_waiting_time_minutes":
        round(
            average_waiting_time,
            2
        ),

        "estimated_fuel_saved_litres":
        round(
            estimated_fuel_saved,
            2
        ),

        "estimated_co2_reduction_kg":
        round(
            estimated_co2_reduction,
            2
        ),

        "note":
        "Fuel and CO2 values are estimated using project assumptions, not direct sensor measurements."
    }