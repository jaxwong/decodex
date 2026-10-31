import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useShop } from '../../shop';

// Suggestions that match the demo catalog's titles, so every chip finds something.
const trendingSearches = [
    "Power bank",
    "Slim power bank",
    "Travel power bank",
    "Atlas",
    "Breeze",
    "Comet",
];

function SubNav() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { cart } = useShop();
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');

    const search = event => {
        event.preventDefault();
        navigate(`/Search?q=${encodeURIComponent(searchQuery.trim())}`);
    };

    return (
        <div className="w-full bg-shopee sticky top-0 z-50">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4 py-2 sm:py-3">
                {/* Main row: Logo + Search + Cart */}
                <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
                    {/* Logo */}
                    <Link to="/" className="flex-shrink-0">
                        <img 
                            src="/images/shopee_logo.webp" 
                            alt="Shopee" 
                            className="h-[30px] sm:h-[40px] md:h-[45px] w-auto object-contain"
                            style={{ filter: 'brightness(0) invert(1)' }}
                        />
                    </Link>
                    
                    {/* Search Bar */}
                    <form role="search" onSubmit={search} className="flex-1 flex items-center">
                        <div className="w-full bg-white rounded-sm flex items-center overflow-hidden shadow-sm">
                            <input 
                                type="search"
                                aria-label="Search products"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for power banks"
                                className="flex-1 px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-800 outline-none border-none placeholder:text-gray-400"
                            />
                            <button type="submit" aria-label="Search" className="bg-shopee2 hover:bg-orange-600 px-3 sm:px-5 py-2 sm:py-2.5 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.35-4.35"></path>
                                </svg>
                            </button>
                        </div>
                    </form>
                    
                    {/* Cart */}
                    <Link to="/Cart" aria-label={`Cart, ${cart.length} items`} className="relative flex-shrink-0 p-1 sm:p-2 hover:opacity-80 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="sm:w-[26px] sm:h-[26px]">
                            <path fill="white" d="M7 22q-.825 0-1.412-.587T5 20t.588-1.412T7 18t1.413.588T9 20t-.587 1.413T7 22m10 0q-.825 0-1.412-.587T15 20t.588-1.412T17 18t1.413.588T19 20t-.587 1.413T17 22M6.15 6l2.4 5h7l2.75-5M5.2 4h16.5l-4.975 9H8.1L7 15h12v2H3.625L6.6 11.6L3 4H1V2h3.25z"/>
                        </svg>
                        <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-white text-shopee text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                            {cart.length}
                        </span>
                    </Link>
                </div>
                
                {/* Trending searches row - horizontal scroll on mobile */}
                <div className="flex items-center gap-2 sm:gap-4 mt-2 overflow-x-auto scrollbar-hide pb-1">
                    {trendingSearches.map(term => (
                        <Link 
                            key={term}
                            to={`/Search?q=${encodeURIComponent(term)}`}
                            onClick={() => setSearchQuery(term)}
                            className="text-white text-[10px] sm:text-xs whitespace-nowrap hover:text-white/80 transition-colors bg-white/10 px-2 py-0.5 rounded-sm"
                        >
                            {term}
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default SubNav;
