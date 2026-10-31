import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

// Shopee's thin top bar. Only links that lead somewhere in this demo are kept.
function Nav() {
  return (
    <header className="w-full bg-gradient-to-b from-shopee to-shopee2 text-white text-[11px] sm:text-[13px]">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-2 sm:px-4 py-1">
        <nav className="flex items-center gap-1">
          <TopLink to="/SellerCentre">Seller Centre</TopLink>
          <Divider />
          <span className="text-white/80 px-2 hidden sm:inline">Follow us on</span>
          <a href="https://www.facebook.com/ShopeePH/" target="_blank" rel="noreferrer" aria-label="Shopee on Facebook" className="hover:opacity-80 px-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="white" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95"/></svg>
          </a>
          <a href="https://www.instagram.com/shopee_ph/" target="_blank" rel="noreferrer" aria-label="Shopee on Instagram" className="hover:opacity-80 px-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="white" d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3Z"/></svg>
          </a>
        </nav>
        <span className="text-white/80 px-2">Demo storefront · synthetic catalog</span>
      </div>
    </header>
  );
}

function TopLink({ to, children }) {
  return (
    <Link to={to} className="flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 hover:text-white/80 transition-colors">
      <span>{children}</span>
    </Link>
  );
}

TopLink.propTypes = {
  to: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function Divider() {
  return <span className="text-white/40">|</span>;
}

export default Nav;
