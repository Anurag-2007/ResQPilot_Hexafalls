import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Import Leaflet CSS directly into JS to prevent Tailwind v4 conflicts
import "leaflet/dist/leaflet.css"; 

import "./index.css";
import "./App.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);