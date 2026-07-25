import { create } from 'zustand';

export const useEmergencyStore = create((set, get) => ({
  user: null,
  currentRole: 'citizen', // 'citizen', 'driver', 'admin'
  userLocation: null,
  driverPosition: null,
  activeEmergency: null,
  familyMembers: [
    { id: 'fam-1', name: 'Jane Doe', age: 65, bloodGroup: 'A-', chronicConditions: 'Diabetes', emergencyContact: '123-456-7890' }
  ],
  
  setUser: (user) => set({ user }),
  setRole: (role) => set({ currentRole: role }),
  setUserLocation: (location) => set({ userLocation: location }),
  setDriverPosition: (position) => set({ driverPosition: position }),
  
  setActiveEmergency: (emergency) => set({ activeEmergency: emergency }),
  cancelEmergency: () => set({ activeEmergency: null }),
  
  // Mock AI Triage / Ambulance Selector
  selectAmbulance: async (patientId, symptoms) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          level: symptoms.includes("Chest Pain") ? "Critical" : "Moderate",
          confidence: 94,
          eta: "8 mins"
        });
        set({
          activeEmergency: {
            id: 'emg-' + Date.now(),
            patientName: patientId === 'self-profile' ? 'John Doe (You)' : 'Jane Doe',
            bloodGroup: patientId === 'self-profile' ? 'O+' : 'A-',
            status: 'PENDING',
            severity: symptoms.includes("Chest Pain") ? "LEVEL 1" : "LEVEL 3",
            location: get().userLocation,
            aiTriageResult: {
              primaryConcern: symptoms.join(", "),
              recommendedActions: ["Keep patient calm", "Do not give food/water"]
            }
          }
        });
      }, 1500);
    });
  }
}));