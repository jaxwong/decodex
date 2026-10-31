import React from 'react';
import { Link } from 'react-router-dom';

function Hero() {
    const featuredCategories = [
        { 
            id: 1, 
            title: "Sneakers", 
            subtitle: "Latest Arrivals", 
            img: "/images/sneakers.png", 
            count: "20+ Products", 
            discount: "Up to 50% Off",
            bgGradient: "from-orange-100 to-orange-50"
        },
        { 
            id: 2, 
            title: "Bags", 
            subtitle: "Premium Collection", 
            img: "/images/Bag.png", 
            count: "15+ Products", 
            discount: "Up to 60% Off",
            bgGradient: "from-pink-100 to-pink-50"
        },
    ];

    return (
        <section className="py-4 sm:py-6">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                {/* Main Hero Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                    
                    {/* Main Banner - Left side */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-shopee via-shopee to-shopee2 rounded-sm p-4 sm:p-6 md:p-8 flex flex-col md:flex-row items-center gap-4 sm:gap-6 relative overflow-hidden shadow-lg">
                        {/* Background decorative elements */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                        
                        <div className="flex-1 relative z-10 text-center md:text-left">
                            <div className="inline-block bg-yellow-400 text-shopee text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full mb-2 sm:mb-3 shadow-md">
                                🔥 MEGA SALE
                            </div>
                            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 leading-tight">
                                Shop the Latest<br/>
                                <span className="text-yellow-300">Trending Picks</span>
                            </h1>
                            <p className="text-white/90 text-xs sm:text-sm md:text-base mb-3 sm:mb-4 max-w-md">
                                Discover exclusive deals and discounts curated just for you. Save up to 70% on top brands!
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center md:justify-start">
                                <Link to="/" className="bg-white text-shopee font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-sm hover:bg-yellow-300 transition-all shadow-lg text-xs sm:text-sm">
                                    Shop Now
                                </Link>
                                <Link to="/" className="border-2 border-white/80 text-white font-medium px-5 sm:px-6 py-2 sm:py-2.5 rounded-sm hover:bg-white/10 transition-all text-xs sm:text-sm">
                                    View All Deals
                                </Link>
                            </div>
                        </div>
                        
                        <div className="relative z-10 hidden sm:block">
                            <img src="/images/banner3.png" alt="Sale Banner" className="w-48 md:w-56 lg:w-64 h-auto object-contain drop-shadow-2xl" />
                        </div>
                    </div>

                    {/* Featured Categories - Right side */}
                    <aside className="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
                        {featuredCategories.map((category) => (
                            <Link 
                                key={category.id}
                                to="/"
                                className={`bg-gradient-to-br ${category.bgGradient} rounded-sm p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:shadow-xl transition-all duration-300 group border border-gray-100`}
                            >
                                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 relative">
                                    <img 
                                        src={category.img} 
                                        alt={category.title} 
                                        className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-lg" 
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="bg-shopee/10 text-shopee text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                                        {category.discount}
                                    </span>
                                    <h3 className="font-bold text-gray-800 text-sm sm:text-base mt-1 truncate">{category.title}</h3>
                                    <p className="text-[10px] sm:text-xs text-gray-500">{category.subtitle}</p>
                                    <p className="text-[10px] sm:text-xs text-shopee font-medium mt-0.5">{category.count}</p>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" className="text-gray-400 group-hover:text-shopee group-hover:translate-x-1 transition-all flex-shrink-0">
                                    <path fill="currentColor" d="M8.59 16.59L13.17 12L8.59 7.41L10 6l6 6l-6 6l-1.41-1.41z"/>
                                </svg>
                            </Link>
                        ))}
                    </aside>
                </div>

                {/* Trust Badges Row */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {[
                        { icon: "🚚", title: "Free Shipping", desc: "On orders over ₱500" },
                        { icon: "✅", title: "100% Authentic", desc: "Verified products" },
                        { icon: "🔄", title: "Easy Returns", desc: "15-day free returns" },
                        { icon: "🛡️", title: "Secure Payment", desc: "Multiple options" },
                    ].map((badge, idx) => (
                        <div key={idx} className="bg-white rounded-sm p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <span className="text-xl sm:text-2xl">{badge.icon}</span>
                            <div className="min-w-0">
                                <h4 className="font-semibold text-gray-800 text-[11px] sm:text-xs truncate">{badge.title}</h4>
                                <p className="text-[9px] sm:text-[10px] text-gray-500 truncate">{badge.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default Hero;
