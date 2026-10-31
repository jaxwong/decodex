import { Link } from 'react-router-dom';

// Seller Centre has its own chrome: no buyer search, cart or account links.
function SellerNav() {
    return (
        <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-2 py-3 sm:px-4">
                <Link to="/SellerCentre" className="flex items-center gap-2">
                    <img
                        src="/images/shopee_logo.webp"
                        alt="Shopee"
                        className="h-[32px] w-auto object-contain"
                        style={{ filter: 'brightness(0) saturate(100%) invert(35%) sepia(93%) saturate(1352%) hue-rotate(348deg) brightness(93%) contrast(93%)' }}
                    />
                    <span className="border-l border-gray-300 pl-2 text-lg text-gray-800">Seller Centre</span>
                </Link>
                <span className="rounded-sm bg-orange-50 px-2 py-0.5 text-xs text-shopee">Demo seller · no login</span>
                <Link to="/" className="ml-auto text-sm text-shopee hover:text-shopee2">
                    Switch to buyer view &gt;
                </Link>
            </div>
        </header>
    );
}

export default SellerNav;
