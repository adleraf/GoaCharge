import { useState, useEffect, useMemo } from "react";
import GoaMap from "../components/GoaMap";
import { Sidebar } from "../components/Sidebar";
import { TopBar, type FilterType } from "../components/TopBar";
import { BottomStats } from "../components/BottomStats";
import { StationDetailCard } from "../components/StationDetailCard";
import { fetchChargers } from "../services/chargerService";
import type { GoaChargeStation } from "../types/station";
import "../styles/explore.css";

export function Explore() {
  const [allStations, setAllStations] = useState<GoaChargeStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStation, setSelectedStation] = useState<GoaChargeStation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Fetch real Goa charging stations from our backend proxy
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchChargers()
      .then((res) => {
        if (!isMounted) return;
        setAllStations(res.stations);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("[Explore] Failed to load stations:", err);
        setError(err.message || "Failed to load charging stations");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter stations by active filter and search query
  const filteredStations = useMemo(() => {
    let result = allStations;

    // 1. Filter by category
    if (activeFilter === "fast") {
      result = result.filter((s) =>
        s.connections.some((c) => (c.powerKW != null && c.powerKW >= 50) || c.levelId === 3)
      );
    } else if (activeFilter === "dc") {
      result = result.filter((s) =>
        s.connections.some((c) => c.currentTypeId === 30)
      );
    } else if (activeFilter === "ac") {
      result = result.filter((s) =>
        s.connections.some((c) => c.currentTypeId === 10 || c.currentTypeId === 20)
      );
    }

    // 2. Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.town && s.town.toLowerCase().includes(q)) ||
          (s.addressLine1 && s.addressLine1.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allStations, activeFilter, searchQuery]);

  // Synchronized station selection
  const handleSelectStation = (station: GoaChargeStation) => {
    setSelectedStation(station);
    setFlyToCoords([station.longitude, station.latitude]);
    // Close mobile drawer if open
    setIsMobileSidebarOpen(false);
  };

  const handleCloseDetail = () => {
    setSelectedStation(null);
  };

  const handleFocusStation = () => {
    if (selectedStation) {
      setFlyToCoords([selectedStation.longitude, selectedStation.latitude]);
    }
  };

  return (
    <div className="explore-layout">
      {/* Sidebar with responsive toggle */}
      <Sidebar
        stations={filteredStations}
        loading={loading}
        selectedStationId={selectedStation?.ocmId ?? null}
        onSelectStation={handleSelectStation}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Map View Area */}
      <main className="explore-main">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          stations={allStations}
          onSelectStation={handleSelectStation}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onToggleMobileMenu={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        <div className="map-wrapper">
          <GoaMap
            stations={filteredStations}
            selectedStationId={selectedStation?.ocmId ?? null}
            onSelectStation={handleSelectStation}
            flyToCoords={flyToCoords}
          />
        </div>

        {/* Selected Station Detail Panel */}
        {selectedStation && (
          <StationDetailCard
            station={selectedStation}
            onClose={handleCloseDetail}
            onFocusOnMap={handleFocusStation}
          />
        )}

        {/* Dynamic Statistics Bar */}
        <BottomStats
          stations={allStations}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {/* Error Notification */}
        {error && (
          <div className="explore-error-toast" role="alert">
            <span>⚠️ {error}</span>
          </div>
        )}
      </main>
    </div>
  );
}