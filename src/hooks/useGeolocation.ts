/**
 * useGeolocation — React hook wrapping navigator.geolocation.watchPosition.
 *
 * Tracks the user's live coordinates while the app is open.
 * Returns { coords, error, permissionState, isWatching, startWatching, stopWatching }.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface UserCoords {
  latitude: number;
  longitude: number;
  accuracy: number; // metres
}

export type GeolocationPermission = "prompt" | "granted" | "denied" | "unavailable";

interface UseGeolocationReturn {
  coords: UserCoords | null;
  error: string | null;
  permissionState: GeolocationPermission;
  isWatching: boolean;
  startWatching: () => void;
  stopWatching: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<GeolocationPermission>("prompt");
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Query permission status on mount (Permission API is available in most browsers)
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionState("unavailable");
      return;
    }

    if (navigator.permissions) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          setPermissionState(status.state as GeolocationPermission);
          status.addEventListener("change", () => {
            setPermissionState(status.state as GeolocationPermission);
          });
        })
        .catch(() => {
          // Permissions API not supported — stay on "prompt"
        });
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setPermissionState("unavailable");
      return;
    }

    // Clear any prior watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setError(null);
    setIsWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setPermissionState("granted");
        setError(null);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("Location permission denied.");
            setPermissionState("denied");
            break;
          case err.POSITION_UNAVAILABLE:
            setError("Location data unavailable.");
            break;
          case err.TIMEOUT:
            setError("Location request timed out.");
            break;
          default:
            setError("An unknown location error occurred.");
        }
        setIsWatching(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10_000, // 10 s cache
        timeout: 15_000,
      }
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { coords, error, permissionState, isWatching, startWatching, stopWatching };
}
