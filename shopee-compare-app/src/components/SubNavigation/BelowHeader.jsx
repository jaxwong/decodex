import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

function BelowHeader() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [flashDealTime, setFlashDealTime] = useState({ hours: 2, minutes: 45, seconds: 30 });
    const flashSaleRef = useRef(null);
    
    const mainBanners = [
        "/images/banner3.png",
        "/images/banner1.png",
        "/images/banner2.jfif"
    ];

    const quickLinks = [
        { src: "/images/banner_below1.png", text: "50% Off Deals", link: "/", badge: "Hot" },
        { src: "/images/banner_below2.png", text: "Shopee Mall", link: "/" },
        { src: "/images/banner_below3.png", text: "On-time Delivery", link: "/" },
        { src: "/images/banner_below5.png", text: "Shopee Choice", link: "/", badge: "New" },
        { src: "/images/banner_below6.png", text: "Beauty Sale", link: "/" },
        { src: "/images/banner_below7.png", text: "Free Shipping", link: "/" },
        { src: "/images/banner_below8.png", text: "Shopee Coins", link: "/" },
        { src: "/images/banner_below9.png", text: "Gadget Zone", link: "/" },
        { src: "/images/banner_below4.png", text: "Supermarket", link: "/" },
        { src: "/images/banner_below10.png", text: "Daily Promos", link: "/" },
    ];

    const flashDeals = [
        { id: 1, img: "/images/categories/12.png", title: "Wireless Earbuds", price: 99, originalPrice: 599, soldPercent: 92, sold: "5.2k" },
        { id: 2, img: "/images/sneakers.png", title: "Sports Sneakers", price: 299, originalPrice: 1299, soldPercent: 78, sold: "3.8k" },
        { id: 3, img: "/images/bag.webp", title: "Travel Backpack", price: 199, originalPrice: 899, soldPercent: 85, sold: "4.1k" },
        { id: 4, img: "/images/categories/2.png", title: "Smart Watch", price: 499, originalPrice: 1999, soldPercent: 67, sold: "2.9k" },
        { id: 5, img: "/images/categories/15.png", title: "Skincare Set", price: 149, originalPrice: 699, soldPercent: 95, sold: "8.7k" },
        { id: 6, img: "/images/categories/17.png", title: "Laptop Stand", price: 179, originalPrice: 599, soldPercent: 55, sold: "1.5k" },
        { id: 7, img: "/images/categories/8.png", title: "Crossbody Bag", price: 129, originalPrice: 499, soldPercent: 88, sold: "6.3k" },
        { id: 8, img: "/images/categories/1.png", title: "Oversized Tee", price: 79, originalPrice: 299, soldPercent: 98, sold: "12.4k" },
    ];

    // Auto-slide carousel
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % mainBanners.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    // Flash deal countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setFlashDealTime(prev => {
                let { hours, minutes, seconds } = prev;
                seconds--;
                if (seconds < 0) { seconds = 59; minutes--; }
                if (minutes < 0) { minutes = 59; hours--; }
                if (hours < 0) { hours = 23; minutes = 59; seconds = 59; }
                return { hours, minutes, seconds };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (n) => n.toString().padStart(2, '0');

    const scrollFlashSale = (direction) => {
        if (flashSaleRef.current) {
            const scrollAmount = flashSaleRef.current.offsetWidth * 0.8;
            flashSaleRef.current.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section className="bg-gray-100">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4 py-3 sm:py-4">
                {/* Banner Carousel Section */}
                <div className="flex gap-2 sm:gap-3 mb-3 sm:mb-4">
                    {/* Main Carousel */}
                    <div className="flex-1 relative overflow-hidden rounded-sm shadow-md">
                        <div 
                            className="flex transition-transform duration-700 ease-out"
                            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                        >
                            {mainBanners.map((banner, index) => (
                                <img 
                                    key={index}
                                    src={banner} 
                                    alt={`Banner ${index + 1}`} 
                                    className="w-full h-[150px] sm:h-[220px] md:h-[250px] object-cover flex-shrink-0 cursor-pointer"
                                />
                            ))}
                        </div>
                        {/* Carousel dots */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {mainBanners.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentSlide(index)}
                                    className={`transition-all duration-300 rounded-full ${
                                        currentSlide === index 
                                            ? 'bg-white w-5 h-2' 
                                            : 'bg-white/50 w-2 h-2 hover:bg-white/80'
                                    }`}
                                />
                            ))}
                        </div>
                        {/* Prev/Next buttons */}
                        <button 
                            onClick={() => setCurrentSlide((prev) => (prev - 1 + mainBanners.length) % mainBanners.length)}
                            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 w-10 h-10 rounded-full items-center justify-center text-xl shadow-lg transition-all hover:scale-105"
                        >
                            ‹
                        </button>
                        <button 
                            onClick={() => setCurrentSlide((prev) => (prev + 1) % mainBanners.length)}
                            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 w-10 h-10 rounded-full items-center justify-center text-xl shadow-lg transition-all hover:scale-105"
                        >
                            ›
                        </button>
                    </div>
                    
                    {/* Side banners */}
                    <div className="hidden lg:flex flex-col gap-2 sm:gap-3 w-[320px]">
                        <div className="relative group cursor-pointer overflow-hidden rounded-sm">
                            <img 
                                src="/images/banner1.png" 
                                alt="Side Banner 1" 
                                className="w-full h-[120px] object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        <div className="relative group cursor-pointer overflow-hidden rounded-sm">
                            <img 
                                src="/images/banner2.jfif" 
                                alt="Side Banner 2" 
                                className="w-full h-[120px] object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                    </div>
                </div>

                {/* Quick Links Grid */}
                <div className="bg-white rounded-sm shadow-sm p-3 sm:p-4 mb-3 sm:mb-4">
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-3">
                        {quickLinks.map((item, index) => (
                            <Link 
                                to={item.link} 
                                key={index}
                                className="flex flex-col items-center gap-1.5 p-1.5 sm:p-2.5 hover:shadow-lg hover:-translate-y-0.5 rounded-sm transition-all duration-200 group relative"
                            >
                                {item.badge && (
                                    <span className={`absolute -top-1 -right-1 text-[7px] sm:text-[8px] px-1 py-0.5 rounded-sm font-bold text-white ${item.badge === 'Hot' ? 'bg-red-500' : 'bg-green-500'}`}>
                                        {item.badge}
                                    </span>
                                )}
                                <div className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center">
                                    <img 
                                        src={item.src} 
                                        alt={item.text} 
                                        className="max-w-full max-h-full object-contain group-hover:scale-115 transition-transform duration-300"
                                    />
                                </div>
                                <span className="text-[9px] sm:text-[11px] text-gray-700 text-center leading-tight line-clamp-2 group-hover:text-shopee transition-colors font-medium">
                                    {item.text}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Flash Sale Section */}
                <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                    {/* Flash Sale Header */}
                    <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-shopee via-red-500 to-shopee2 relative overflow-hidden">
                        {/* Animated background */}
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute w-20 h-20 bg-white rounded-full -top-10 -left-10 animate-pulse" />
                            <div className="absolute w-16 h-16 bg-yellow-300 rounded-full -bottom-8 right-20 animate-pulse" style={{ animationDelay: '0.5s' }} />
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-shopee sm:w-6 sm:h-6">
                                    <path fill="currentColor" d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66c.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
                                </svg>
                            </div>
                            <div>
                                <span className="text-white font-bold text-base sm:text-xl uppercase tracking-wider drop-shadow-lg">Flash Sale</span>
                                <p className="text-white/80 text-[10px] sm:text-xs hidden sm:block">Limited time deals!</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 sm:gap-3 relative z-10">
                            <span className="text-white/90 text-xs hidden sm:inline font-medium">Ends in</span>
                            <div className="flex items-center gap-1">
                                <span className="bg-black text-white text-xs sm:text-sm px-2 sm:px-2.5 py-1 sm:py-1.5 rounded font-mono font-bold shadow-lg">{formatTime(flashDealTime.hours)}</span>
                                <span className="text-white font-bold text-lg">:</span>
                                <span className="bg-black text-white text-xs sm:text-sm px-2 sm:px-2.5 py-1 sm:py-1.5 rounded font-mono font-bold shadow-lg">{formatTime(flashDealTime.minutes)}</span>
                                <span className="text-white font-bold text-lg">:</span>
                                <span className="bg-black text-white text-xs sm:text-sm px-2 sm:px-2.5 py-1 sm:py-1.5 rounded font-mono font-bold shadow-lg">{formatTime(flashDealTime.seconds)}</span>
                            </div>
                            <Link to="/" className="hidden sm:block text-white text-xs font-medium hover:underline ml-2">
                                Shop All &gt;
                            </Link>
                        </div>
                    </div>
                    
                    {/* Flash Sale Products */}
                    <div className="relative">
                        {/* Scroll buttons - desktop only */}
                        <button 
                            onClick={() => scrollFlashSale(-1)}
                            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-xl w-10 h-10 rounded-full items-center justify-center text-xl text-gray-600 hover:text-shopee transition-all"
                        >
                            ‹
                        </button>
                        <button 
                            onClick={() => scrollFlashSale(1)}
                            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/95 hover:bg-white shadow-xl w-10 h-10 rounded-full items-center justify-center text-xl text-gray-600 hover:text-shopee transition-all"
                        >
                            ›
                        </button>
                        
                        <div 
                            ref={flashSaleRef}
                            className="flex gap-2 sm:gap-3 p-3 sm:p-4 overflow-x-auto scrollbar-hide scroll-smooth"
                        >
                            {flashDeals.map((deal) => (
                                <Link 
                                    key={deal.id}
                                    to="/"
                                    className="flex-shrink-0 w-[110px] sm:w-[145px] md:w-[160px] bg-white border border-gray-100 rounded-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
                                >
                                    <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                                        <img src={deal.img} alt={deal.title} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500" />
                                        <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-600 text-[9px] sm:text-[11px] px-1.5 py-0.5 font-bold shadow-sm">
                                            -{Math.round((1 - deal.price / deal.originalPrice) * 100)}%
                                        </div>
                                        {/* Flash icon */}
                                        <div className="absolute top-0 left-0 bg-shopee text-white text-[8px] px-1 py-0.5 flex items-center gap-0.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66l.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15L11 21z"/>
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="p-2 sm:p-2.5 text-center">
                                        <p className="text-shopee font-bold text-sm sm:text-lg">₱{deal.price}</p>
                                        <p className="text-gray-400 text-[10px] sm:text-xs line-through">₱{deal.originalPrice}</p>
                                        {/* Progress bar */}
                                        <div className="mt-2 bg-orange-100 rounded-full h-4 sm:h-5 relative overflow-hidden shadow-inner">
                                            <div 
                                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-shopee to-shopee2 rounded-full transition-all duration-1000"
                                                style={{ width: `${deal.soldPercent}%` }}
                                            >
                                                {/* Shine effect */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                                            </div>
                                            <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] sm:text-[11px] font-bold drop-shadow">
                                                {deal.soldPercent >= 90 ? '🔥 ' : ''}{deal.sold} sold
                                            </span>
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

export default BelowHeader;
