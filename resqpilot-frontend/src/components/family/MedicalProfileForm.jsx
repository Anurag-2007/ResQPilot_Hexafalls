import React, { useState, useEffect } from "react";
import Button from "../common/Button";
import { User, Activity, Droplet, Phone, AlertCircle, Plus, Trash2 } from "lucide-react";

const COMMON_CHRONIC_LIST = [
  "Diabetes",
  "Hypertension",
  "Asthma",
  "Heart Disease",
  "Arthritis",
  "Kidney Disease"
];

export default function MedicalProfileForm({ initialData, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    bloodGroup: "O+",
    chronicConditions: "",
    allergies: "",
    emergencyContact: "",
  });

  const [selectedCommonChronic, setSelectedCommonChronic] = useState([]);
  const [additionalChronicInputs, setAdditionalChronicInputs] = useState([""]);
  const [erVisitsList, setErVisitsList] = useState([{ transportMode: "Walk-in" }]);

  // Hydrate state properly when editing an existing profile
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        age: initialData.age || "",
        bloodGroup: initialData.bloodGroup || "O+",
        chronicConditions: initialData.chronicConditions || "",
        allergies: initialData.allergies || "",
        emergencyContact: initialData.emergencyContact || "",
      });

      // Parse stored chronic conditions JSON
      if (initialData.chronicConditions) {
        try {
          const parsed = typeof initialData.chronicConditions === "string"
            ? JSON.parse(initialData.chronicConditions)
            : initialData.chronicConditions;

          const chronicList = parsed.chronicConditionsList || [];
          
          // Separate common diseases from custom additional inputs
          const commonMatches = chronicList.filter(item => COMMON_CHRONIC_LIST.includes(item));
          const customInputs = chronicList.filter(item => !COMMON_CHRONIC_LIST.includes(item));

          setSelectedCommonChronic(commonMatches);
          setAdditionalChronicInputs(customInputs.length > 0 ? customInputs : [""]);

          // Parse ER Visits
          if (parsed.erVisitsDetails && Array.isArray(parsed.erVisitsDetails) && parsed.erVisitsDetails.length > 0) {
            setErVisitsList(parsed.erVisitsDetails.map(visit => ({
              transportMode: visit.transportMode || "Walk-in"
            })));
          }
        } catch (e) {
          // Fallback if chronicConditions is a raw text string
          if (typeof initialData.chronicConditions === "string" && initialData.chronicConditions.trim()) {
            if (COMMON_CHRONIC_LIST.includes(initialData.chronicConditions)) {
              setSelectedCommonChronic([initialData.chronicConditions]);
            } else {
              setAdditionalChronicInputs([initialData.chronicConditions]);
            }
          }
        }
      }
    }
  }, [initialData]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const toggleCommonChronic = (disease) => {
    setSelectedCommonChronic(prev =>
      prev.includes(disease) ? prev.filter(d => d !== disease) : [...prev, disease]
    );
  };

  const handleAdditionalChange = (index, value) => {
    const updated = [...additionalChronicInputs];
    updated[index] = value;
    setAdditionalChronicInputs(updated);
  };

  const addAdditionalField = () => {
    setAdditionalChronicInputs([...additionalChronicInputs, ""]);
  };

  const removeAdditionalField = (index) => {
    setAdditionalChronicInputs(additionalChronicInputs.filter((_, i) => i !== index));
  };

  const handleErTransportChange = (index, value) => {
    const updated = [...erVisitsList];
    updated[index].transportMode = value;
    setErVisitsList(updated);
  };

  const addErVisitRecord = () => {
    setErVisitsList([...erVisitsList, { transportMode: "Walk-in" }]);
  };

  const removeErVisitRecord = (index) => {
    setErVisitsList(erVisitsList.filter((_, i) => i !== index));
  };

  const filteredAdditional = additionalChronicInputs.filter(item => item.trim() !== "");
  const totalChronicCount = selectedCommonChronic.length + filteredAdditional.length;

  const getTransportScore = (method) => {
    if (method === "Ambulance") return 3;
    if (method === "Wheelchair") return 2;
    return 1;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.age) return alert("Name and Age are required.");

    const allChronicList = [...selectedCommonChronic, ...filteredAdditional];
    
    const formattedErVisits = erVisitsList.map((visit, idx) => ({
      visitNumber: idx + 1,
      transportMode: visit.transportMode,
      severityScore: getTransportScore(visit.transportMode)
    }));

    const aggregatedChronicSummary = JSON.stringify({
      chronicConditionsList: allChronicList,
      totalChronicDiseasesCount: totalChronicCount,
      erVisitsCount: erVisitsList.length,
      erVisitsDetails: formattedErVisits
    });

    const completeProfileData = {
      ...formData,
      chronicConditions: aggregatedChronicSummary,
      id: initialData?.id || `fam-${Date.now()}`
    };

    onSubmit(completeProfileData);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[85vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Full Name
          </label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Jane Doe" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Age</label>
          <input type="number" name="age" value={formData.age} onChange={handleChange} placeholder="e.g. 45" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Droplet className="w-3.5 h-3.5 text-red-500" /> Blood Group
          </label>
          <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-2 pl-3 pr-8 text-sm outline-none focus:ring-2 focus:ring-teal-500 appearance-none">
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-500" /> Emergency Contact
          </label>
          <input type="tel" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} placeholder="+1 234 567 8900" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      </div>

      {/* Chronic Conditions Selection Section */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 overflow-hidden">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-500" /> Chronic Conditions
          </label>
          <span className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800 shrink-0">
            Total: {totalChronicCount}
          </span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COMMON_CHRONIC_LIST.map(disease => {
            const isSelected = selectedCommonChronic.includes(disease);
            return (
              <button
                type="button"
                key={disease}
                onClick={() => toggleCommonChronic(disease)}
                className={`text-xs px-3 py-2 rounded-lg border text-center font-medium transition-all truncate ${
                  isSelected 
                    ? "bg-amber-100/80 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300 shadow-sm" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/80"
                }`}
                title={disease}
              >
                {disease}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-medium text-slate-500">Other / Additional Conditions:</span>
          {additionalChronicInputs.map((val, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={val}
                onChange={(e) => handleAdditionalChange(idx, e.target.value)}
                placeholder="e.g. Thyroid, Chronic Bronchitis"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-3 text-xs outline-none focus:ring-1 focus:ring-teal-500 truncate"
              />
              {additionalChronicInputs.length > 1 && (
                <button type="button" onClick={() => removeAdditionalField(idx)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAdditionalField}
            className="self-start flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 mt-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add condition
          </button>
        </div>
      </div>

      {/* ER Visits & Individual Transport Mode Section */}
      <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 overflow-hidden">
        <div className="flex justify-between items-center">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            ER Visits & Transportation Modes ({erVisitsList.length})
          </label>
          <button
            type="button"
            onClick={addErVisitRecord}
            className="flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add ER Visit
          </button>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
          {erVisitsList.map((visit, index) => (
            <div key={index} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap shrink-0">Visit #{index + 1}</span>
              <select
                value={visit.transportMode}
                onChange={(e) => handleErTransportChange(index, e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg py-1.5 px-2.5 text-xs outline-none focus:ring-1 focus:ring-teal-500 truncate"
              >
                <option value="Ambulance">Ambulance (Score: 3)</option>
                <option value="Wheelchair">Wheelchair (Score: 2)</option>
                <option value="Walk-in">Walk-in (Score: 1)</option>
              </select>
              {erVisitsList.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeErVisitRecord(index)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Allergies
        </label>
        <input 
          type="text" 
          name="allergies" 
          value={formData.allergies} 
          onChange={handleChange} 
          placeholder="e.g. Penicillin, Peanuts" 
          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" 
        />
      </div>

      <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-bold bg-slate-200 dark:bg-slate-800 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={isLoading} className="px-4 py-2 text-sm font-bold bg-teal-600 text-white rounded-lg hover:bg-teal-700">
          {initialData ? "Save Changes" : "Create Profile"}
        </button>
      </div>
    </form>
  );
}