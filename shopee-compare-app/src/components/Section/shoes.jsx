import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

function Shoes() {
    const sneakersRef = useRef(null);
    const bagsRef = useRef(null);
    const [activeCategory, setActiveCategory] = useState('all');

    const sneakers = [
        { id: 1, title: "Nike Air Max 270 React Men's Running Shoes", img: "/images/sneakers.png", price: 4999, originalPrice: 8999, rating: 4.9, sold: "12.5k", discount: 44, isMall: true, isFreeShip: true },
        { id: 2, title: "Adidas Ultraboost 22 Running Sneakers", img: "/images/sneakers.png", price: 5499, originalPrice: 9500, rating: 4.8, sold: "8.3k", discount: 42, isMall: true },
        { id: 3, title: "New Balance 574 Classic Lifestyle Shoes", img: "/images/sneakers.png", price: 3299, originalPrice: 5999, rating: 4.7, sold: "15.2k", discount: 45, isPreferred: true, isFreeShip: true },
        { id: 4, title: "Puma RS-X Reinvention Sneakers White", img: "/images/sneakers.png", price: 2899, originalPrice: 5499, rating: 4.6, sold: "9.8k", discount: 47, isFreeShip: true },
        { id: 5, title: "Converse Chuck Taylor All Star Classic", img: "/images/sneakers.png", price: 2499, originalPrice: 3999, rating: 4.8, sold: "45.6k", discount: 38, isMall: true, isFreeShip: true },
        { id: 6, title: "Vans Old Skool Black White Skateboard", img: "/images/sneakers.png", price: 2799, originalPrice: 4500, rating: 4.7, sold: "22.1k", discount: 38, isPreferred: true },
        { id: 7, title: "Jordan 1 Retro High OG Basketball Shoes", img: "/images/sneakers.png", price: 8999, originalPrice: 12999, rating: 4.9, sold: "5.4k", discount: 31, isMall: true, isHot: true },
        { id: 8, title: "Reebok Classic Leather White Gum Sole", img: "/images/sneakers.png", price: 2199, originalPrice: 4299, rating: 4.5, sold: "11.7k", discount: 49, isFreeShip: true },
    ];

    const bags = [
        { id: 101, title: "Michael Kors Jet Set Travel Tote Bag", img: "/images/bag.webp", price: 4999, originalPrice: 12999, rating: 4.9, sold: "3.2k", discount: 62, isMall: true, isFreeShip: true },
        { id: 102, title: "Coach Signature Canvas Crossbody Bag", img: "/images/Bag.png", price: 3499, originalPrice: 8999, rating: 4.8, sold: "5.1k", discount: 61, isMall: true },
        { id: 103, title: "Kate Spade New York Medium Satchel", img: "/images/bag.webp", price: 2999, originalPrice: 7499, rating: 4.7, sold: "4.8k", discount: 60, isPreferred: true, isFreeShip: true },
        { id: 104, title: "Tory Burch Robinson Small Top-Handle", img: "/images/Bag.png", price: 5999, originalPrice: 14999, rating: 4.8, sold: "2.1k", discount: 60, isMall: true, isHot: true },
        { id: 105, title: "Longchamp Le Pliage Original Tote L", img: "/images/bag.webp", price: 4299, originalPrice: 8499, rating: 4.9, sold: "7.6k", discount: 49, isMall: true, isFreeShip: true },
        { id: 106, title: "Kipling Creativity Large Pouch Bag", img: "/images/Bag.png", price: 1299, originalPrice: 2999, rating: 4.6, sold: "18.3k", discount: 57, isPreferred: true },
        { id: 107, title: "Anello Mini Backpack Water Resistant", img: "/images/bag.webp", price: 899, originalPrice: 1999, rating: 4.7, sold: "32.5k", discount: 55, isFreeShip: true },
        { id: 108, title: "Herschel Supply Classic XL Backpack", img: "/images/Bag.png", price: 2499, originalPrice: 4999, rating: 4.8, sold: "9.4k", discount: 50, isMall: true, isFreeShip: true },
    ];

    const scroll = (ref, direction) => {
        if (ref.current) {
            const scrollAmount = ref.current.offsetWidth * 0.8;
            ref.current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    };

    const ProductCard = ({ item }) => (
        <Link 
            to="/"
            className="flex-shrink-0 w-[140px] sm:w-[165px] md:w-[180px] bg-white rounded-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group border border-gray-100"
        >
            <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                <img 
                    src={item.img} 
                    alt={item.title} 
                    className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-500"
                />
                {/* Discount ribbon */}
                <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-600 text-[10px] sm:text-xs px-2 py-1 font-bold shadow-sm">
                        -{item.discount}%
                    </div>
                </div>
                {/* Hot badge */}
                {item.isHot && (
                    <div className="absolute top-0 left-0 bg-gradient-to-r from-red-500 to-red-600 text-white text-[9px] px-1.5 py-0.5 font-bold flex items-center gap-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                        </svg>
                        HOT
                    </div>
                )}
                {/* Bottom badges */}
                <div className="absolute bottom-2 left-2 flex gap-1">
                    {item.isMall && (
                        <span className="bg-shopee text-white text-[8px] px-1.5 py-0.5 rounded-sm font-medium shadow-sm">Mall</span>
                    )}
                    {item.isPreferred && (
                        <span className="bg-blue-500 text-white text-[8px] px-1.5 py-0.5 rounded-sm font-medium shadow-sm">Preferred</span>
                    )}
                </div>
                {item.isFreeShip && (
                    <div className="absolute bottom-2 right-2">
                        <span className="bg-green-500 text-white text-[8px] px-1.5 py-0.5 rounded-sm font-medium shadow-sm">Free Ship</span>
                    </div>
                )}
            </div>
            <div className="p-2.5">
                <h3 className="text-[11px] sm:text-xs text-gray-800 line-clamp-2 min-h-[32px] leading-tight font-medium">
                    {item.title}
                </h3>
                {/* Rating */}
                <div className="flex items-center gap-1 mt-1.5">
                    <div className="flex">
                        {[...Array(5)].map((_, i) => (
                            <svg key={i} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" 
                                fill={i < Math.floor(item.rating) ? "#fbbf24" : "#e5e7eb"} className="drop-shadow-sm">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        ))}
                    </div>
                    <span className="text-[10px] text-gray-500">{item.rating}</span>
                    <span className="text-[10px] text-gray-400">|</span>
                    <span className="text-[10px] text-gray-500">{item.sold} sold</span>
                </div>
                {/* Price */}
                <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-shopee font-bold text-base sm:text-lg">₱{item.price.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-gray-400 text-[10px] sm:text-xs line-through">₱{item.originalPrice.toLocaleString()}</span>
                </div>
            </div>
        </Link>
    );

    const SectionHeader = ({ title, icon, scrollRef, seeAllLink = "/" }) => (
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-2">
                {icon}
                <h2 className="text-gray-800 text-sm sm:text-base font-bold uppercase tracking-wide">{title}</h2>
            </div>
            <div className="flex items-center gap-2">
                <Link to={seeAllLink} className="text-shopee text-xs sm:text-sm hover:text-shopee2 transition-colors font-medium">
                    See All &gt;
                </Link>
                {/* Scroll buttons - desktop only */}
                <div className="hidden md:flex items-center gap-1 ml-2">
                    <button 
                        onClick={() => scroll(scrollRef, -1)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:border-shopee hover:text-shopee flex items-center justify-center text-gray-400 transition-all shadow-sm"
                    >
                        ‹
                    </button>
                    <button 
                        onClick={() => scroll(scrollRef, 1)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:border-shopee hover:text-shopee flex items-center justify-center text-gray-400 transition-all shadow-sm"
                    >
                        ›
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <section className="bg-gray-100 py-3">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4 space-y-3">
                
                {/* Trending Sneakers Section */}
                <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                    <SectionHeader 
                        title="Trending Sneakers"
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" className="text-shopee">
                                <path fill="currentColor" d="M2.6 10.59l8.24-8.24a1 1 0 0 1 1.42 0l8.24 8.24a1 1 0 0 1 0 1.42l-8.24 8.24a1 1 0 0 1-1.42 0l-8.24-8.24a1 1 0 0 1 0-1.42zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
                            </svg>
                        }
                        scrollRef={sneakersRef}
                    />
                    <div className="relative">
                        <div 
                            ref={sneakersRef}
                            className="flex gap-2 p-3 sm:p-4 overflow-x-auto scrollbar-hide scroll-smooth"
                        >
                            {sneakers.map((item) => (
                                <ProductCard key={item.id} item={item} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Featured Bags Section */}
                <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                    <SectionHeader 
                        title="Featured Bags"
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" className="text-shopee">
                                <path fill="currentColor" d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/>
                            </svg>
                        }
                        scrollRef={bagsRef}
                    />
                    <div className="relative">
                        <div 
                            ref={bagsRef}
                            className="flex gap-2 p-3 sm:p-4 overflow-x-auto scrollbar-hide scroll-smooth"
                        >
                            {bags.map((item) => (
                                <ProductCard key={item.id} item={item} />
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}

export default Shoes;
