import { useState } from "react";
import { Explore } from "./pages/Explore";
import { Brand } from './components/Brand';
import { Hero } from './components/Hero';
import { FeatureHighlights } from './components/FeatureHighlights';
import { AuthPanel } from './components/AuthPanel';
import { GoaOutline } from './components/GoaOutline';
import { WaveBackground } from './components/WaveBackground';
import { OceanSoundToggle } from './components/OceanSoundToggle';

// Import CSS architecture
import './styles/layout.css';
import './styles/components.css';
import './styles/animations.css';
import './styles/map.css';

function App() {
  const [showExplore, setShowExplore] = useState(false);

  if (showExplore) {
    return <Explore />;
  }

  return (
    <div className="app-container">
      {/* Background Layers */}
      <div className="background-layer">
        <GoaOutline />
        <WaveBackground />
      </div>

      <OceanSoundToggle />

      {/* Main Content Layout */}
      <main className="main-content">
        {/* Left / Top Section */}
        <div className="left-column">
          <Brand />
          <Hero />
          <FeatureHighlights />
        </div>

        {/* Right / Bottom Section */}
        <div className="right-column">
          <AuthPanel onLogin={() => setShowExplore(true)} />
        </div>
      </main>
    </div>
  );
}

export default App;
