import React, { useState } from "react";
import { ArrowLeft, Users, Plus, Edit2, Trash2, Heart, Phone, Activity, ShieldAlert } from "lucide-react";
import { useEmergencyStore } from "../store/useEmergencyStore";
import MedicalProfileForm from "../components/family/MedicalProfileForm";

export default function FamilyVault({ onBack }) {
  const store = useEmergencyStore();
  const familyMembers = store.familyMembers;
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const handleSave = (profileData) => {
    if (editingMember) {
      useEmergencyStore.setState((state) => ({
        familyMembers: state.familyMembers.map((m) => (m.id === profileData.id ? profileData : m))
      }));
    } else {
      useEmergencyStore.setState((state) => ({
        familyMembers: [...state.familyMembers, profileData]
      }));
    }
    setIsAdding(false);
    setEditingMember(null);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this profile?")) {
      useEmergencyStore.setState((state) => ({
        familyMembers: state.familyMembers.filter((m) => m.id !== id)
      }));
    }
  };

  // Helper function to extract ONLY the chronic conditions list from the JSON string
  const renderChronicConditions = (chronicConditionsString) => {
    if (!chronicConditionsString) return "None";
    try {
      const parsed = JSON.parse(chronicConditionsString);
      // Check if it's our structured JSON object
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.chronicConditionsList)) {
        return parsed.chronicConditionsList.length > 0 
          ? parsed.chronicConditionsList.join(", ") 
          : "None";
      }
    } catch (e) {
      // Fallback if it's plain text
      return chronicConditionsString;
    }
    return "None";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 w-full">
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2 m-0">
            <Users className="text-teal-600 w-7 h-7" /> Family Medical records
          </h1>
        </div>
        
        {!isAdding && !editingMember && (
          <button 
            onClick={() => setIsAdding(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Profile
          </button>
        )}
      </div>

      {isAdding || editingMember ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm max-w-xl mx-auto">
          <h2 className="text-xl font-bold mb-6">
            {editingMember ? `Edit ${editingMember.name}` : "New Medical Profile"}
          </h2>
          <MedicalProfileForm 
            initialData={editingMember} 
            onSubmit={handleSave} 
            onCancel={() => { setIsAdding(false); setEditingMember(null); }} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {familyMembers.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-slate-900 border p-12 text-center rounded-xl shadow-sm">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="font-medium text-slate-500">No profiles saved.</p>
              <button onClick={() => setIsAdding(true)} className="mt-4 px-4 py-2 bg-teal-600 text-white font-bold rounded-lg">
                Create First Profile
              </button>
            </div>
          ) : (
            familyMembers.map((member) => (
              <div key={member.id} className="bg-white dark:bg-slate-900 border p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">{member.name}</h3>
                    <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full mt-1">Age: {member.age}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingMember(member)} className="p-2 text-slate-400 hover:text-teal-600"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(member.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="text-sm space-y-2">
                  <p><strong>Blood:</strong> {member.bloodGroup}</p>
                  <p><strong>Contact:</strong> {member.emergencyContact || "None"}</p>
                  <p><strong>Conditions:</strong> {renderChronicConditions(member.chronicConditions)}</p>
                  <p><strong>Allergies:</strong> {member.allergies || "None"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}