import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function Discovery() {
    const [activeTab, setActiveTab] = useState('daily');
    
    const tabs = [
        { id: 'daily', label: 'Daily Discover', icon: '🔥' },
        { id: 'latest', label: 'Latest Releases', icon: '✨' },
        { id: 'trending', label: 'Trending Now', icon: '📈' },
    ];

    const products = {
        daily: [
            { id: 1, title: 'Wireless Bluetooth Earbuds TWS Pro Max Noise Cancelling IPX5 Waterproof', img: '/images/categories/12.png', price: 299, originalPrice: 1299, sold: '45.2k', location: 'Metro Manila', rating: 4.8, reviews: 12453, isMall: true, isFreeShip: true },
            { id: 2, title: 'Men Casual Sneakers Breathable Running Sports Shoes 2024 New Arrival', img: '/images/sneakers.png', price: 549, originalPrice: 1599, sold: '32.1k', location: 'Cebu', rating: 4.7, reviews: 8921, isPreferred: true, isFreeShip: true },
            { id: 3, title: 'Large Capacity Laptop Backpack Waterproof USB Charging Port Travel Bag', img: '/images/bag.webp', price: 399, originalPrice: 899, sold: '28.5k', location: 'Davao', rating: 4.9, reviews: 15632, isMall: true },
            { id: 4, title: 'Smart Watch Series 9 Ultra Fitness Tracker Heart Rate Blood Oxygen', img: '/images/categories/2.png', price: 899, originalPrice: 2999, sold: '18.3k', location: 'Quezon City', rating: 4.6, reviews: 6543, isPreferred: true, isFreeShip: true },
            { id: 5, title: 'Portable Power Bank 20000mAh Fast Charging Type-C PD 65W Laptop Charger', img: '/images/categories/2.png', price: 499, originalPrice: 1299, sold: '56.7k', location: 'Makati', rating: 4.8, reviews: 23456, isMall: true, isFreeShip: true },
            { id: 6, title: 'Korean Style Oversized T-Shirt Unisex Cotton Streetwear Graphic Print', img: '/images/categories/1.png', price: 149, originalPrice: 499, sold: '89.2k', location: 'Pasig', rating: 4.5, reviews: 34567, isFreeShip: true },
            { id: 7, title: 'Mechanical Gaming Keyboard RGB Backlit Hot Swappable 87 Keys Wireless', img: '/images/categories/17.png', price: 1299, originalPrice: 2999, sold: '12.4k', location: 'Taguig', rating: 4.9, reviews: 4532, isMall: true },
            { id: 8, title: 'Minimalist Crossbody Bag Women PU Leather Shoulder Sling Phone Bag', img: '/images/categories/8.png', price: 299, originalPrice: 799, sold: '67.8k', location: 'Paranaque', rating: 4.7, reviews: 18765, isPreferred: true, isFreeShip: true },
            { id: 9, title: 'LED Ring Light 26cm with Tripod Stand for TikTok Live Streaming Selfie', img: '/images/categories/18.png', price: 399, originalPrice: 999, sold: '34.5k', location: 'Laguna', rating: 4.6, reviews: 9876, isFreeShip: true },
            { id: 10, title: 'Vitamin C Serum Whitening Face Cream Anti Aging Dark Spot Remover 30ml', img: '/images/categories/15.png', price: 199, originalPrice: 599, sold: '123.4k', location: 'Bulacan', rating: 4.8, reviews: 45678, isMall: true, isFreeShip: true },
            { id: 11, title: 'Foldable Laptop Stand Aluminum Adjustable Notebook Holder Ergonomic', img: '/images/categories/17.png', price: 349, originalPrice: 899, sold: '21.6k', location: 'Cavite', rating: 4.7, reviews: 7654, isPreferred: true },
            { id: 12, title: 'Pet Dog Cat Automatic Feeder Smart Food Dispenser WiFi App Control', img: '/images/categories/11.png', price: 1499, originalPrice: 3499, sold: '8.9k', location: 'Metro Manila', rating: 4.9, reviews: 2345, isMall: true, isFreeShip: true },
        ],
        latest: [
            { id: 13, title: 'iPhone 15 Pro Max 256GB Natural Titanium Brand New Factory Unlocked', img: '/images/categories/2.png', price: 62999, originalPrice: 74990, sold: '2.1k', location: 'Metro Manila', rating: 4.9, reviews: 1234, isMall: true, isFreeShip: true, isNew: true },
            { id: 14, title: 'Samsung Galaxy S24 Ultra 5G 512GB Titanium Gray Official Store', img: '/images/categories/2.png', price: 59999, originalPrice: 69990, sold: '1.8k', location: 'Cebu', rating: 4.8, reviews: 987, isMall: true, isFreeShip: true, isNew: true },
            { id: 15, title: 'MacBook Air M3 2024 15-inch 8GB 256GB Space Gray Apple Care+', img: '/images/categories/17.png', price: 72999, originalPrice: 84990, sold: '956', location: 'Makati', rating: 4.9, reviews: 543, isMall: true, isNew: true },
            { id: 16, title: 'Sony PlayStation 5 Slim Digital Edition Console 1TB SSD Bundle', img: '/images/categories/3.png', price: 24999, originalPrice: 29990, sold: '3.2k', location: 'Quezon City', rating: 4.9, reviews: 2345, isMall: true, isFreeShip: true, isNew: true },
            { id: 17, title: 'Apple Watch Series 9 GPS 45mm Midnight Aluminum Sport Band', img: '/images/categories/2.png', price: 24999, originalPrice: 29990, sold: '1.5k', location: 'Taguig', rating: 4.8, reviews: 876, isMall: true, isNew: true },
            { id: 18, title: 'AirPods Pro 2nd Gen USB-C MagSafe Charging Case Active Noise Cancel', img: '/images/categories/12.png', price: 14999, originalPrice: 17990, sold: '4.7k', location: 'Pasig', rating: 4.9, reviews: 3456, isMall: true, isFreeShip: true, isNew: true },
            { id: 19, title: 'Nintendo Switch OLED Model 64GB White Joy-Con 2024 Edition', img: '/images/categories/3.png', price: 17999, originalPrice: 21990, sold: '2.8k', location: 'Makati', rating: 4.8, reviews: 1543, isMall: true, isFreeShip: true, isNew: true },
            { id: 20, title: 'DJI Mini 4 Pro Drone 4K Camera GPS Smart Return Fly More Combo', img: '/images/categories/18.png', price: 54999, originalPrice: 64990, sold: '432', location: 'Metro Manila', rating: 4.9, reviews: 234, isMall: true, isNew: true },
        ],
        trending: [
            { id: 21, title: 'Viral TikTok Mini Projector 4K HD WiFi Portable Home Theater Cinema', img: '/images/categories/3.png', price: 2999, originalPrice: 7999, sold: '156.3k', location: 'Metro Manila', rating: 4.6, reviews: 45678, isFreeShip: true, isHot: true },
            { id: 22, title: 'Stanley Tumbler 40oz Quencher H2.0 Stainless Steel Ice Cold 24hrs', img: '/images/categories/5.png', price: 1899, originalPrice: 2999, sold: '234.5k', location: 'Cebu', rating: 4.8, reviews: 67890, isMall: true, isFreeShip: true, isHot: true },
            { id: 23, title: 'Corkcicle Insulated Water Bottle 24oz Cold Cup Aesthetic Design', img: '/images/categories/5.png', price: 1499, originalPrice: 2499, sold: '89.7k', location: 'Davao', rating: 4.7, reviews: 23456, isPreferred: true, isHot: true },
            { id: 24, title: 'Jellycat Bunny Plush Toy Soft Stuffed Animal 30cm Original Import', img: '/images/categories/7.png', price: 899, originalPrice: 1599, sold: '67.8k', location: 'Makati', rating: 4.9, reviews: 12345, isMall: true, isFreeShip: true, isHot: true },
            { id: 25, title: 'Squishmallow 16inch Plush Pillow Soft Hugging Toy Collectible', img: '/images/categories/7.png', price: 699, originalPrice: 1299, sold: '145.2k', location: 'Quezon City', rating: 4.8, reviews: 34567, isFreeShip: true, isHot: true },
            { id: 26, title: 'LEGO Icons Orchid Building Set 10311 Adults Home Decor Gift', img: '/images/categories/7.png', price: 2799, originalPrice: 3499, sold: '12.3k', location: 'Pasig', rating: 4.9, reviews: 4567, isMall: true, isHot: true },
            { id: 27, title: 'Dyson Airwrap Complete Long Prussian Blue Copper Gift Edition', img: '/images/categories/16.png', price: 29999, originalPrice: 39990, sold: '8.9k', location: 'Taguig', rating: 4.9, reviews: 2345, isMall: true, isFreeShip: true, isHot: true },
            { id: 28, title: 'Crocs Classic Clog Platform Viral TikTok Trendy Comfortable', img: '/images/categories/10.png', price: 1999, originalPrice: 3499, sold: '189.4k', location: 'Metro Manila', rating: 4.7, reviews: 56789, isPreferred: true, isFreeShip: true, isHot: true },
        ]
    };

    const currentProducts = products[activeTab] || products.daily;

    const StarRating = ({ rating }) => (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
                <svg 
                    key={i} 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="10" 
                    height="10" 
                    viewBox="0 0 24 24" 
                    fill={i < Math.floor(rating) ? "#fbbf24" : "#e5e7eb"}
                    className="drop-shadow-sm"
                >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87l1.18 6.88L12 17.77l-6.18 3.25L7 14.14L2 9.27l6.91-1.01L12 2z"/>
                </svg>
            ))}
        </div>
    );

    return (
        <section className="bg-gray-100 py-4">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                {/* Section Header with Tabs */}
                <div className="bg-white rounded-t-sm shadow-sm overflow-hidden">
                    <div className="flex border-b-4 border-shopee">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 py-3.5 sm:py-4 text-xs sm:text-sm font-semibold uppercase tracking-wide transition-all duration-200 flex items-center justify-center gap-1.5 ${
                                    activeTab === tab.id 
                                        ? 'text-shopee bg-white border-b-2 border-shopee -mb-[4px]' 
                                        : 'text-gray-500 bg-gray-50/80 hover:text-shopee hover:bg-white'
                                }`}
                            >
                                <span className="hidden sm:inline">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Products Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-[2px] sm:gap-2 bg-gray-200 sm:bg-transparent mt-[2px] sm:mt-2">
                    {currentProducts.map((product) => (
                        <Link 
                            key={product.id}
                            to="/"
                            className="bg-white rounded-none sm:rounded-sm overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group relative"
                        >
                            {/* Product Image */}
                            <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-gray-50 to-white">
                                <img 
                                    src={product.img} 
                                    alt={product.title}
                                    className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-500"
                                />
                                {/* Discount Badge */}
                                <div className="absolute top-0 right-0 bg-gradient-to-r from-yellow-400 to-yellow-500 text-red-600 text-[9px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 sm:py-1 font-bold shadow-sm">
                                    -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                                </div>
                                
                                {/* Special badges - top left */}
                                {product.isNew && (
                                    <div className="absolute top-0 left-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[8px] sm:text-[10px] px-1.5 py-0.5 font-bold flex items-center gap-0.5 shadow-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                        </svg>
                                        NEW
                                    </div>
                                )}
                                {product.isHot && (
                                    <div className="absolute top-0 left-0 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[8px] sm:text-[10px] px-1.5 py-0.5 font-bold flex items-center gap-0.5 shadow-sm animate-pulse">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                                        </svg>
                                        HOT
                                    </div>
                                )}
                                
                                {/* Bottom badges */}
                                <div className="absolute bottom-1.5 left-1.5 flex gap-0.5">
                                    {product.isMall && (
                                        <span className="bg-shopee text-white text-[7px] sm:text-[9px] px-1 py-0.5 rounded-sm font-medium shadow-sm">Mall</span>
                                    )}
                                    {product.isPreferred && (
                                        <span className="bg-blue-500 text-white text-[7px] sm:text-[9px] px-1 py-0.5 rounded-sm font-medium shadow-sm">Preferred</span>
                                    )}
                                </div>
                                {product.isFreeShip && (
                                    <div className="absolute bottom-1.5 right-1.5">
                                        <span className="bg-green-500/90 text-white text-[7px] sm:text-[9px] px-1 py-0.5 rounded-sm font-medium shadow-sm">Free Ship</span>
                                    </div>
                                )}

                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                            </div>
                            
                            {/* Product Info */}
                            <div className="p-2 sm:p-2.5">
                                <h3 className="text-[11px] sm:text-xs text-gray-800 line-clamp-2 min-h-[30px] sm:min-h-[34px] leading-tight font-medium">
                                    {product.title}
                                </h3>
                                
                                {/* Rating and reviews */}
                                <div className="flex items-center gap-1 mt-1.5">
                                    <StarRating rating={product.rating} />
                                    <span className="text-[9px] sm:text-[10px] text-gray-500">({product.reviews?.toLocaleString()})</span>
                                </div>
                                
                                {/* Price section */}
                                <div className="mt-1.5">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-shopee font-bold text-sm sm:text-base lg:text-lg">
                                            ₱{product.price.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <span className="text-gray-400 text-[9px] sm:text-[10px] line-through">
                                            ₱{product.originalPrice.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* Sold and location */}
                                <div className="flex items-center justify-between mt-1 text-[9px] sm:text-[10px] text-gray-400">
                                    <span className="font-medium">{product.sold} sold</span>
                                    <span className="truncate max-w-[60px] sm:max-w-[80px]">{product.location}</span>
                                </div>
                            </div>

                            {/* Add to cart quick action - show on hover */}
                            <div className="absolute bottom-0 left-0 right-0 h-0 group-hover:h-9 bg-shopee/95 flex items-center justify-center overflow-hidden transition-all duration-300">
                                <span className="text-white text-xs font-medium">View Details</span>
                            </div>
                        </Link>
                    ))}
                </div>
                
                {/* See More Button */}
                <div className="flex justify-center mt-5 mb-3">
                    <button className="bg-white border-2 border-gray-200 text-gray-700 px-10 sm:px-16 md:px-24 py-2.5 sm:py-3 text-xs sm:text-sm font-medium hover:bg-shopee hover:text-white hover:border-shopee transition-all duration-300 rounded-sm shadow-sm">
                        See More
                    </button>
                </div>
            </div>
        </section>
    );
}

export default Discovery;