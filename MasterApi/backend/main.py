from fastapi import FastAPI, APIRouter
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

class AmbulanceCallModel(BaseModel):
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS Longitude")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS Latitude")
    contact: str = Field(..., description="Emergency contact number")
    description: str = ""
    triage_level: int = Field(0, description="Severity level (e.g., 0-5)")


app = FastAPI(title="ResQPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

master_router = APIRouter(prefix="/master", tags=["Master"])

@app.get("/", include_in_schema=False)
def redirect_to_master():
    return RedirectResponse(url="/master")

@master_router.get("/")
def home():
    return {
        "message": "ResQPilot Backend Running 🚑"
    }

@master_router.post("/call_ambulance")
def call_ambulance(ambulance_details: AmbulanceCallModel):
    return {
        "longitude": ambulance_details.longitude,
        "latitude": ambulance_details.latitude,
        "ambulance_type": ambulance_details.triage_level,
        "contact_received": ambulance_details.contact,
        "status": "Dispatch initiated"
    }

# Register the router with the main app
app.include_router(master_router)