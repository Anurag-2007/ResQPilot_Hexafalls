import React from "react";
import { CheckCircle2, Clock, Truck, Building2, MapPin } from "lucide-react";

const STEPS = [
  { id: "PENDING", label: "Requested", icon: Clock },
  { id: "TRIAGED", label: "Triaged", icon: CheckCircle2 },
  { id: "DISPATCHED", label: "Dispatched", icon: Truck },
  { id: "EN_ROUTE", label: "En Route", icon: MapPin },
  { id: "ARRIVED", label: "Hospital", icon: Building2 },
];

export default function Stepper({ currentStatus }) {
  const currentIndex = Math.max(0, STEPS.findIndex(s => s.id === currentStatus));
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex justify-between">
      {STEPS.map((step, idx) => {
        const Icon = step.icon;
        const isCurrent = idx === currentIndex;
        const isDone = idx <= currentIndex;
        return (
          <div key={step.id} className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isCurrent ? "bg-teal-600 text-white" : isDone ? "bg-teal-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className={`text-[11px] mt-2 font-semibold ${isCurrent ? "text-teal-600" : "text-slate-500"}`}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}