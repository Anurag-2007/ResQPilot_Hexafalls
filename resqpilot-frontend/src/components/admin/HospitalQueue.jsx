import React, { useState, useEffect } from "react";
import { 
  Activity, Clock, Truck, AlertTriangle, CheckCircle2, Bed, 
  Thermometer, ChevronDown, ChevronUp, Plus, Minus, User, 
  Phone, ShieldAlert, HeartPulse, Stethoscope, Sparkles,
  Zap, ToggleLeft, ToggleRight, Building2, Check, X, Navigation, MapPin
} from "lucide-react";
import { useEmergencyStore } from "../../store/useEmergencyStore";
import { io } from "socket.io-client";

// Connect to backend server via WebSockets
const socket = io("http://localhost:5000", { autoConnect: true });

// Initial Mock Hospitals Database with coordinates, distances, and editable beds
const INITIAL_HOSPITALS = [
  {
    id: "hosp-1",
    name: "Apollo Gleneagles Hospital",
    address: "54 Canal Circular Rd, Kolkata",
    lat: 22.5780,
    lng: 88.4100,
    distanceKm: 2.4,
    erBeds: 12,
    icuBeds: 4,
    erActive: true,
    icuActive: true
  },
  {
    id: "hosp-2",
    name: "Fortis Hospital Anandapur",
    address: "730 Anandapur, EM Bypass, Kolkata",
    lat: 22.5180,
    lng: 88.4050,
    distanceKm: 5.8,
    erBeds: 8,
    icuBeds: 2,
    erActive: true,
    icuActive: true
  },
  {
    id: "hosp-3",
    name: "AMRI Hospitals Salt Lake",
    address: "JC Block, Sector III, Salt Lake, Kolkata",
    lat: 22.5850,
    lng: 88.4020,
    distanceKm: 3.1,
    erBeds: 5,
    icuBeds: 0,
    erActive: true,
    icuActive: false
  },
  {
    id: "hosp-4",
    name: "Peerless Hospital",
    address: "360 Panchasayar, Garia, Kolkata",
    lat: 22.4850,
    lng: 88.3900,
    distanceKm: 9.5,
    erBeds: 15,
    icuBeds: 6,
    erActive: true,
    icuActive: true
  },
  {
    id: "hosp-5",
    name: "SSKM Medical College & Hospital",
    address: "244 AJC Bose Rd, Bhowanipore, Kolkata",
    lat: 22.5410,
    lng: 88.3440,
    distanceKm: 6.2,
    erBeds: 20,
    icuBeds: 3,
    erActive: true,
    icuActive: true
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

export default function HospitalQueue() {
  const [hospitals, setHospitals] = useState(INITIAL_HOSPITALS);
  const [selectedHospitalForView, setSelectedHospitalForView] = useState(null);
  const [editingHospitalId, setEditingHospitalId] = useState(null);
  const [editForm, setEditForm] = useState({ erBeds: 0, icuBeds: 0 });

  // Mapping of hospitalId -> array of incoming queue items
  const [hospitalQueues, setHospitalQueues] = useState({});
  const [expandedId, setExpandedId] = useState(null);

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
  useEffect(() => {
    const handleIncomingAlert = (payload) => {
      console.log("Real-time dispatch captured in HospitalQueue:", payload);

      if (!payload || !payload.dispatchId) return;

      const painLevel = payload.emergencyAssessment?.pain_level || 3;
      const triageNum = Math.min(5, Math.max(1, Math.ceil(painLevel / 2)));
      
      // Extract chronic diseases list array sent from SymptomSelector
      const chronicList = payload.emergencyAssessment?.chronic_diseases_list || [];

      if (payload.locationCoordinates) {
        const pLat = payload.locationCoordinates.latitude;
        const pLng = payload.locationCoordinates.longitude;

        setHospitals(prevHospitals => {
          const evaluated = prevHospitals.map(h => ({
            ...h,
            distanceKm: Number(calculateHaversineDistance(h.lat, h.lng, pLat, pLng).toFixed(1))
          }));

          const nearest = evaluated.reduce((minObj, curr) => curr.distanceKm < minObj.distanceKm ? curr : minObj, evaluated[0]);

          const newIncomingItem = {
            id: payload.dispatchId,
            patientName: payload.patientProfile?.name || "Emergency Patient",
            age: payload.patientProfile?.age || payload.emergencyAssessment?.age || "N/A",
            bloodGroup: payload.patientProfile?.bloodGroup || "N/A",
            triageLevel: triageNum,
            symptoms: `Pain Level: ${painLevel}/10, Arrival Mode: ${payload.emergencyAssessment?.arrival_mode || 'Ambulance'}, Previous ER Visits: ${payload.emergencyAssessment?.previous_er_visit || 0}`,
            eta: "2m 0s",
            etaSeconds: 120,
            status: payload.status || "DISPATCHED",
            vitals: { 
              hr: `${payload.emergencyAssessment?.heart_rate ? Math.round(payload.emergencyAssessment.heart_rate) : 83} bpm`, 
              bp: `${Math.round(payload.emergencyAssessment?.sytolic_bl || 128)}/82`, 
              spo2: "97%" 
            },
            // Mapped chronic diseases list array or fallback string
            conditions: chronicList.length > 0 ? chronicList : ["No chronic diseases reported"],
            allergies: payload.patientProfile?.allergies || "None reported",
            emergencyContact: payload.patientProfile?.emergencyContact || "Not provided",
            ambulanceId: "UNIT-09 (Advanced Life Support)",
            driverName: "Paramedic Dispatch Unit",
            aiNotes: `Routed to ${nearest.name} based on nearest distance (${nearest.distanceKm} km). Pain Level: ${painLevel}/10, Body Temp: ${payload.emergencyAssessment?.body_temp || 'N/A'}°C.`,
            locationCoordinates: payload.locationCoordinates
          };

          setHospitalQueues(prevQ => {
            const currentList = prevQ[nearest.id] || [];
            if (currentList.some(item => item.id === newIncomingItem.id)) {
              return prevQ;
            }
            return {
              ...prevQ,
              [nearest.id]: [newIncomingItem, ...currentList]
            };
          });

          return evaluated;
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
    setEditForm({ erBeds: hosp.erBeds, icuBeds: hosp.icuBeds });
  };

  const handleSaveEdit = (e, hospId) => {
    e.stopPropagation();
    setHospitals(hospitals.map(h => h.id === hospId ? { ...h, erBeds: editForm.erBeds, icuBeds: editForm.icuBeds } : h));
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

  const nearestHospitalId = hospitals.reduce((minObj, curr) => curr.distanceKm < minObj.distanceKm ? curr : minObj, hospitals[0])?.id;
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Regional Hospital Network & Live Distances
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select a hospital card to view its specific emergency requests and incoming status queue.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full border border-teal-200 dark:border-teal-800/50 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> GPS Distance Sync Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hospitals.map((hosp) => {
              const isNearest = hosp.id === nearestHospitalId;
              const isEditing = editingHospitalId === hosp.id;
              const reqCount = (hospitalQueues[hosp.id] || []).length;

              return (
                <div 
                  key={hosp.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between relative ${
                    isNearest 
                      ? "bg-teal-50/60 dark:bg-teal-950/30 border-teal-500 ring-2 ring-teal-500/20 shadow-md" 
                      : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {isNearest && (
                    <span className="absolute -top-2.5 right-4 bg-teal-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow">
                      Nearest Facility
                    </span>
                  )}

                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{hosp.name}</h3>
                      <span className="text-xs font-black text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 rounded shrink-0">
                        {hosp.distanceKm} km
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" /> {hosp.address}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                    {isEditing ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between text-xs">
                          <span>ER Beds:</span>
                          <input 
                            type="number" 
                            value={editForm.erBeds} 
                            onChange={(e) => setEditForm({ ...editForm, erBeds: Number(e.target.value) })}
                            className="w-16 p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-center font-bold"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span>ICU Beds:</span>
                          <input 
                            type="number" 
                            value={editForm.icuBeds} 
                            onChange={(e) => setEditForm({ ...editForm, icuBeds: Number(e.target.value) })}
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
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                            <span className="block text-[10px] text-slate-400 uppercase font-bold">ER Beds</span>
                            <span className="font-black text-slate-800 dark:text-slate-200">{hosp.erBeds}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                            <span className="block text-[10px] text-slate-400 uppercase font-bold">ICU Beds</span>
                            <span className="font-black text-slate-800 dark:text-slate-200">{hosp.icuBeds}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button 
                            onClick={(e) => handleStartEdit(e, hosp)}
                            className="text-[11px] font-bold text-slate-500 hover:text-teal-600 transition-colors underline"
                          >
                            Edit Beds
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
                <p className="text-sm">When dispatches occur where this facility is closest, requests will appear exclusively here.</p>
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
                        <span className="text-xs font-black tracking-wider px-2.5 py-1 rounded-md border bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50">
                          Triage Level {incident.triageLevel}
                        </span>
                      </div>

                      <div className="flex-grow space-y-2">
                        <div className="flex items-center gap-3">
                          <span className={`text-base font-bold ${isArrived ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-slate-100"}`}>{incident.patientName}</span>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{incident.age} yrs • Blood: {incident.bloodGroup}</span>
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
                                <Sparkles className="w-4 h-4 text-teal-600" /> AI Hospital Match Explanation
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
                                <span>Paramedic: <strong>{incident.driverName}</strong></span>
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