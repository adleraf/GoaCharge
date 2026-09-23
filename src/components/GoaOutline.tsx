

export const GoaOutline: React.FC = () => {
  return (
    <div className="goa-map-container">
      <svg viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Abstracted silhouette of Goa coast/border */}
        <path 
          className="goa-outline-path"
          d="M50 50 C 150 100, 200 200, 180 300 C 150 450, 250 550, 300 580 C 350 500, 380 300, 320 200 C 250 100, 150 20, 50 50 Z"
        />
        
        {/* Charger markers */}
        <circle cx="160" cy="250" r="4" className="map-dot" />
        <circle cx="200" cy="380" r="4" className="map-dot" />
        <circle cx="280" cy="500" r="4" className="map-dot" />
      </svg>
    </div>
  );
};
