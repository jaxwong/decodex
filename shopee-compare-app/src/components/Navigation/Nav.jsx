import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Nav() {
  const location = useLocation();

  return (
    <header className="w-full bg-gradient-to-b from-shopee to-shopee2 text-white text-[11px] sm:text-[13px]">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-2 sm:px-4 py-1">
        {/* Left side links - hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1">
          <TopLink to="/Login">Seller Centre</TopLink>
          <Divider />
          <TopLink to="/Login">Start Selling</TopLink>
          <Divider />
          <TopLink to="/Login">Download</TopLink>
          <Divider />
          <span className="text-white/80 px-2">Follow us on</span>
          <a href="https://www.facebook.com/ShopeePH/" target="_blank" rel="noreferrer" className="hover:opacity-80 px-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="white" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95"/></svg>
          </a>
          <a href="https://www.instagram.com/shopee_ph/" target="_blank" rel="noreferrer" className="hover:opacity-80 px-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="white" d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3Z"/></svg>
          </a>
        </nav>

        {/* Mobile: Show Download link on left */}
        <nav className="flex md:hidden items-center gap-2">
          <TopLink to="/Login" className="text-[10px]">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="mr-1">
              <path d="M17 18v1H6v-1h11zm-.5-6.6l-.7-.7l-2.8 2.8V5h-1v9.5l-2.8-2.8l-.7.7l4 4l4-4z"/>
            </svg>
            Download App
          </TopLink>
        </nav>

        {/* Right side links */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {/* Desktop only notification */}
          <span className="hidden sm:flex">
            <TopLink to="/Login" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="white" d="M5 19v-1h1.6V10c0-1.867.567-3.408 1.7-4.625C9.433 4.158 10.8 3.467 12.4 3.2V2.5c0-.417.142-.77.425-1.058A1.406 1.406 0 0 1 13.85 1c.417 0 .775.147 1.075.442c.3.295.45.65.45 1.058v.7c1.6.267 2.967.958 4.1 2.175C20.608 6.592 21.175 8.133 21.175 10v8h1.6v1H5Zm7.975 3.8c-.533 0-1-.192-1.4-.575a1.918 1.918 0 0 1-.6-1.425h4c0 .567-.2 1.05-.6 1.45c-.4.4-.867.55-1.4.55Z"/></svg>}>
              Notification
            </TopLink>
            <Divider />
          </span>
          {/* Desktop only help */}
          <span className="hidden sm:flex">
            <TopLink to="/Login" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="white" d="M11.95 18q.525 0 .888-.363t.362-.887q0-.525-.362-.888t-.888-.362q-.525 0-.887.363t-.363.887q0 .525.363.888t.887.362Zm-.9-3.85h1.85q0-.825.188-1.3t1.062-1.3q.65-.65 1.025-1.238T15.55 8.9q0-1.4-1.025-2.15T12.1 6q-1.425 0-2.312.75T8.55 8.55l1.65.65q.125-.45.563-.975T12.1 7.7q.8 0 1.2.438t.4.962q0 .5-.3.938t-.75.812q-1.1.975-1.35 1.475t-.25 1.825ZM12 22q-2.075 0-3.9-.788t-3.175-2.137q-1.35-1.35-2.137-3.175T2 12q0-2.075.788-3.9t2.137-3.175q1.35-1.35 3.175-2.137T12 2q2.075 0 3.9.788t3.175 2.137q1.35 1.35 2.138 3.175T22 12q0 2.075-.788 3.9t-2.137 3.175q-1.35 1.35-3.175 2.138T12 22Z"/></svg>}>
              Help
            </TopLink>
            <Divider />
          </span>
          <TopLink to="/Signup">Sign Up</TopLink>
          <Divider />
          <TopLink to="/Login">Log In</TopLink>
        </nav>
      </div>
    </header>
  );
}

function TopLink({ to, children, icon, className = '' }) {
  return (
    <Link to={to} className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 hover:text-white/80 transition-colors ${className}`}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function Divider() {
  return <span className="text-white/40 hidden sm:inline">|</span>;
}

export default Nav;
