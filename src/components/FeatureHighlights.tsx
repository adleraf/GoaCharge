

export const FeatureHighlights: React.FC = () => {
  const features = [
    { icon: '🔋', text: 'Fast Charging' },
    { icon: '🗺️', text: 'Real-time Map' },
    { icon: '🌿', text: '100% Green Energy' }
  ];

  return (
    <div className="features-container animate-fade-in-up delay-100">
      {features.map((f, i) => (
        <div key={i} className="feature-pill">
          <span>{f.icon}</span>
          <span>{f.text}</span>
        </div>
      ))}
    </div>
  );
};
