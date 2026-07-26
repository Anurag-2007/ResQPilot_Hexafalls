import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";

// Fix React-Leaflet marker icon bug
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Auto-zooms to fit the entire route including ambulance, patient, and hospital
function RouteBoundsController({ routeCoordinates, patientLocation, driverLocation, hospitalLocation }) {
  const map = useMap();
  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      const bounds = routeCoordinates.map(c => [c.lat, c.lng]);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else if (patientLocation && driverLocation) {
      const bounds = [
        [patientLocation.lat, patientLocation.lng],
        [driverLocation.lat, driverLocation.lng]
      ];
      if (hospitalLocation) bounds.push([hospitalLocation.lat, hospitalLocation.lng]);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [routeCoordinates, patientLocation, driverLocation, hospitalLocation, map]);
  return null;
}

export default function LiveTrackingMap({ patientLocation, hospitalLocation, driverLocation, status, routeCoordinates }) {
  const defaultCenter = patientLocation || driverLocation || hospitalLocation || { lat: 22.5726, lng: 88.3639 };
  
  return (
    <div className="w-full h-full relative" style={{ minHeight: "400px" }}>
      <MapContainer 
        center={[defaultCenter.lat, defaultCenter.lng]} 
        zoom={14} 
        style={{ width: "100%", height: "100%", minHeight: "400px", zIndex: 0 }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {/* Render Continuous OSRM route line (Ambulance -> Patient -> Hospital) */}
        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline 
            positions={routeCoordinates.map(pt => [pt.lat, pt.lng])} 
            color="#0d9488" 
            weight={6} 
            opacity={0.8} 
          />
        )}

        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]}>
            <Popup>Ambulance - {status}</Popup>
          </Marker>
        )}

        {patientLocation && (
          <Marker position={[patientLocation.lat, patientLocation.lng]}>
            <Popup>Emergency Site (Patient)</Popup>
          </Marker>
        )}

        {hospitalLocation && (
          <Marker position={[hospitalLocation.lat, hospitalLocation.lng]}>
            <Popup>Destination: {hospitalLocation.name}</Popup>
          </Marker>
        )}

        <RouteBoundsController 
          routeCoordinates={routeCoordinates} 
          patientLocation={patientLocation} 
          driverLocation={driverLocation} 
          hospitalLocation={hospitalLocation} 
        />
      </MapContainer>
    </div>
  );
}