import { useEffect, useState } from 'react';
import { useEmergencyStore } from '../store/useEmergencyStore';

export default function useWebSocket(emergencyId) {
  const [isConnected, setIsConnected] = useState(false);
  const setDriverPosition = useEmergencyStore((state) => state.setDriverPosition);
  const activeEmergency = useEmergencyStore((state) => state.activeEmergency);

  useEffect(() => {
    if (!emergencyId || !activeEmergency?.location) return;

    setIsConnected(true);
    
    // Disabled automatic interval movement to keep ambulance resting at start or controlled strictly via milestone buttons in DriverAlert.
    if (activeEmergency?.routePoints && activeEmergency.routePoints.length > 0) {
      setDriverPosition(activeEmergency.routePoints[0]);
    }

    return () => {
      setIsConnected(false);
    };
  }, [emergencyId, activeEmergency?.location, activeEmergency?.routePoints, setDriverPosition]);

  return { isConnected };
}