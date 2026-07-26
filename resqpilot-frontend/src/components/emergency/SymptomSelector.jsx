import React, { useState, useEffect } from "react";
import { AlertCircle, Mic, MicOff, Loader2, ShieldAlert, Navigation, XCircle, ArrowLeft } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { useEmergencyStore } from "../../store/useEmergencyStore";
import LiveTrackingMap from "../maps/LiveTrackingMap";
import { io } from "socket.io-client";

// Connect to the backend server for production real-time sync via WebSockets
const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
  autoConnect: true
});

// Added Heart and Brain prefixes for categorization
const COMMON_SYMPTOMS = [
  "Heart: Chest Pain", "Heart: Irregular Heartbeat", "Heart: Palpitations", 
  "Brain: Stroke Symptoms", "Brain: Unconscious", "Brain: Seizures", "Brain: Confusion", 
  "Brain: Severe Headache", "Brain: Slurred Speech", "Brain: Fainting", "Brain: Numbness", 
  "Shortness of Breath", "Severe Bleeding", "Severe Burns", "Fractures", "Head Injury", "Allergic Reaction"
];

// Mapped both prefixed (for UI buttons) and unprefixed (for voice NLP) to ensure scores are always applied
const SYMPTOM_SEVERITY_MAP = {
  "chest pain": 8,
  "heart: chest pain": 8,
  "shortness of breath": 7,
  "severe bleeding": 8,
  "unconscious": 9,
  "brain: unconscious": 9,
  "seizures": 8,
  "brain: seizures": 8,
  "severe burns": 8,
  "fractures": 5,
  "head injury": 8,
  "stroke symptoms": 9,
  "brain: stroke symptoms": 9,
  "allergic reaction": 7,
  "burns": 5,
  "heart attack": 9,
  "heart attak": 9,
  "irregular heartbeat": 7,
  "heart: irregular heartbeat": 7,
  "palpitations": 5,
  "heart: palpitations": 5,
  "confusion": 7,
  "brain: confusion": 7,
  "severe headache": 6,
  "brain: severe headache": 6,
  "slurred speech": 8,
  "brain: slurred speech": 8,
  "fainting": 6,
  "brain: fainting": 6,
  "numbness": 6,
  "brain: numbness": 6,
  "dizziness": 5,
  "brain: dizziness": 5
};

const INITIAL_AMBULANCES = [
  { id: "amb-1", name: "Ambulance Alpha", lat: 22.7500, lng: 88.5000, triageLevel: 1 },
  { id: "amb-2", name: "Ambulance Bravo", lat: 22.4800, lng: 88.3000, triageLevel: 2 },
  { id: "amb-3", name: "Ambulance Charlie", lat: 22.5800, lng: 88.3700, triageLevel: 3 },
  { id: "amb-4", name: "Ambulance Delta", lat: 22.3000, lng: 88.1500, triageLevel: 2 },
  { id: "amb-5", name: "Ambulance Echo", lat: 22.2500, lng: 88.1000, triageLevel: 1 }
];

const INITIAL_HOSPITALS = [
  { id: "hosp-1", name: "Apollo Gleneagles Hospital", lat: 22.5780, lng: 88.4100 },
  { id: "hosp-2", name: "Fortis Hospital Anandapur", lat: 22.5180, lng: 88.4050 },
  { id: "hosp-3", name: "AMRI Hospitals Salt Lake", lat: 22.5850, lng: 88.4020 },
  { id: "hosp-4", name: "Peerless Hospital", lat: 22.4850, lng: 88.3900 },
  { id: "hosp-5", name: "SSKM Medical College & Hospital", lat: 22.5410, lng: 88.3440 }
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

const evaluateAmbulanceSelection = (evaluatedList) => {
  const sortedByDist = [...evaluatedList].sort((a, b) => a.distanceKm - b.distanceKm);
  let chosen = sortedByDist[0];
  for (let i = 1; i < sortedByDist.length; i++) {
    const prev = sortedByDist[i - 1];
    const curr = sortedByDist[i];
    if (prev.distanceKm <= curr.distanceKm - 10 && curr.distanceKm >= 20) {
      chosen = prev;
      break;
    }
  }
  return chosen;
};

export default function SymptomSelector({ selectedSymptoms, onChangeSymptoms, additionalNotes, onChangeNotes }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState("");

  const [activeDispatch, setActiveDispatch] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const store = useEmergencyStore();
  const familyMembers = useEmergencyStore((state) => state.familyMembers) || [];

  const toggleSymptom = (s) => onChangeSymptoms(selectedSymptoms.includes(s) ? selectedSymptoms.filter(x => x !== s) : [...selectedSymptoms, s]);

  // LISTEN FOR ALL DRIVER MOVEMENT MILESTONES + COMPLETION
  useEffect(() => {
    const handleDriverUpdate = (data) => {
      console.log("🚑 CITIZEN RECEIVED DRIVER MOVEMENT EVENT:", data);
      
      useEmergencyStore.setState((state) => {
        if (!state.activeEmergency) return state;

        if (state.activeEmergency.id === data.dispatchId) {
          // If the driver completed the mission, alert user and clear local UI
          if (data.status === "COMPLETED") {
            setTimeout(() => {
              alert("Emergency handover completed and patient admitted. Mission concluded.");
              setActiveDispatch(null);
              setRouteCoordinates([]);
            }, 100);
            return { activeEmergency: null, driverPosition: null };
          }

          // Otherwise, proceed rendering normal live position tracking
          return {
            activeEmergency: { ...state.activeEmergency, status: data.status },
            driverPosition: data.driverPosition
          };
        }
        return state;
      });
    };

    socket.on("driver_milestone_update", handleDriverUpdate);
    return () => socket.off("driver_milestone_update", handleDriverUpdate);
  }, []);

  const fetchOSRMRoute = async (startLat, startLng, midLat, midLng, endLat, endLng) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${midLng},${midLat};${endLng},${endLat}?overview=full&geometries=geojson`;
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

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      let chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await handleGeminiTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required for speech-to-text.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const handleGeminiTranscription = async (audioBlob) => {
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
      const base64Audio = await blobToBase64(audioBlob);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          "Generate an accurate transcript of this speech to be used as clinical symptom description notes. Return only the plain transcript text without any introductory remarks.",
          { inlineData: { data: base64Audio, mimeType: "audio/webm" } }
        ]
      });
      const transcribedText = response.text ? response.text.trim() : "";
      if (transcribedText) {
        onChangeNotes(additionalNotes ? `${additionalNotes} ${transcribedText}` : transcribedText);
      }
    } catch (err) {
      console.error("Gemini Transcription Error:", err);
      alert("Failed to transcribe audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getSymptomScore = (symptomName) => SYMPTOM_SEVERITY_MAP[symptomName.toLowerCase().trim()] || 3;

  const extractSymptomsFromNotes = (notes) => {
    if (!notes) return [];
    const lowerNotes = notes.toLowerCase();
    const found = [];
    Object.keys(SYMPTOM_SEVERITY_MAP).forEach((symptom) => {
      if (lowerNotes.includes(symptom)) found.push(symptom);
    });
    return found;
  };

  const handleConfirmDispatch = async () => {
    if (!selectedFamilyMemberId) {
      alert("Please select a family member profile from the vault before dispatch.");
      return;
    }

    const member = familyMembers.find(m => m.id === selectedFamilyMemberId);
    if (!member) {
      alert("Selected family member profile not found.");
      return;
    }

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsDispatching(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };

        const descSymptoms = extractSymptomsFromNotes(additionalNotes);
        const allSymptomsSet = new Set([...selectedSymptoms, ...descSymptoms]);
        const evaluatedSymptoms = Array.from(allSymptomsSet).map((s) => ({
          symptom: s,
          rating: getSymptomScore(s)
        }));

        const rawPainSum = evaluatedSymptoms.reduce((acc, curr) => acc + curr.rating, 0);
        const totalPainLevel = Math.min(10, rawPainSum);

        let chronicDiseaseCount = 0;
        let chronicDiseasesList = [];
        let previousErVisitsCount = 0;
        let mostSevereArrivalMode = "None";

        try {
          const parsed = JSON.parse(member.chronicConditions);
          if (parsed && typeof parsed === "object") {
            chronicDiseasesList = parsed.chronicConditionsList || parsed.list || ["Hypertension", "Type 2 Diabetes"];
            chronicDiseaseCount = parsed.totalChronicDiseasesCount || chronicDiseasesList.length;
            previousErVisitsCount = parsed.erVisitsCount || (parsed.erVisitsDetails ? parsed.erVisitsDetails.length : 0);

            if (parsed.erVisitsDetails && Array.isArray(parsed.erVisitsDetails) && parsed.erVisitsDetails.length > 0) {
              let highestScore = -1;
              parsed.erVisitsDetails.forEach((visit) => {
                const score = visit.severityScore || (visit.transportMode === "Ambulance" ? 3 : visit.transportMode === "Wheelchair" ? 2 : 1);
                if (score > highestScore) {
                  highestScore = score;
                  mostSevereArrivalMode = visit.transportMode;
                }
              });
            }
          }
        } catch (e) {
          chronicDiseasesList = member.chronicConditions ? [member.chronicConditions] : ["General Condition"];
          chronicDiseaseCount = member.chronicConditions ? 1 : 0;
          previousErVisitsCount = 0;
        }

        const exactDispatchId = `disp-${Date.now()}`; // Lock ID at dispatch moment

        const dispatchPayload = {
          dispatchId: exactDispatchId,
          timestamp: new Date().toISOString(),
          patientProfile: {
            id: member.id,
            name: member.name,
            age: member.age,
            bloodGroup: member.bloodGroup,
            emergencyContact: member.emergencyContact,
            allergies: member.allergies || "None"
          },
          emergencyAssessment: {
            age: member.age,
            pain_level: totalPainLevel,
            chronic_disease_count: chronicDiseaseCount,
            chronic_diseases_list: chronicDiseasesList,
            previous_er_visit: previousErVisitsCount,
            arrival_mode: mostSevereArrivalMode,
            heart_rate: 83.19444,
            sytolic_bl: 128.2164,
            body_temp: 37.24405
          },
          locationCoordinates: coordinates,
          status: "DEPARTED"
        };

        socket.emit("citizen_dispatch", dispatchPayload);

        const evaluatedAmbs = INITIAL_AMBULANCES.map(amb => {
          const distKm = calculateHaversineDistance(amb.lat, amb.lng, coordinates.latitude, coordinates.longitude);
          return { ...amb, distanceKm: distKm };
        });

        const optimalAmb = evaluateAmbulanceSelection(evaluatedAmbs);

        // Fetch AI Hospital Assignment identically to the Driver view
        const evaluatedHospitals = INITIAL_HOSPITALS.map(h => ({ ...h, distanceKm: calculateHaversineDistance(h.lat, h.lng, coordinates.latitude, coordinates.longitude) }));
        let targetHospital = evaluatedHospitals[0];
        try {
          const res = await fetch("https://8000-01kyczz34c5trb0gzwaaht9trq.cloudspaces.litng.ai/get_hospital", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(evaluatedHospitals)
          });
          if (res.ok) {
            const data = await res.json();
            targetHospital = evaluatedHospitals.find(h => h.id === data.id) || targetHospital;
          }
        } catch (e) {}

        const coords = await fetchOSRMRoute(optimalAmb.lat, optimalAmb.lng, coordinates.latitude, coordinates.longitude, targetHospital.lat, targetHospital.lng);
        console.log("🛣️ [Citizen] OSRM route fetched, point count:", coords.length, coords.slice(0, 2));
        const initialPos = coords.length > 0 ? coords[0] : { lat: optimalAmb.lat, lng: optimalAmb.lng };
        useEmergencyStore.setState({ driverPosition: initialPos });

        try {
          const externalApiPayload = {
            desc: JSON.stringify({
              age: member.age,
              pain_level: totalPainLevel,
              chronic_disease_count: chronicDiseaseCount,
              chronic_diseases_list: chronicDiseasesList,
              previous_er_visit: previousErVisitsCount,
              arrival_mode: mostSevereArrivalMode,
              heart_rate: 83.19444,
              sytolic_bl: 128.2164,
              body_temp: 37.24405,
              symptoms_list: Array.from(allSymptomsSet),
              additional_notes: additionalNotes
            }),
            lat: coordinates.latitude, 
            lng: coordinates.longitude,
          };

          fetch("https://8000-01kyczz34c5trb0gzwaaht9trq.cloudspaces.litng.ai/get_ambulance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(externalApiPayload)
          }).then(res => res.json()).then(data => console.log("Predicted Ambulance Index:", data.predicted_idx)).catch(apiErr => console.error("External API error:", apiErr));
        } catch (e) {}

        const missionDetails = {
          id: exactDispatchId, // Must exactly match the ID we just broadcasted
          patientName: member.name,
          severity: `LEVEL ${optimalAmb.triageLevel} - CRITICAL`,
          distance: `${optimalAmb.distanceKm.toFixed(1)} km away`,
          eta: `${Math.round(optimalAmb.distanceKm * 2.5)} mins`,
          symptoms: descSymptoms.join(", ") || "Acute symptoms recorded",
          location: { lat: coordinates.latitude, lng: coordinates.longitude, address: "Live Dispatched Patient Location" },
          hospital: { name: targetHospital.name, lat: targetHospital.lat, lng: targetHospital.lng },
          assignedAmbulance: optimalAmb.name,
          triageLevel: optimalAmb.triageLevel,
          status: "DEPARTED",
          routePoints: coords
        };

        store.setActiveEmergency(missionDetails);
        setActiveDispatch(dispatchPayload);
        setIsDispatching(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to retrieve your location coordinates for dispatch.");
        setIsDispatching(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCancelRequest = () => {
    if (window.confirm("Are you sure you want to cancel this emergency dispatch request?")) {
      if (activeDispatch) {
        socket.emit("cancel_dispatch", { dispatchId: activeDispatch.dispatchId });
      }
      store.cancelEmergency();
      setActiveDispatch(null);
      setRouteCoordinates([]);
      alert("Emergency request successfully cancelled from ambulance and hospital queues.");
    }
  };

  if (activeDispatch || store.activeEmergency) {
    const currentActive = store.activeEmergency || {
      id: activeDispatch?.dispatchId,
      patientName: activeDispatch?.patientProfile?.name || "Patient",
      severity: "CRITICAL",
      status: "DEPARTED",
      location: { 
        lat: activeDispatch?.locationCoordinates?.latitude || 22.5726, 
        lng: activeDispatch?.locationCoordinates?.longitude || 88.3639 
      },
      hospital: { name: "Awaiting AI Assignment", lat: 22.5780, lng: 88.4100 },
      assignedAmbulance: "Assigning Nearest Unit..."
    };

    return (
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <Navigation className="text-teal-600 w-5 h-5 animate-pulse" /> Live Dispatch Tracking
              </h2>
              <button
                onClick={() => {
                  store.cancelEmergency();
                  setActiveDispatch(null);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Patient Name</span>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{currentActive.patientName}</span>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Assigned Unit</span>
                <span className="font-bold text-teal-600 dark:text-teal-400">
                  {currentActive.assignedAmbulance}
                </span>
              </div>
              
              <div>
                <span className="block text-[10px] font-bold text-slate-500 uppercase">Destination</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{currentActive.hospital.name}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</span>
                <span className="font-bold text-amber-600 uppercase tracking-wider">{currentActive.status}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancelRequest}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-600/20 transition-all mt-4"
            >
              <XCircle className="w-4 h-4" /> Cancel Request from Ambulance & Hospital
            </button>
          </div>
        </div>

        <div className="w-full lg:w-2/3 h-[500px] lg:h-[600px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm relative z-0">
          <LiveTrackingMap
            patientLocation={currentActive.location}
            hospitalLocation={currentActive.hospital}
            driverLocation={store.driverPosition || { lat: 22.5750, lng: 88.3650 }}
            status={currentActive.status}
            routeCoordinates={routeCoordinates}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Select Family Vault Profile</label>
        <select
          value={selectedFamilyMemberId}
          onChange={(e) => setSelectedFamilyMemberId(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">-- Choose Profile from Family Vault --</option>
          {familyMembers.map((member) => (
            <option key={member.id} value={member.id}>{member.name} (Age: {member.age}, Blood: {member.bloodGroup})</option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
          <AlertCircle className="text-amber-500 w-4 h-4" /> Symptoms
        </h3>
        <div className="flex flex-wrap gap-2">
          {COMMON_SYMPTOMS.map(s => (
            <button
              type="button"
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${selectedSymptoms.includes(s) ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300" : "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Additional details</label>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${isRecording ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse" : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"}`}
          >
            {isProcessing ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>) : isRecording ? (<><MicOff className="w-3.5 h-3.5" /> Stop Recording</>) : (<><Mic className="w-3.5 h-3.5" /> Voice Input</>)}
          </button>
        </div>
        <textarea
          value={additionalNotes}
          onChange={e => onChangeNotes(e.target.value)}
          placeholder="Type or use voice input for additional details..."
          className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>

      <button
        type="button"
        onClick={handleConfirmDispatch}
        disabled={isDispatching}
        className={`relative w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold shadow-lg transition-all duration-200 overflow-hidden ${
          isDispatching
            ? "bg-rose-500/80 text-white cursor-wait"
            : "bg-rose-600 hover:bg-rose-700 active:scale-[0.97] hover:shadow-rose-600/40 shadow-rose-600/20 text-white"
        }`}
      >
        {!isDispatching && (
          <span
            className="absolute inset-0 rounded-lg bg-rose-400/40 animate-ping"
            style={{ animationDuration: "2.2s" }}
          ></span>
        )}
        <span className="relative z-10 flex items-center gap-2">
          {isDispatching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Locating & Dispatching...
            </>
          ) : (
            <>
              <ShieldAlert className="w-4 h-4 animate-pulse" /> Confirm Patient Dispatch
            </>
          )}
        </span>
      </button>
    </div>
  );
}