import React, { useState, useEffect } from "react";
import { AlertCircle, Mic, MicOff, Loader2, ShieldAlert, Navigation, XCircle, ArrowLeft, MapPin } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { useEmergencyStore } from "../../store/useEmergencyStore";
import LiveTrackingMap from "../maps/LiveTrackingMap";
import { io } from "socket.io-client";

// Connect to the backend server for production real-time sync via WebSockets
const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:5000", {
  autoConnect: true
});

const COMMON_SYMPTOMS = ["Chest Pain", "Shortness of Breath", "Severe Bleeding", "Unconscious", "Seizures", "Severe Burns", "Fractures", "Head Injury", "Stroke Symptoms", "Allergic Reaction", "Burns"];

const SYMPTOM_SEVERITY_MAP = {
  "chest pain": 4,
  "shortness of breath": 3,
  "severe bleeding": 8,
  "unconscious": 9,
  "seizures": 7,
  "severe burns": 8,
  "fractures": 5,
  "head injury": 6,
  "stroke symptoms": 9,
  "allergic reaction": 7,
  "burns": 5,
  "heart attack": 9,
  "heart attak": 9
};

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

export default function SymptomSelector({ selectedSymptoms, onChangeSymptoms, additionalNotes, onChangeNotes }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [selectedFamilyMemberId, setSelectedFamilyMemberId] = useState("");

  // 🗺️ Active Tracking & Route State mirroring DriverAlert live map layout
  const [activeDispatch, setActiveDispatch] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const store = useEmergencyStore();
  const familyMembers = useEmergencyStore((state) => state.familyMembers) || [];

  const toggleSymptom = (s) => onChangeSymptoms(selectedSymptoms.includes(s) ? selectedSymptoms.filter(x => x !== s) : [...selectedSymptoms, s]);

  // Fetch OSRM route identical to DriverAlert implementation
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

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(",")[1];
        resolve(base64String);
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
          {
            inlineData: {
              data: base64Audio,
              mimeType: "audio/webm"
            }
          }
        ]
      });

      const transcribedText = response.text ? response.text.trim() : "";
      if (transcribedText) {
        onChangeNotes(additionalNotes ? `${additionalNotes} ${transcribedText}` : transcribedText);
      }
    } catch (err) {
      console.error("Gemini Transcription Error:", err);
      alert("Failed to transcribe audio. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getSymptomScore = (symptomName) => {
    const key = symptomName.toLowerCase().trim();
    return SYMPTOM_SEVERITY_MAP[key] || 3;
  };

  const extractSymptomsFromNotes = (notes) => {
    if (!notes) return [];
    const lowerNotes = notes.toLowerCase();
    const found = [];
    Object.keys(SYMPTOM_SEVERITY_MAP).forEach((symptom) => {
      if (lowerNotes.includes(symptom)) {
        found.push(symptom);
      }
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

        const dispatchPayload = {
          dispatchId: `disp-${Date.now()}`,
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

        // Emit real-time dispatch event over WebSockets to backend server & MongoDB
        socket.emit("citizen_dispatch", dispatchPayload);

        // Fetch exact OSRM route from a simulated starting ambulance coordinate to patient location
        const ambStartLat = coordinates.latitude + 0.05;
        const ambStartLng = coordinates.longitude + 0.05;
        const coords = await fetchOSRMRoute(ambStartLat, ambStartLng, coordinates.latitude, coordinates.longitude);

        const initialPos = coords.length > 0 ? coords[0] : { lat: ambStartLat, lng: ambStartLng };
        useEmergencyStore.setState({ driverPosition: initialPos });

        // Send payload to external endpoint
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
              body_temp: 37.24405
            })
          };;

          await fetch("https://8000-01kyczz34c5trb0gzwaaht9trq.cloudspaces.litng.ai/get_ambulance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(externalApiPayload)
          });
        } catch (apiErr) {
          console.error("Failed to post payload to external API:", apiErr);
        }

        const missionDetails = {
          id: dispatchPayload.dispatchId,
          patientName: member.name,
          severity: `LEVEL ${Math.ceil(totalPainLevel / 2)} - CRITICAL`,
          distance: "Calculating distance...",
          eta: "2 mins",
          symptoms: descSymptoms.join(", ") || "Acute symptoms recorded",
          location: {
            lat: coordinates.latitude,
            lng: coordinates.longitude,
            address: "Live Dispatched Patient Location"
          },
          hospital: { name: "Apollo Gleneagles", lat: 22.5780, lng: 88.4100 },
          assignedAmbulance: "Ambulance Alpha (UNIT-09)",
          triageLevel: Math.ceil(totalPainLevel / 2),
          status: "DEPARTED",
          routePoints: coords
        };

        store.setActiveEmergency(missionDetails);
        setActiveDispatch(dispatchPayload);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Unable to retrieve your location coordinates for dispatch.");
      },
      { enableHighAccuracy: true }
    );
  };

  // 🛑 Handle Cancellation of Request
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

  // 🗺️ Exact LiveTrackingMap view as implemented in DriverAlert
  if (activeDispatch || store.activeEmergency) {
    const currentActive = store.activeEmergency || {
      id: activeDispatch?.dispatchId,
      patientName: activeDispatch?.patientProfile?.name || "Patient",
      severity: "CRITICAL",
      status: "DEPARTED",
      location: { lat: activeDispatch?.locationCoordinates?.latitude || 22.5726, lng: activeDispatch?.locationCoordinates?.longitude || 88.3639 },
      hospital: { name: "Apollo Gleneagles", lat: 22.5780, lng: 88.4100 },
      assignedAmbulance: "Ambulance Alpha (UNIT-09)"
    };

    return (
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl mx-auto">
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
                <span className="font-bold text-teal-600 dark:text-teal-400">{currentActive.assignedAmbulance}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</span>
                <span className="font-bold text-amber-600 uppercase tracking-wider">{currentActive.status}</span>
              </div>
            </div>

            {/* Cancel Request Action Button */}
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
      {/* Family Vault Selection Section */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Select Family Vault Profile</label>
        <select
          value={selectedFamilyMemberId}
          onChange={(e) => setSelectedFamilyMemberId(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">-- Choose Profile from Family Vault --</option>
          {familyMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} (Age: {member.age}, Blood: {member.bloodGroup})
            </option>
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${isRecording
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
              }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing...
              </>
            ) : isRecording ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                Voice Input
              </>
            )}
          </button>
        </div>
        <textarea
          value={additionalNotes}
          onChange={e => onChangeNotes(e.target.value)}
          placeholder="Type or use voice input for additional details..."
          className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>

      {/* Confirm Dispatch Action Button */}
      <button
        type="button"
        onClick={handleConfirmDispatch}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-sm shadow transition-colors"
      >
        <ShieldAlert className="w-4 h-4" /> Confirm Patient Dispatch
      </button>
    </div>
  );
}