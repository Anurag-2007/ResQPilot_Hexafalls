import React, { useState, useEffect, useCallback, useRef } from "react";
import { useEmergencyStore } from "../store/useEmergencyStore";
import api from "../services/api";
import useWebSocket from "../hooks/useWebSocket";
import Button from "../components/common/Button";
import Stepper from "../components/common/Stepper";
import SymptomSelector from "../components/emergency/SymptomSelector";
import LocationPicker from "../components/emergency/LocationPicker";
import LiveTrackingMap from "../components/maps/LiveTrackingMap";
import HospitalQueue from "../components/admin/HospitalQueue";
import DriverAlert from "../components/driver/DriverAlert";
import { LogOut, ShieldAlert, Users, Activity as ActivityIcon, Sun, Moon } from "lucide-react";
import { setCookie } from "../utils/cookies";

export default function Dashboard({ onLogout, onNavigateToVault, theme, toggleTheme }) {
  const store = useEmergencyStore();
  const { currentRole, user, activeEmergency, userLocation, familyMembers } = store;

  const [selectedPatientId, setSelectedPatientId] = useState("self-profile");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [location, setLocationState] = useState(userLocation);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const locationDetectedRef = useRef(false);

  const { isConnected } = useWebSocket(activeEmergency?.id);

  useEffect(() => {
    if (currentRole !== "citizen" || locationDetectedRef.current) return;
    locationDetectedRef.current = true;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocationState(loc);
          store.setUserLocation(loc);
        },
        () => console.warn("Geolocation blocked")
      );
    }
  }, []);

  const handleDispatch = async () => {
    if (!selectedSymptoms.length) return alert("Select a symptom.");
    setIsSubmitting(true);
    try {
      await api.post("/emergencies/dispatch", { patientId: selectedPatientId, symptoms: selectedSymptoms });
      if (currentRole === "citizen") {
        await store.selectAmbulance(selectedPatientId, selectedSymptoms);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
      <header className="sticky top-0 z-[500] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
       <div className="flex items-center gap-2">
  <img 
    src="/logo.png" 
    alt="ResQPilot Logo" 
    className="w-20 h-20 object-contain" 
  />
  <span className="font-black text-lg">ResQPilot</span>
</div>
        <div className="flex items-center gap-4">
          {currentRole === "citizen" && <Button onClick={onNavigateToVault} variant="secondary" size="sm" icon={Users}>Family medical records</Button>}
          <button onClick={toggleTheme} className="p-2">{theme === "dark" ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}</button>
          <button onClick={onLogout} className="p-2 text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-6">
        {currentRole === "citizen" && (
          <>
            {!activeEmergency ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="flex flex-col gap-6">
                  {/* <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl">
                    <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><Users className="text-teal-600 w-4 h-4" /> Patient Profile</h3>
                    <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-2.5 px-3">
                      <option value="self-profile">John Doe (You) — O+</option>
                      {familyMembers.map((fam) => <option key={fam.id} value={fam.id}>{fam.name} — {fam.bloodGroup}</option>)}
                    </select>
                  </div> */}
                  <SymptomSelector selectedSymptoms={selectedSymptoms} onChangeSymptoms={setSelectedSymptoms} additionalNotes={additionalNotes} onChangeNotes={setAdditionalNotes} />
                </div>
                <div className="flex flex-col gap-6">
                  <LocationPicker location={location} onChangeLocation={setLocationState} />
                  {/* { <div className="bg-white dark:bg-slate-900 border p-5 rounded-xl">
                    <Button onClick={handleDispatch} isLoading={isSubmitting} className="w-full bg-red-600 text-white font-bold py-3" icon={ShieldAlert}>CONFIRM DISPATCH</Button>
                  </div> } */}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <Stepper currentStatus={activeEmergency.status} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="bg-white dark:bg-slate-900 border p-5 rounded-xl">
                      <h4 className="font-bold text-sm mb-4">Triage Assessment</h4>
                      <span className="block text-xs font-semibold text-slate-500">Patient: {activeEmergency.patientName}</span>
                    </div>
                    <Button onClick={store.cancelEmergency} variant="secondary" className="text-red-600 border-red-200">Cancel Request</Button>
                  </div>
                  <div className="lg:col-span-2 relative h-[400px] md:h-[500px] rounded-xl overflow-hidden border">
                    <LiveTrackingMap patientLocation={activeEmergency.location} driverLocation={store.driverPosition} status={activeEmergency.status} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {currentRole === "driver" && <DriverAlert />}
        {currentRole === "admin" && <HospitalQueue />}
      </main>
    </div>
  );
}