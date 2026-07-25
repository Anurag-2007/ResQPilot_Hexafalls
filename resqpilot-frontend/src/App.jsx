import React, { useState, useEffect } from "react";
import { useEmergencyStore } from "./store/useEmergencyStore";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FamilyVault from "./pages/FamilyVault";
import { setCookie, getCookie } from "./utils/cookies";

export default function App() {
  const store = useEmergencyStore();
  const user = store.user;
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  useEffect(() => {
    const savedSession = getCookie("resqpilot_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        store.setUser(session.user);
        store.setRole(session.role);
      } catch {}
    }
    setSessionChecked(true);
  }, []);

  const handleLoginSuccess = (userData) => {
    const role = userData.role || (userData.name?.split("@")[0] === "driver" ? "driver" : "citizen");
    setCookie("resqpilot_session", JSON.stringify({ user: userData, role }), 7);
    store.setUser(userData);
    store.setRole(role);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    store.setUser(null);
    store.setRole("citizen");
    setCookie("resqpilot_session", "", -1);
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex justify-center items-center gap-4">
        <div className="spinner"></div>
        <span className="font-medium">Loading ResQPilot...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {!user ? (
        <Login onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />
      ) : currentPage === "vault" ? (
        <FamilyVault onBack={() => setCurrentPage("dashboard")} />
      ) : (
        <Dashboard
          onLogout={handleLogout}
          onNavigateToVault={() => setCurrentPage("vault")}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}