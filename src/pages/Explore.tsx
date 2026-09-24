import GoaMap from "../components/GoaMap";
import { Sidebar } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { BottomStats } from "../components/BottomStats";
import "../styles/explore.css";

export function Explore() {
  return (
    <div className="explore-layout">
      <Sidebar />
      <main className="explore-main">
        <TopBar />
        <div className="map-wrapper">
          <GoaMap />
        </div>
        <BottomStats />
      </main>
    </div>
  );
}