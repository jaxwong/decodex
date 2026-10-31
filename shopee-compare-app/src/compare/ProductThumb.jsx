import React from 'react';

// Simple illustrated power-bank thumbnail (no real product photos in the demo).
export default function ProductThumb({ listing, className = 'w-20 h-20' }) {
  const c = listing.color;
  const brand = listing.short.split(' ')[0].toUpperCase();
  return (
    <div className={`${className} bg-gray-50 rounded flex-shrink-0 flex items-center justify-center overflow-hidden`}>
      <svg viewBox="0 0 80 80" className="w-full h-full">
        <rect x="20" y="10" width="40" height="60" rx="7" fill={c} />
        <rect x="20" y="10" width="40" height="60" rx="7" fill="url(#g)" opacity=".25" />
        <rect x="33" y="6" width="14" height="5" rx="2" fill="#555" />
        {[0, 1, 2, 3].map(i => <circle key={i} cx={30 + i * 6.5} cy="58" r="1.8" fill={i < 3 ? '#a7f3d0' : '#ffffff55'} />)}
        <text x="40" y="38" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff" fontFamily="Roboto, sans-serif">{brand}</text>
        <path d="M41 42l-5 7h4l-1 6 5-7h-4z" fill="#fff" opacity=".85" />
        <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#000" /></linearGradient></defs>
      </svg>
    </div>
  );
}
