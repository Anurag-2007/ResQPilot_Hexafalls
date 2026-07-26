import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { useEmergencyStore } from "./store/useEmergencyStore";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FamilyVault from "./pages/FamilyVault";
import { setCookie, getCookie } from "./utils/cookies";

// 1. Helper component to manage protected routes and navigation
function AppRoutes({ user, handleLoginSuccess, handleLogout, theme, toggleTheme }) {
  const navigate = useNavigate();

  return (
    <Routes>
      {/* 
        MAIN URL ("/") -> DEFAULT LOAD IS LOGIN
        If the user is NOT logged in (!user), show the Login page.
        If they ARE logged in, instantly redirect them to the Dashboard.
      */}
      <Route 
        path="/" 
        element={
          !user ? (
            <Login onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } 
      />

      {/* DASHBOARD URL */}
      <Route 
        path="/dashboard" 
        element={
          user ? (
            <Dashboard
              onLogout={handleLogout}
              onNavigateToVault={() => navigate("/vault")} // Changes URL to /vault
              theme={theme}
              toggleTheme={toggleTheme}
            />
          ) : (
            <Navigate to="/" replace /> // Protect route: kick back to login if not logged in
          )
        } 
      />

      {/* FAMILY VAULT URL */}
      <Route 
        path="/vault" 
        element={
          user ? (
            <FamilyVault onBack={() => navigate("/dashboard")} /> // Changes URL back to /dashboard
          ) : (
            <Navigate to="/" replace /> // Protect route: kick back to login if not logged in
          )
        } 
      />

      {/* Fallback for any unknown URLs: Kick back to Main URL (Login) */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// 2. Main App Component
export default function App() {
  const store = useEmergencyStore();
  const user = store.user;
  const [sessionChecked, setSessionChecked] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  // Handle Dark/Light mode toggling
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === "light" ? "dark" : "light"));

  // Check for existing login session on initial load
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

  // Handle successful login
  const handleLoginSuccess = (userData) => {
    const role = userData.role || (userData.name?.split("@")[0] === "driver" ? "driver" : "citizen");
    setCookie("resqpilot_session", JSON.stringify({ user: userData, role }), 7);
    store.setUser(userData);
    store.setRole(role);
  };

  // Handle logout
  const handleLogout = () => {
    store.setUser(null);
    store.setRole("citizen");
    setCookie("resqpilot_session", "", -1);
  };

  // Show a loading spinner while checking cookies so it doesn't flash the login screen inappropriately 
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
      <Router>
        <AppRoutes 
          user={user} 
          handleLoginSuccess={handleLoginSuccess} 
          handleLogout={handleLogout} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
      </Router>
    </div>
  );
}