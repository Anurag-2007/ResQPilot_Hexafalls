import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, Clock, Truck, AlertTriangle, CheckCircle2, Bed, 
  Thermometer, ChevronDown, ChevronUp, Plus, Minus, User, 
  Phone, ShieldAlert, HeartPulse, Stethoscope, Sparkles,
  Zap, ToggleLeft, ToggleRight, Building2, Check, X, Navigation, MapPin,
  BedSingle
} from "lucide-react";
import { useEmergencyStore } from "../../store/useEmergencyStore";
import { io } from "socket.io-client";

// Connect to backend server via WebSockets
const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", { 
  autoConnect: true 
});

// Identical Mock Ambulances Database from DriverAlert.jsx
const INITIAL_AMBULANCES = [
  { id: "amb-1", name: "Ambulance Alpha", lat: 22.7500, lng: 88.5000, triageLevel: 1 },
  { id: "amb-2", name: "Ambulance Bravo", lat: 22.4800, lng: 88.3000, triageLevel: 2 },
  { id: "amb-3", name: "Ambulance Charlie", lat: 22.5800, lng: 88.3700, triageLevel: 3 },
  { id: "amb-4", name: "Ambulance Delta", lat: 22.3000, lng: 88.1500, triageLevel: 2 },
  { id: "amb-5", name: "Ambulance Echo", lat: 22.2500, lng: 88.1000, triageLevel: 1 }
];

// Initial Mock Hospitals Database
const INITIAL_HOSPITALS = [
  {
    id: "hosp-1",
    name: "Apollo Gleneagles Hospital",
    address: "54 Canal Circular Rd, Kolkata",
    lat: 22.5780,
    lng: 88.4100,
    distanceKm: null,
    etaMins: null,
    wardBudget: 450,
    icuBeds: 4,
    icuActive: true,
    cardiologyDept: 1,
    neurologyDept: 1
  },
  {
    id: "hosp-2",
    name: "Fortis Hospital Anandapur",
    address: "730 Anandapur, EM Bypass, Kolkata",
    lat: 22.5180,
    lng: 88.4050,
    distanceKm: null,
    etaMins: null,
    wardBudget: 350,
    icuBeds: 2,
    icuActive: true,
    cardiologyDept: 1,
    neurologyDept: 0
  },
  {
    id: "hosp-3",
    name: "AMRI Hospitals Salt Lake",
    address: "JC Block, Sector III, Salt Lake, Kolkata",
    lat: 22.5850,
    lng: 88.4020,
    distanceKm: null,
    etaMins: null,
    wardBudget: 300,
    icuBeds: 0,
    icuActive: false,
    cardiologyDept: 0,
    neurologyDept: 1
  },
  {
    id: "hosp-4",
    name: "Peerless Hospital",
    address: "360 Panchasayar, Garia, Kolkata",
    lat: 22.4850,
    lng: 88.3900,
    distanceKm: null,
    etaMins: null,
    wardBudget: 400,
    icuBeds: 6,
    icuActive: true,
    cardiologyDept: 1,
    neurologyDept: 1
  },
  {
    id: "hosp-5",
    name: "SSKM Medical College & Hospital",
    address: "244 AJC Bose Rd, Bhowanipore, Kolkata",
    lat: 22.5410,
    lng: 88.3440,
    distanceKm: null,
    etaMins: null,
    wardBudget: 200,
    icuBeds: 3,
    icuActive: true,
    cardiologyDept: 1,
    neurologyDept: 0
  }
];

// Haversine distance calculator
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

// Logic EXACTLY mirroring the Driver portal's assignment algorithm
const evaluateAmbulanceSelection = (evaluatedList) => {
  const sortedByDist = [...evaluatedList].sort((a, b) => a.distanceKm - b.distanceKm);
  let chosen = sortedByDist[0];
  for (let i = 1; i < sortedByDist.length; i++) {
    if (sortedByDist[i - 1].distanceKm <= sortedByDist[i].distanceKm - 10 && sortedByDist[i].distanceKm >= 20) {
      chosen = sortedByDist[i - 1];
      break;
    }
  }
  return chosen;
};

export default function HospitalQueue() {
  const [hospitals, setHospitals] = useState(INITIAL_HOSPITALS);
  const [selectedHospitalForView, setSelectedHospitalForView] = useState(null);
  const [editingHospitalId, setEditingHospitalId] = useState(null);
  const [editForm, setEditForm] = useState({ icuBeds: 0, wardBudget: 0 });
  const [predictedHospitalId, setPredictedHospitalId] = useState(null);

  // Global Filter states
  const [cardiologyFilter, setCardiologyFilter] = useState("all"); 
  const [neurologyFilter, setNeurologyFilter] = useState("all");     

  // Mapping of hospitalId -> array of incoming queue items
  const [hospitalQueues, setHospitalQueues] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  // Ref to access latest hospitals state inside websocket listener safely
  const hospitalsRef = useRef(hospitals);
  useEffect(() => {
    hospitalsRef.current = hospitals;
  }, [hospitals]);

  // Live ETA countdown timer loop updated every second
  useEffect(() => {
    const timer = setInterval(() => {
      setHospitalQueues(prevQueues => {
        const updated = { ...prevQueues };
        Object.keys(updated).forEach(hId => {
          updated[hId] = updated[hId].map(item => {
            if (item.status === "ARRIVED") return item;
            const currentSecs = item.etaSeconds !== undefined ? item.etaSeconds : 120;
            if (currentSecs <= 0) return { ...item, eta: "Arriving...", etaSeconds: 0 };
            
            const nextSecs = currentSecs - 1;
            const mins = Math.floor(nextSecs / 60);
            const secs = nextSecs % 60;
            const formattedEta = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

            return {
              ...item,
              eta: formattedEta,
              etaSeconds: nextSecs
            };
          });
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Listen for real-time dispatches from backend server via WebSockets
  // AND trigger get_hospital API call ONLY ONCE per emergency dispatch
  useEffect(() => {
    const handleIncomingAlert = async (payload) => {
      console.log("Real-time dispatch captured in HospitalQueue:", payload);

      if (!payload || !payload.dispatchId) return;

      const triageNum = 3;
      const criticalLevel = "Medium"; 
      const chronicList = payload.emergencyAssessment?.chronic_diseases_list || [];

      if (payload.locationCoordinates) {
        const pLat = payload.locationCoordinates.latitude;
        const pLng = payload.locationCoordinates.longitude;

        // --- PERFECTLY MIRROR DRIVERALERT.JSX AMBULANCE ASSIGNMENT ---
        const evaluatedAmbs = INITIAL_AMBULANCES.map(amb => ({
          ...amb,
          distanceKm: calculateHaversineDistance(amb.lat, amb.lng, pLat, pLng)
        }));
        const optimalAmb = evaluateAmbulanceSelection(evaluatedAmbs);

        // 1. Calculate exact distances and ETAs upon receiving patient coordinates
        const currentEvaluatedHospitals = hospitalsRef.current.map(h => {
          const distance_km = Number(calculateHaversineDistance(h.lat, h.lng, pLat, pLng).toFixed(1));
          const time_mins = Math.max(1, Math.round((distance_km / 50) * 60));
          return {
            ...h,
            distanceKm: distance_km,
            etaMins: time_mins
          };
        });

        // Update local hospitals UI with recalculated live distances
        setHospitals(currentEvaluatedHospitals);

        // 2. Send hospital payload ONLY ON EMERGENCY DISPATCH
        let targetId = null;
        try {
          console.log("Dispatch received. Sending hospital list to get_hospital endpoint...");
          
          const response = await fetch("https://8000-01kyczz34c5trb0gzwaaht9trq.cloudspaces.litng.ai/get_hospital", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentEvaluatedHospitals)
          });

          if (!response.ok) {
            console.error("External prediction API error status:", response.status);
          } else {
            const data = await response.json();
            console.log("Successfully retrieved AI target hospital ID on dispatch:", data.id);
            targetId = data.id;
            setPredictedHospitalId(targetId);
          }
        } catch (apiErr) {
          console.error("Failed to post payload to external API on dispatch:", apiErr);
        }

        // 3. Match hospital based on the returned data.id (or fallback to distance if error)
        let targetHospital = currentEvaluatedHospitals.find(h => h.id === targetId);
        
        if (!targetHospital) {
          targetHospital = currentEvaluatedHospitals.reduce((minObj, curr) => (curr.distanceKm < minObj.distanceKm ? curr : minObj), currentEvaluatedHospitals[0]);
        }

        const assignedEtaSecs = (targetHospital.etaMins || 2) * 60;

        const newIncomingItem = {
          id: payload.dispatchId,
          patientName: payload.patientProfile?.name || "Emergency Patient",
          age: payload.patientProfile?.age || payload.emergencyAssessment?.age || "N/A",
          bloodGroup: payload.patientProfile?.bloodGroup || "N/A",
          triageLevel: triageNum,
          criticalLevel: criticalLevel,
          wardBudget: targetHospital.wardBudget,
          symptoms: `Pain Level: ${payload.emergencyAssessment?.pain_level || 3}/10, Arrival Mode: ${payload.emergencyAssessment?.arrival_mode || 'Ambulance'}, Previous ER Visits: ${payload.emergencyAssessment?.previous_er_visit || 0}`,
          eta: `${targetHospital.etaMins || 2}m 0s`,
          etaSeconds: assignedEtaSecs,
          status: payload.status || "DISPATCHED",
          vitals: { 
            hr: `${payload.emergencyAssessment?.heart_rate ? Math.round(payload.emergencyAssessment.heart_rate) : 83} bpm`, 
            bp: `${Math.round(payload.emergencyAssessment?.sytolic_bl || 128)}/82`, 
            spo2: "97%" 
          },
          conditions: chronicList.length > 0 ? chronicList : ["No chronic diseases reported"],
          allergies: payload.patientProfile?.allergies || "None reported",
          emergencyContact: payload.patientProfile?.emergencyContact || "Not provided",
          
          // Replaced mock data with the exactly evaluated dynamic ambulance & triage
          ambulanceId: `${optimalAmb.name} (Triage Level ${optimalAmb.triageLevel})`,
          //driverName: "AI Assigned Paramedic", 
          
          aiNotes: `Routed to ${targetHospital.name} by AI Command based on capacity and distance (${targetHospital.distanceKm} km, ETA: ${targetHospital.etaMins} mins). Dispatched ${optimalAmb.name}. Critical Level: ${criticalLevel}.`,
          locationCoordinates: payload.locationCoordinates
        };

        // 4. Update the queue for the selected target hospital
        setHospitalQueues(prevQ => {
          const currentList = prevQ[targetHospital.id] || [];
          if (currentList.some(item => item.id === newIncomingItem.id)) {
            return prevQ;
          }
          return {
            ...prevQ,
            [targetHospital.id]: [newIncomingItem, ...currentList]
          };
        });
      }
    };

    socket.off("incoming_emergency_alert");
    socket.on("incoming_emergency_alert", handleIncomingAlert);

    return () => {
      socket.off("incoming_emergency_alert", handleIncomingAlert);
    };
  }, []);

  const handleStartEdit = (e, hosp) => {
    e.stopPropagation();
    setEditingHospitalId(hosp.id);
    setEditForm({ icuBeds: hosp.icuBeds, wardBudget: hosp.wardBudget });
  };

  const handleSaveEdit = (e, hospId) => {
    e.stopPropagation();
    setHospitals(hospitals.map(h => h.id === hospId ? { ...h, icuBeds: editForm.icuBeds, wardBudget: editForm.wardBudget } : h));
    setEditingHospitalId(null);
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleAcknowledge = (e, hospId, id) => {
    e.stopPropagation();
    setHospitalQueues(prev => ({
      ...prev,
      [hospId]: prev[hospId].map(q => q.id === id ? { ...q, status: "ACKNOWLEDGED" } : q)
    }));
  };

  const handleArrived = (e, hospId, id) => {
    e.stopPropagation();
    setHospitalQueues(prev => ({
      ...prev,
      [hospId]: prev[hospId].map(q => q.id === id ? { ...q, status: "ARRIVED", eta: "Arrived" } : q)
    }));
  };

  // Filter hospitals based on Cardiology Dept and Neurology Dept radio selections
  const filteredHospitals = hospitals.filter(h => {
    if (cardiologyFilter !== "all" && String(h.cardiologyDept) !== cardiologyFilter) return false;
    if (neurologyFilter !== "all" && String(h.neurologyDept) !== neurologyFilter) return false;
    return true;
  });

  const currentHospitalQueue = selectedHospitalForView ? (hospitalQueues[selectedHospitalForView.id] || []) : [];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      
      {selectedHospitalForView ? (
        <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-teal-400">Active Hospital Terminal</span>
            <h1 className="text-2xl font-black mt-1">{selectedHospitalForView.name}</h1>
            <p className="text-xs text-slate-300 mt-0.5">{selectedHospitalForView.address} • Live Emergency Status Portal</p>
          </div>
          <button 
            onClick={() => setSelectedHospitalForView(null)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20"
          >
            ← Back to Multi-Hospital Command
          </button>
        </div>
      ) : null}

      {!selectedHospitalForView && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Regional Hospital Network & Live Distances
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select a hospital card to view its specific emergency requests and incoming status queue.
              </p>
            </div>
            
            {/* Department Filter Controls */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">Cardiology:</span>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="cardio" checked={cardiologyFilter === "all"} onChange={() => setCardiologyFilter("all")} /> All</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="cardio" checked={cardiologyFilter === "1"} onChange={() => setCardiologyFilter("1")} /> Yes</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="cardio" checked={cardiologyFilter === "0"} onChange={() => setCardiologyFilter("0")} /> No</label>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">Neurology:</span>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="neuro" checked={neurologyFilter === "all"} onChange={() => setNeurologyFilter("all")} /> All</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="neuro" checked={neurologyFilter === "1"} onChange={() => setNeurologyFilter("1")} /> Yes</label>
                <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="neuro" checked={neurologyFilter === "0"} onChange={() => setNeurologyFilter("0")} /> No</label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHospitals.map((hosp) => {
              // Highlight the hospital matched by data.id returned from AI
              const isTarget = hosp.id === predictedHospitalId;
              const isEditing = editingHospitalId === hosp.id;
              const reqCount = (hospitalQueues[hosp.id] || []).length;

              return (
                <div 
                  key={hosp.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between relative ${
                    isTarget 
                      ? "bg-teal-50/60 dark:bg-teal-950/30 border-teal-500 ring-2 ring-teal-500/20 shadow-md" 
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {isTarget && (
                    <span className="absolute -top-2.5 right-4 bg-teal-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                      Model Assigned Facility
                    </span>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{hosp.name}</h3>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 rounded shrink-0">
                          {hosp.distanceKm !== null ? `${hosp.distanceKm} km` : "Pending GPS"}
                        </span>
                        {hosp.etaMins !== null && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                            ETA: {hosp.etaMins}m
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {hosp.address}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                      <span>Cardiology: <strong>{hosp.cardiologyDept === 1 ? "Yes" : "No"}</strong></span>
                      <span>Neurology: <strong>{hosp.neurologyDept === 1 ? "Yes" : "No"}</strong></span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between text-xs">
                          <span>ICU Beds:</span>
                          <input 
                            type="number" 
                            value={editForm.icuBeds} 
                            onChange={(e) => setEditForm({ ...editForm, icuBeds: Number(e.target.value) })}
                            className="w-16 p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-center font-bold"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>Budget ($):</span>
                          <input 
                            type="number" 
                            value={editForm.wardBudget} 
                            onChange={(e) => setEditForm({ ...editForm, wardBudget: Number(e.target.value) })}
                            className="w-16 p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-center font-bold"
                          />
                        </div>
                        <button 
                          onClick={(e) => handleSaveEdit(e, hosp.id)}
                          className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-colors shadow"
                        >
                          Save Capacity
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-center flex items-center justify-center gap-1">
                            <BedSingle className="w-3.5 h-3.5 text-teal-600" />
                            <span className="text-[10px] text-slate-400 uppercase font-bold">ICU: {hosp.icuBeds}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                            <span className="block text-[9px] text-slate-400 uppercase font-bold">Ward Budget</span>
                            <span className="font-black text-teal-600 dark:text-teal-400">${hosp.wardBudget}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button 
                            onClick={(e) => handleStartEdit(e, hosp)}
                            className="text-[11px] font-bold text-slate-500 hover:text-teal-600 transition-colors underline"
                          >
                            Edit Ward Info
                          </button>
                          <button 
                            onClick={() => setSelectedHospitalForView(hosp)}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1 relative"
                          >
                            View Emergency Status
                            {reqCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                                {reqCount}
                              </span>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedHospitalForView && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <h2 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" /> 
              {selectedHospitalForView.name} - Incoming Requests Stream
            </h2>
            <span className="text-xs font-bold px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping"></span> Live WebSockets
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {currentHospitalQueue.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500">
                <CheckCircle2 className="w-12 h-12 text-teal-600/30 mb-3" />
                <p className="font-bold text-lg text-slate-900 dark:text-slate-100">No active emergency dispatches received for this facility</p>
                <p className="text-sm">When dispatches occur where this facility is chosen, requests will appear exclusively here.</p>
              </div>
            ) : (
              currentHospitalQueue.map((incident) => {
                const isArrived = incident.status === "ARRIVED";
                const isExpanded = expandedId === incident.id;
                
                return (
                  <div key={incident.id} className={`flex flex-col transition-colors ${isArrived ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-75" : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"}`}>
                    
                    <div 
                      onClick={() => toggleExpand(incident.id)}
                      className="p-5 flex flex-col lg:flex-row gap-5 items-start lg:items-center cursor-pointer select-none"
                    >
                      <div className="flex-shrink-0 w-full lg:w-48 flex flex-row lg:flex-col items-center lg:items-start justify-between lg:justify-start gap-2">
                        <div className={`flex items-center gap-2 text-lg font-black ${isArrived ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-slate-100"}`}>
                          {isArrived ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
                          {isArrived ? "ARRIVED" : `ETA ${incident.eta}`}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black tracking-wider px-2 py-0.5 rounded-md border bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50">
                            Triage {incident.triageLevel}
                          </span>
                          <span className="text-xs font-black tracking-wider px-2 py-0.5 rounded-md border bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50">
                            {incident.criticalLevel || "Medium"}
                          </span>
                        </div>
                      </div>

                      <div className="flex-grow space-y-2">
                        <div className="flex items-center gap-3">
                          <span className={`text-base font-bold ${isArrived ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>{incident.patientName}</span>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{incident.age} yrs • Blood: {incident.bloodGroup}</span>
                          <span className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded">Ward Budget: ${incident.wardBudget}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1 text-red-500">
                            <HeartPulse className="w-3.5 h-3.5 fill-red-500/20 animate-pulse" /> {incident.vitals.hr}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span>BP: {incident.vitals.bp}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-teal-600 dark:text-teal-400">SpO2: {incident.vitals.spo2}</span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 w-full lg:w-auto flex items-center gap-3 mt-4 lg:mt-0">
                        {isArrived ? (
                          <div className="flex-1 lg:flex-none text-center px-4 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-4 h-4" /> Patient Admitted
                          </div>
                        ) : incident.status !== "ACKNOWLEDGED" ? (
                          <button 
                            onClick={(e) => handleAcknowledge(e, selectedHospitalForView.id, incident.id)}
                            className="flex-1 lg:flex-none px-6 py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-xl transition-all shadow-sm"
                          >
                            Acknowledge
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => handleArrived(e, selectedHospitalForView.id, incident.id)}
                            className="flex-1 lg:flex-none px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 shadow-md shadow-teal-600/20"
                          >
                            Mark Arrived <ChevronUp className="w-4 h-4 rotate-90" />
                          </button>
                        )}
                        
                        <div className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/40 space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          
                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                              <User className="w-4 h-4 text-teal-600" /> Patient Emergency Record
                            </h4>
                            <div className="grid grid-cols-2 gap-y-3 text-xs">
                              <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Chronic Conditions</span>
                                <div className="font-semibold text-slate-700 dark:text-slate-300 mt-1">
                                  {Array.isArray(incident.conditions) ? (
                                    <ul className="list-disc pl-4 space-y-0.5">
                                      {incident.conditions.map((disease, idx) => (
                                        <li key={idx}>{disease}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span>{incident.conditions}</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Allergies</span>
                                <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                                  <ShieldAlert className="w-3.5 h-3.5" /> {incident.allergies}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Full Symptom Report</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 mt-1 block">{incident.symptoms}</span>
                              </div>
                              <div className="col-span-2">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">Emergency Contact</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-1">
                                  <Phone className="w-3.5 h-3.5 text-slate-400" /> {incident.emergencyContact}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                              <span className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-teal-600" /> Model level Match Explanation
                              </span>
                            </h4>
                            
                            <div className="space-y-3 text-xs">
                              <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 flex items-start gap-2.5">
                                <HeartPulse className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                <span className="font-medium text-amber-900 dark:text-amber-300 leading-relaxed">
                                  {incident.aiNotes}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-slate-500 pt-1">
                                <span>Unit: <strong>{incident.ambulanceId}</strong></span>
                                {/* <span>Paramedic: <strong>{incident.driverName}</strong></span> */}
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}