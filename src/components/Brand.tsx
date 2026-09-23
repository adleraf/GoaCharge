

export const Brand: React.FC = () => {
  return (
    <div className="brand-container">
      <svg 
        className="brand-icon"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <h1 className="brand-text">GoaCharge</h1>
    </div>
  );
};
