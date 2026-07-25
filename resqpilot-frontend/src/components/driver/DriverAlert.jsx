import React, { useState, useEffect } from "react";
import { AlertTriangle, MapPin, Check, X, Navigation, Phone, Activity, CheckCircle2, Siren, Truck } from "lucide-react";
import { useEmergencyStore } from "../../store/useEmergencyStore";
import LiveTrackingMap from "../maps/LiveTrackingMap";
import { io } from "socket.io-client";

// Connect to your production/local backend server via WebSockets
const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", { 
  autoConnect: true 
});
// 5 Mock Ambulances with strategic coordinates and varied triage levels
const INITIAL_AMBULANCES = [
  { id: "amb-1", name: "Ambulance Alpha", lat: 22.7500, lng: 88.5000, triageLevel: 1 },
  { id: "amb-2", name: "Ambulance Bravo", lat: 22.4800, lng: 88.3000, triageLevel: 2 },
  { id: "amb-3", name: "Ambulance Charlie", lat: 22.5800, lng: 88.3700, triageLevel: 3 },
  { id: "amb-4", name: "Ambulance Delta", lat: 22.3000, lng: 88.1500, triageLevel: 2 },
  { id: "amb-5", name: "Ambulance Echo", lat: 22.2500, lng: 88.1000, triageLevel: 1 }
];

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DriverAlert() {
  const store = useEmergencyStore();
  const { activeEmergency, setActiveEmergency, cancelEmergency } = store;
  
  const [ambulances, setAmbulances] = useState(INITIAL_AMBULANCES);
  const [calculatedAmbulances, setCalculatedAmbulances] = useState([]);
  const [selectedAmbulanceId, setSelectedAmbulanceId] = useState(null);
  const [latestPatientCoords, setLatestPatientCoords] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const evaluateAmbulanceSelection = (evaluatedList) => {
    const sortedByDist = [...evaluatedList].sort((a, b) => a.distanceKm - b.distanceKm);
    let chosen = sortedByDist[0];

    for (let i = 1; i < sortedByDist.length; i++) {
      const prev = sortedByDist[i - 1];
      const curr = sortedByDist[i];
      
      const distPrev = prev.distanceKm;
      const distCurr = curr.distanceKm;

      if (distPrev <= distCurr - 10 && distCurr >= 20) {
        chosen = prev;
        break;
      }
    }
    return chosen;
  };

  useEffect(() => {
    socket.on("incoming_emergency_alert", (data) => {
      console.log("Real-time patient dispatch received in DriverAlert:", data);

      if (data && data.locationCoordinates) {
        const patientLat = data.locationCoordinates.latitude;
        const patientLng = data.locationCoordinates.longitude;
        setLatestPatientCoords({ lat: patientLat, lng: patientLng });

        window.alert(`🚨 NEW EMERGENCY DISPATCH RECEIVED!\nPatient: ${data.patientProfile?.name || "Unknown"}\nCoordinates: ${patientLat.toFixed(4)}, ${patientLng.toFixed(4)}`);

        const evaluated = ambulances.map(amb => {
          const distKm = calculateHaversineDistance(amb.lat, amb.lng, patientLat, patientLng);
          return {
            ...amb,
            distanceKm: distKm,
            patientCoords: { lat: patientLat, lng: patientLng }
          };
        });

        setCalculatedAmbulances(evaluated);

        const optimalAmb = evaluateAmbulanceSelection(evaluated);
        if (optimalAmb) {
          setSelectedAmbulanceId(optimalAmb.id);
        }
      }
    });

    return () => {
      socket.off("incoming_emergency_alert");
    };
  }, [ambulances]);

  const fetchOSRMRoute = async (startLat, startLng, endLat, endLng) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();
      if (json.routes && json.routes.length > 0) {
        const coords = json.routes[0].geometry.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
        setRouteCoordinates(coords);
        return coords;
      }
    } catch (err) {
      console.error("Error fetching OSRM route:", err);
    }
    return [];
  };

  const handleRouteToMission = async () => {
    const displayList = calculatedAmbulances.length > 0 ? calculatedAmbulances : ambulances;
    const chosen = displayList.find(a => a.id === selectedAmbulanceId) || displayList[0];
    
    if (!chosen || chosen.distanceKm === undefined) {
      alert("Waiting for an incoming live dispatch from the patient portal to calculate distances.");
      return;
    }

    const patientLat = chosen.patientCoords?.lat || latestPatientCoords?.lat || 22.5726;
    const patientLng = chosen.patientCoords?.lng || latestPatientCoords?.lng || 88.3639;

    const coords = await fetchOSRMRoute(chosen.lat, chosen.lng, patientLat, patientLng);
    
    // Set initial driver position at the start of the route (resting at start)
    const initialPos = coords.length > 0 ? coords[0] : { lat: chosen.lat, lng: chosen.lng };
    useEmergencyStore.setState({ driverPosition: initialPos });

    const missionDetails = {
      id: `emg-${Date.now()}`,
      patientName: "Emergency Patient",
      severity: `LEVEL ${chosen.triageLevel} - CRITICAL`,
      distance: `${chosen.distanceKm.toFixed(1)} km away`,
      eta: `${Math.round(chosen.distanceKm * 2.5)} mins`,
      symptoms: "Critical dispatch report logged via live patient coordinates",
      location: { 
        lat: patientLat, 
        lng: patientLng, 
        address: "Live Dispatched Patient Location" 
      },
      hospital: { name: "Apollo Gleneagles", lat: 22.5780, lng: 88.4100 },
      assignedAmbulance: chosen.name,
      triageLevel: chosen.triageLevel,
      status: "DEPARTED",
      routePoints: coords
    };

    setActiveEmergency(missionDetails);
  };

  // Move ambulance along route based on milestone buttons
  const handleMilestoneUpdate = (statusKey, progressRatio) => {
    if (!activeEmergency) return;
    
    let newPos = activeEmergency.location;
    if (activeEmergency.routePoints && activeEmergency.routePoints.length > 0) {
      const idx = Math.floor(activeEmergency.routePoints.length * progressRatio);
      newPos = activeEmergency.routePoints[Math.min(idx, activeEmergency.routePoints.length - 1)];
    }

    useEmergencyStore.setState({
      activeEmergency: { ...activeEmergency, status: statusKey },
      driverPosition: newPos
    });
  };

  const finishEmergency = () => {
    cancelEmergency();
    setSelectedAmbulanceId(null);
    setCalculatedAmbulances([]);
    setLatestPatientCoords(null);
    setRouteCoordinates([]);
    alert("Emergency completed and logged. Back to available status.");
  };

  // 1. ACTIVE EMERGENCY VIEW WITH 5 MILESTONE BUTTONS
  if (activeEmergency) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Siren className="text-red-500 w-5 h-5 animate-pulse" /> Active Mission
              </h2>
              <span className="text-xs font-bold px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md">
                {activeEmergency.severity}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Patient</span>
                <span className="text-base font-bold">{activeEmergency.patientName}</span>
              </div>
              
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Assigned Unit</span>
                <span className="text-sm font-bold text-teal-600 dark:text-teal-400">{activeEmergency.assignedAmbulance} (Triage Level: {activeEmergency.triageLevel})</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Current Status</span>
                <span className="text-xs font-semibold text-amber-600 uppercase">{activeEmergency.status}</span>
              </div>
            </div>

            {/* Milestone Control Buttons */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ambulance Movement Controls</span>
              
              <button 
                onClick={() => handleMilestoneUpdate("DEPARTED", 0.0)} 
                className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors"
              >
                1. Ambulance Departed (Resting at Start)
              </button>

              <button 
                onClick={() => handleMilestoneUpdate("EN_ROUTE", 0.25)} 
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors"
              >
                2. En Route
              </button>

              <button 
                onClick={() => handleMilestoneUpdate("HALFWAY", 0.50)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors"
              >
                3. Halfway to Route
              </button>

              <button 
                onClick={() => handleMilestoneUpdate("REACHED_PATIENT", 1.0)} 
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors"
              >
                4. Reached Patient
              </button>

              <button 
                onClick={finishEmergency} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors mt-2"
              >
                5. Complete Handover
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-2/3 h-[500px] lg:h-[600px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative z-0">
           <LiveTrackingMap 
             patientLocation={activeEmergency.location} 
             hospitalLocation={activeEmergency.hospital}
             driverLocation={store.driverPosition || { lat: 22.5750, lng: 88.3650 }} 
             status={activeEmergency.status} 
             routeCoordinates={routeCoordinates}
           />
        </div>
      </div>
    );
  }

  // 2. FLEET COMMAND CENTER VIEW
  const displayList = calculatedAmbulances.length > 0 ? calculatedAmbulances : ambulances;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 max-w-4xl mx-auto text-center">
      <div className="relative mb-4">
        <div className="w-20 h-20 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center relative z-10 mx-auto">
          <Activity className="w-8 h-8 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="absolute inset-0 bg-teal-500/20 rounded-full animate-ping z-0" style={{ animationDuration: '3s' }}></div>
      </div>
      
      <h2 className="text-2xl font-bold mb-1">Fleet Command Center (Manual Milestone Tracking)</h2>
      <p className="text-slate-500 max-w-md mb-6 text-sm">
        Waiting for patient dispatches. Ambulance location remains stationary at start until milestone actions are triggered.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full mb-6 text-left">
        {displayList.map((amb) => {
          const isSelected = selectedAmbulanceId === amb.id;
          return (
            <div 
              key={amb.id}
              className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                isSelected 
                  ? "bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-4 ring-teal-500/30 shadow-lg scale-[1.02]" 
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-80"
              }`}
            >
              <div className={`p-2.5 rounded-lg ${isSelected ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                <Truck className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold truncate">{amb.name}</h4>
                  {isSelected && (
                    <span className="text-[10px] bg-teal-600 text-white font-bold px-1.5 py-0.5 rounded shrink-0">AUTO-SELECTED</span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Triage Level: {amb.triageLevel}</p>
                {amb.distanceKm !== undefined ? (
                  <p className="text-xs font-semibold text-teal-600 dark:text-teal-400">Distance: {amb.distanceKm.toFixed(2)} km</p>
                ) : (
                  <p className="text-[11px] text-slate-400">Waiting for live dispatch</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-md">
        <button 
          onClick={handleRouteToMission} 
          className="w-full px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          <Navigation className="w-4 h-4" /> Route to Mission (OSRM Enabled)
        </button>
      </div>

     
    </div>
  );
}