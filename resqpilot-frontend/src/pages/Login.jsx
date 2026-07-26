import React, { useState } from "react";
import { Hospital, Car, Home, Zap, ArrowRight, Sun, Moon } from "lucide-react";
import Button from "../components/common/Button";

const ROLES = [
  { id: "citizen", label: "Citizen", desc: "Report emergencies and manage profiles", icon: Home },
  { id: "admin", label: "Hospital", desc: "Manage ER queues and track beds", icon: Hospital },
  { id: "driver", label: "Ambulance", desc: "Accept dispatches and navigate", icon: Car },
];

export default function Login({ onLoginSuccess, theme, toggleTheme }) {
  const [selectedRole, setSelectedRole] = useState("citizen");
  const [loading, setLoading] = useState(false);

  const handleEnter = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const roleConfig = ROLES.find((r) => r.id === selectedRole);
    onLoginSuccess({ name: roleConfig.label, role: selectedRole, token: "mock-token" });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col select-none text-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between px-6 py-5">
      <div className="flex items-center gap-2">
  <img 
    src="/logo.png" 
    alt="ResQPilot Logo" 
    className="w-23 h-23 object-contain" 
  />
  <span className="font-black text-lg">ResQPilot</span>
</div>
        <button onClick={toggleTheme} className="p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md">
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Rapid Dispatch.</h1>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Intelligent Routing.</h1>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Lifesaving Results.</h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">Select your portal to enter the emergency system.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`text-left rounded-xl border p-6 transition-all duration-200 ${
                  isSelected ? "border-teal-500 bg-teal-50 dark:bg-teal-900/10 ring-2 ring-teal-500/50" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                  isSelected ? "bg-teal-100 text-teal-700 dark:bg-teal-800/30 dark:text-teal-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-1">{role.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{role.desc}</p>
                <div className={`flex items-center gap-1 text-sm font-semibold ${isSelected ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}`}>
                  Enter portal <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-10">
          <Button onClick={handleEnter} isLoading={loading} className="px-10 py-3 bg-teal-600 text-white rounded-lg text-lg">Proceed to dashboard</Button>
        </div>
      </main>
    </div>
  );
}