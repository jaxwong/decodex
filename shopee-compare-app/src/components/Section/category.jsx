import React, { useRef } from 'react';
import { Link } from 'react-router-dom';

function Category() {
    const scrollRef = useRef(null);
    
    const categories = [
        { imgSrc: "/images/categories/1.png", text: "Men's Apparel", count: "15.2M" },
        { imgSrc: "/images/categories/2.png", text: "Mobiles & Gadgets", count: "8.5M" },
        { imgSrc: "/images/categories/3.png", text: "Home Entertainment", count: "3.2M" },
        { imgSrc: "/images/categories/4.png", text: "Babies & Kids", count: "5.8M" },
        { imgSrc: "/images/categories/5.png", text: "Home & Living", count: "12.1M" },
        { imgSrc: "/images/categories/6.png", text: "Groceries", count: "9.4M" },
        { imgSrc: "/images/categories/7.png", text: "Toys & Games", count: "4.7M" },
        { imgSrc: "/images/categories/8.png", text: "Women's Bags", count: "7.3M" },
        { imgSrc: "/images/categories/9.png", text: "Accessories", count: "6.9M" },
        { imgSrc: "/images/categories/10.png", text: "Women's Shoes", count: "8.1M" },
        { imgSrc: "/images/categories/11.png", text: "Pet Care", count: "2.4M" },
        { imgSrc: "/images/categories/12.png", text: "Audio", count: "3.8M" },
        { imgSrc: "/images/categories/13.png", text: "Women's Apparel", count: "18.5M" },
        { imgSrc: "/images/categories/14.png", text: "Health Care", count: "4.2M" },
        { imgSrc: "/images/categories/15.png", text: "Makeup", count: "11.3M" },
        { imgSrc: "/images/categories/16.png", text: "Appliances", count: "2.1M" },
        { imgSrc: "/images/categories/17.png", text: "Computers", count: "3.6M" },
        { imgSrc: "/images/categories/18.png", text: "Cameras", count: "1.8M" },
        { imgSrc: "/images/categories/19.png", text: "Sports", count: "5.4M" },
        { imgSrc: "/images/categories/20.png", text: "Men's Bags", count: "2.9M" },
    ];

    const topPicks = [
        { id: 1, title: "iPhone 15 Pro Max 256GB Natural Titanium", img: "/images/categories/2.png", price: 62999, originalPrice: 74990, rating: 4.9, reviews: 15234, sold: "15.2k", isMall: true, isFreeShip: true },
        { id: 2, title: "Samsung Galaxy S24 Ultra 5G 512GB", img: "/images/categories/2.png", price: 59999, originalPrice: 69990, rating: 4.8, reviews: 12156, sold: "12.1k", isMall: true, isFreeShip: true },
        { id: 3, title: "MacBook Air M3 13inch 8GB 256GB", img: "/images/categories/17.png", price: 54999, originalPrice: 64990, rating: 4.9, reviews: 8543, sold: "8.5k", isMall: true },
        { id: 4, title: "Sony WH-1000XM5 Wireless Headphones", img: "/images/categories/12.png", price: 16999, originalPrice: 22990, rating: 4.8, reviews: 25321, sold: "25.3k", isMall: true, isFreeShip: true },
        { id: 5, title: "Nike Air Force 1 '07 White Sneakers", img: "/images/categories/10.png", price: 4595, originalPrice: 5495, rating: 4.7, reviews: 45876, sold: "45.8k", isPreferred: true, isFreeShip: true },
        { id: 6, title: "Dyson V15 Detect Absolute Vacuum", img: "/images/categories/16.png", price: 36999, originalPrice: 44990, rating: 4.9, reviews: 3245, sold: "3.2k", isMall: true },
        { id: 7, title: "Apple Watch Series 9 GPS 45mm", img: "/images/categories/2.png", price: 24999, originalPrice: 29990, rating: 4.8, reviews: 9876, sold: "9.8k", isMall: true, isFreeShip: true },
        { id: 8, title: "AirPods Pro 2nd Generation USB-C", img: "/images/categories/12.png", price: 14999, originalPrice: 17990, rating: 4.9, reviews: 34567, sold: "34.5k", isMall: true, isFreeShip: true },
    ];

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = scrollRef.current.offsetWidth * 0.8;
            scrollRef.current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    };

    const StarRating = ({ rating }) => (
        <div className="flex">
            {[...Array(5)].map((_, i) => (
                <svg key={i} xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" 
                    fill={i < Math.floor(rating) ? "#fbbf24" : "#e5e7eb"} className="drop-shadow-sm">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01L12 2z"/>
                </svg>
            ))}
        </div>
    );

    return (
        <section className="bg-gray-100 py-4">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                {/* Categories Section */}
                <div className="bg-white rounded-sm shadow-sm mb-4 overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
                        <h2 className="text-gray-800 text-sm sm:text-base font-bold uppercase tracking-wide">Categories</h2>
                    </div>
                    
                    {/* Categories Grid - Mobile: Horizontal scroll, Desktop: Grid */}
                    <div className="overflow-x-auto scrollbar-hide md:overflow-visible">
                        <div className="flex md:grid md:grid-cols-10 min-w-max md:min-w-0">
                            {categories.map((category, index) => (
                                <Link 
                                    key={index}
                                    to="/"
                                    className="flex flex-col items-center justify-start p-2.5 sm:p-3 md:p-4 border-r border-b border-gray-100 hover:shadow-xl hover:z-10 relative bg-white transition-all duration-200 group min-w-[85px] sm:min-w-0"
                                >
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex items-center justify-center mb-1.5 sm:mb-2 relative">
                                        <img
                                            src={category.imgSrc}
                                            alt={category.text}
                                            className="max-w-full max-h-full object-contain group-hover:scale-110 transition-transform duration-300"
                                        />
                                        {/* Hover glow effect */}
                                        <div className="absolute inset-0 bg-shopee/0 group-hover:bg-shopee/5 rounded-full transition-colors duration-300" />
                                    </div>
                                    <span className="text-[10px] sm:text-[11px] md:text-xs text-gray-700 text-center leading-tight line-clamp-2 group-hover:text-shopee transition-colors font-medium">
                                        {category.text}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top Picks For You Section */}
                <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-shopee to-shopee2 rounded-full flex items-center justify-center shadow-md">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" className="text-white">
                                    <path fill="currentColor" d="m12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5C2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"/>
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-shopee text-sm sm:text-base font-bold uppercase tracking-wide">Top Picks For You</h2>
                                <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">Handpicked recommendations just for you</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/" className="text-shopee text-xs sm:text-sm hover:text-shopee2 transition-colors font-medium">
                                See All &gt;
                            </Link>
                            {/* Scroll buttons - desktop only */}
                            <div className="hidden md:flex items-center gap-1 ml-2">
                                <button 
                                    onClick={() => scroll(-1)}
                                    className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 hover:border-shopee hover:text-shopee flex items-center justify-center text-gray-400 transition-all shadow-sm text-lg"
                                >
                                    ‹
                                </button>
                                <button 
                                    onClick={() => scroll(1)}
                                    className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 hover:border-shopee hover:text-shopee flex items-center justify-center text-gray-400 transition-all shadow-sm text-lg"
                                >
                                    ›
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Products Horizontal Scroll */}
                    <div className="relative">
                        <div 
                            ref={scrollRef}
                            className="flex gap-2 sm:gap-3 p-3 sm:p-4 overflow-x-auto scrollbar-hide scroll-smooth"
                        >
                            {topPicks.map((item) => (
                                <Link 
                                    key={item.id}
                                    to="/"
                                    className="flex-shrink-0 w-[145px] sm:w-[170px] md:w-[185px] bg-white border border-gray-100 rounded-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
                                >
                                    <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                                        <img src={item.img} alt={item.title} className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-500" />
                                        
                                        {/* Top Pick badge */}
                                        <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-shopee to-shopee2 text-white text-[8px] sm:text-[10px] px-1.5 py-0.5 rounded-sm font-medium shadow-sm flex items-center gap-0.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01L12 2z"/>
                                            </svg>
                                            Top Pick
                                        </div>
                                        
                                        {/* Discount badge */}
                                        <div className="absolute top-1.5 right-1.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-600 text-[9px] sm:text-[10px] px-1.5 py-0.5 font-bold shadow-sm">
                                            -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                                        </div>

                                        {/* Bottom badges */}
                                        <div className="absolute bottom-1.5 left-1.5 flex gap-0.5">
                                            {item.isMall && (
                                                <span className="bg-shopee text-white text-[7px] sm:text-[9px] px-1 py-0.5 rounded-sm font-medium shadow-sm">Mall</span>
                                            )}
                                            {item.isPreferred && (
                                                <span className="bg-blue-500 text-white text-[7px] sm:text-[9px] px-1 py-0.5 rounded-sm font-medium shadow-sm">Preferred</span>
                                            )}
                                        </div>
                                        {item.isFreeShip && (
                                            <div className="absolute bottom-1.5 right-1.5">
                                                <span className="bg-green-500 text-white text-[7px] sm:text-[9px] px-1 py-0.5 rounded-sm font-medium shadow-sm">Free Ship</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="p-2.5">
                                        <h3 className="text-[11px] sm:text-xs text-gray-800 line-clamp-2 min-h-[32px] leading-tight font-medium">
                                            {item.title}
                                        </h3>
                                        
                                        {/* Rating and reviews */}
                                        <div className="flex items-center gap-1 mt-1.5">
                                            <StarRating rating={item.rating} />
                                            <span className="text-[9px] text-gray-500">({item.reviews.toLocaleString()})</span>
                                        </div>
                                        
                                        {/* Price */}
                                        <div className="flex items-baseline gap-1.5 mt-1.5">
                                            <span className="text-shopee font-bold text-sm sm:text-base">₱{item.price.toLocaleString()}</span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-gray-400 text-[10px] sm:text-xs line-through">₱{item.originalPrice.toLocaleString()}</span>
                                            <span className="text-gray-500 text-[10px] font-medium">{item.sold} sold</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Category;
