export const Thumbtack = () => (
  <div className="absolute -top-4 left-1/2 z-20 h-8 w-8 -translate-x-1/2 pointer-events-none">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <path d="M12 12V22" stroke="#4E3629" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="12" cy="10" rx="7" ry="4.5" fill="#FF5E5E" stroke="#4E3629" strokeWidth="3" />
      <circle cx="12" cy="6" r="4" fill="#FF5E5E" stroke="#4E3629" strokeWidth="3" />
      <circle cx="10.5" cy="5" r="1.5" fill="white" />
    </svg>
  </div>
);

export const CurledCorner = () => <div className="cute-page-curl" />;
