import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { useEmergencyStore } from "./store/useEmergencyStore";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FamilyVault from "./pages/FamilyVault";
import { setCookie, getCookie } from "./utils/cookies";

// 1. We create a helper component to manage the routes and navigation
function AppRoutes({ user, handleLoginSuccess, handleLogout, theme, toggleTheme }) {
  const navigate = useNavigate();

  // If no user is logged in, restrict them to the Login page
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />;
  }

  // If logged in, provide actual URL routes
  return (
    <Routes>
      {/* Main URL "/" loads the Dashboard */}
      <Route 
        path="/" 
        element={
          <Dashboard
            onLogout={handleLogout}
            onNavigateToVault={() => navigate("/vault")} // Changes URL to /vault
            theme={theme}
            toggleTheme={toggleTheme}
          />
        } 
      />

      {/* URL "/vault" loads the Family Vault */}
      <Route 
        path="/vault" 
        element={
          <FamilyVault onBack={() => navigate("/")} /> // Changes URL back to /
        } 
      />

      {/* Fallback for any unknown URLs: redirect to Dashboard */}
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
      {/* Wrap everything in the Router */}
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