import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function OrderConfirmation() {
    const [currentStep, setCurrentStep] = useState(2); // 0: Pending, 1: Confirmed, 2: Shipped, 3: Out for Delivery, 4: Delivered

    // Order details
    const order = {
        orderId: 'SHP2401310001234',
        orderDate: 'January 31, 2026, 10:45 AM',
        estimatedDelivery: 'February 5-7, 2026',
        paymentMethod: 'Cash on Delivery',
        items: [
            { 
                id: 1, 
                title: 'Wireless Bluetooth Earbuds TWS Pro Max Noise Cancelling IPX5 Waterproof', 
                img: '/images/categories/12.png', 
                price: 299, 
                qty: 1, 
                shop: 'TechGadgets Official Store',
                variation: 'Black'
            },
            { 
                id: 2, 
                title: 'Men Casual Sneakers Breathable Running Sports Shoes Lightweight 2024', 
                img: '/images/sneakers.png', 
                price: 899, 
                qty: 2, 
                shop: 'SportShoe Hub',
                variation: 'White, Size 42'
            },
        ],
        subtotal: 2097,
        shippingFee: 50,
        voucherDiscount: 50,
        total: 2097,
    };

    // Shipping address
    const shippingAddress = {
        fullName: 'Juan Dela Cruz',
        phone: '+63 912 345 6789',
        address: '123 Rizal Street, Barangay San Antonio',
        city: 'Makati City',
        province: 'Metro Manila',
        postalCode: '1234'
    };

    // Parcel/Shipment details
    const parcel = {
        trackingNumber: 'SPXPH2401310098765',
        courier: 'Shopee Express',
        courierLogo: '🚚',
        weight: '1.2 kg',
        dimensions: '30 x 25 x 15 cm',
        packageCount: 1,
        shippingType: 'Standard Delivery',
    };

    // Tracking history
    const trackingHistory = [
        { date: 'Jan 31, 2026', time: '10:45 AM', status: 'Order Placed', description: 'Your order has been placed successfully', completed: true },
        { date: 'Jan 31, 2026', time: '11:30 AM', status: 'Payment Confirmed', description: 'Payment method: Cash on Delivery', completed: true },
        { date: 'Jan 31, 2026', time: '02:15 PM', status: 'Order Confirmed', description: 'Seller is preparing your parcel', completed: true },
        { date: 'Feb 01, 2026', time: '09:00 AM', status: 'Shipped', description: 'Parcel has been picked up by Shopee Express', completed: true },
        { date: 'Feb 01, 2026', time: '03:45 PM', status: 'In Transit', description: 'Parcel arrived at Sorting Center - Metro Manila Hub', completed: true },
        { date: 'Feb 02, 2026', time: '08:30 AM', status: 'In Transit', description: 'Parcel departed from Sorting Center', completed: currentStep >= 2 },
        { date: 'Feb 03, 2026', time: '--:--', status: 'Out for Delivery', description: 'Parcel is out for delivery', completed: currentStep >= 3 },
        { date: 'Feb 03, 2026', time: '--:--', status: 'Delivered', description: 'Parcel has been delivered', completed: currentStep >= 4 },
    ];

    const orderSteps = [
        { id: 0, label: 'Order Placed', icon: '📝' },
        { id: 1, label: 'Confirmed', icon: '✅' },
        { id: 2, label: 'Shipped', icon: '📦' },
        { id: 3, label: 'Out for Delivery', icon: '🚚' },
        { id: 4, label: 'Delivered', icon: '🎉' },
    ];

    return (
        <main className="bg-gray-100 min-h-screen py-4 sm:py-6">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                
                {/* Success Header */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-sm shadow-lg mb-4 p-6 sm:p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-1/2 translate-y-1/2" />
                    <div className="relative z-10">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" className="text-green-500">
                                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold mb-2">Order Placed Successfully!</h1>
                        <p className="text-white/90 text-sm sm:text-base mb-3">Thank you for shopping with Shopee</p>
                        <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm">
                            <span>Order ID:</span>
                            <span className="font-mono font-bold">{order.orderId}</span>
                            <button className="hover:bg-white/20 rounded p-1 transition-colors" title="Copy Order ID">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Order Progress Tracker */}
                <div className="bg-white rounded-sm shadow-sm mb-4 p-4 sm:p-6">
                    <h2 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-shopee">
                            <path fill="currentColor" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/>
                        </svg>
                        Order Status
                    </h2>
                    
                    {/* Progress Steps - Desktop */}
                    <div className="hidden sm:block">
                        <div className="flex items-center justify-between relative">
                            {/* Progress Line */}
                            <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200">
                                <div 
                                    className="h-full bg-gradient-to-r from-green-500 to-shopee transition-all duration-500"
                                    style={{ width: `${(currentStep / (orderSteps.length - 1)) * 100}%` }}
                                />
                            </div>
                            
                            {orderSteps.map((step, idx) => (
                                <div key={step.id} className="flex flex-col items-center relative z-10">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-md transition-all ${
                                        idx <= currentStep 
                                            ? 'bg-gradient-to-br from-green-500 to-shopee text-white' 
                                            : 'bg-gray-100 text-gray-400'
                                    }`}>
                                        {idx < currentStep ? '✓' : step.icon}
                                    </div>
                                    <span className={`mt-2 text-xs sm:text-sm font-medium text-center ${
                                        idx <= currentStep ? 'text-shopee' : 'text-gray-400'
                                    }`}>
                                        {step.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Progress Steps - Mobile */}
                    <div className="sm:hidden">
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {orderSteps.map((step, idx) => (
                                <div key={step.id} className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
                                    idx <= currentStep 
                                        ? 'bg-shopee/10 text-shopee' 
                                        : 'bg-gray-100 text-gray-400'
                                }`}>
                                    <span>{idx < currentStep ? '✓' : step.icon}</span>
                                    <span>{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Estimated Delivery */}
                    <div className="mt-6 p-4 bg-orange-50 rounded-sm border border-orange-100">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">📦</span>
                                <div>
                                    <p className="text-sm font-medium text-gray-800">Estimated Delivery</p>
                                    <p className="text-shopee font-bold">{order.estimatedDelivery}</p>
                                </div>
                            </div>
                            <Link to="/" className="text-shopee text-sm font-medium hover:underline">
                                Track Package →
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-4">
                        
                        {/* Shipment/Parcel Details */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-blue-500">
                                            <path fill="currentColor" d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                                        </svg>
                                        <h2 className="font-semibold text-gray-800">Shipment Details</h2>
                                    </div>
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                                        {parcel.packageCount} Package
                                    </span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <div className="bg-gray-50 rounded-sm p-3">
                                        <p className="text-xs text-gray-500 mb-1">Tracking Number</p>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-gray-800 text-sm">{parcel.trackingNumber}</span>
                                            <button className="text-shopee hover:text-shopee2 transition-colors" title="Copy">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-sm p-3">
                                        <p className="text-xs text-gray-500 mb-1">Courier</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">{parcel.courierLogo}</span>
                                            <span className="font-medium text-gray-800 text-sm">{parcel.courier}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Parcel Info Grid */}
                                <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-sm">
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 mb-1">Weight</p>
                                        <p className="font-medium text-gray-800 text-sm">{parcel.weight}</p>
                                    </div>
                                    <div className="text-center border-x border-gray-200">
                                        <p className="text-xs text-gray-500 mb-1">Dimensions</p>
                                        <p className="font-medium text-gray-800 text-sm">{parcel.dimensions}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-gray-500 mb-1">Shipping Type</p>
                                        <p className="font-medium text-gray-800 text-sm">{parcel.shippingType}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tracking History */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-shopee">
                                        <path fill="currentColor" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                                    </svg>
                                    <h2 className="font-semibold text-gray-800">Tracking History</h2>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="relative">
                                    {/* Timeline line */}
                                    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-200" />
                                    
                                    <div className="space-y-4">
                                        {trackingHistory.map((event, idx) => (
                                            <div key={idx} className="relative flex gap-4">
                                                {/* Timeline dot */}
                                                <div className={`w-4 h-4 rounded-full flex-shrink-0 z-10 ${
                                                    event.completed 
                                                        ? idx === 0 ? 'bg-green-500' : 'bg-shopee' 
                                                        : 'bg-gray-300'
                                                } ${idx === trackingHistory.findIndex(e => !e.completed) - 1 ? 'ring-4 ring-shopee/20' : ''}`} />
                                                
                                                <div className="flex-1 pb-4">
                                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                                        <div>
                                                            <p className={`font-medium text-sm ${event.completed ? 'text-gray-800' : 'text-gray-400'}`}>
                                                                {event.status}
                                                            </p>
                                                            <p className={`text-xs mt-0.5 ${event.completed ? 'text-gray-600' : 'text-gray-400'}`}>
                                                                {event.description}
                                                            </p>
                                                        </div>
                                                        <p className={`text-xs ${event.completed ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            {event.date}, {event.time}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-shopee">
                                        <path fill="currentColor" d="M7 22q-.825 0-1.412-.587T5 20t.588-1.412T7 18t1.413.588T9 20t-.587 1.413T7 22m10 0q-.825 0-1.412-.587T15 20t.588-1.412T17 18t1.413.588T19 20t-.587 1.413T17 22M5.2 4h16.5l-4.975 9H8.1L7 15h12v2H3.625L6.6 11.6L3 4H1V2h3.25z"/>
                                    </svg>
                                    <h2 className="font-semibold text-gray-800">Order Items</h2>
                                    <span className="text-gray-400 text-sm">({order.items.length} items)</span>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {order.items.map((item) => (
                                    <div key={item.id} className="p-4 flex gap-3">
                                        <img src={item.img} alt={item.title} className="w-16 h-16 sm:w-20 sm:h-20 object-contain bg-gray-50 rounded flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800 line-clamp-2 mb-1">{item.title}</p>
                                            <p className="text-xs text-gray-400 mb-1">Variation: {item.variation}</p>
                                            <p className="text-xs text-gray-400 mb-2">Shop: {item.shop}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-shopee font-medium">₱{item.price.toLocaleString()}</span>
                                                <span className="text-gray-500 text-sm">x{item.qty}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Summary */}
                    <div className="lg:col-span-1 space-y-4">
                        
                        {/* Delivery Address */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" className="text-shopee">
                                        <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                    <h3 className="font-semibold text-gray-800 text-sm">Delivery Address</h3>
                                </div>
                            </div>
                            <div className="p-4">
                                <p className="font-medium text-gray-800 text-sm">{shippingAddress.fullName}</p>
                                <p className="text-gray-600 text-xs mt-1">{shippingAddress.phone}</p>
                                <p className="text-gray-600 text-xs mt-1">
                                    {shippingAddress.address}, {shippingAddress.city}, {shippingAddress.province} {shippingAddress.postalCode}
                                </p>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                                <h3 className="font-semibold text-gray-800 text-sm">Order Summary</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Order Date</span>
                                    <span className="text-gray-800 text-xs">{order.orderDate}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Payment Method</span>
                                    <span className="text-gray-800">{order.paymentMethod}</span>
                                </div>
                                <div className="border-t border-gray-100 pt-3 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span className="text-gray-800">₱{order.subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Shipping Fee</span>
                                        <span className="text-gray-800">₱{order.shippingFee}</span>
                                    </div>
                                    {order.voucherDiscount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-600">Voucher Discount</span>
                                            <span className="text-green-600">-₱{order.voucherDiscount}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="border-t border-gray-200 pt-3">
                                    <div className="flex justify-between items-baseline">
                                        <span className="font-medium text-gray-800">Total</span>
                                        <span className="text-shopee text-xl font-bold">₱{order.total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            <Link 
                                to="/"
                                className="block w-full bg-shopee hover:bg-shopee2 text-white py-3 rounded-sm font-medium text-center transition-colors"
                            >
                                Continue Shopping
                            </Link>
                            <button className="w-full border-2 border-gray-200 text-gray-700 py-2.5 rounded-sm font-medium hover:border-shopee hover:text-shopee transition-colors flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Download Receipt
                            </button>
                            <button className="w-full border-2 border-gray-200 text-gray-700 py-2.5 rounded-sm font-medium hover:border-shopee hover:text-shopee transition-colors flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                                Contact Seller
                            </button>
                        </div>

                        {/* Help Section */}
                        <div className="bg-blue-50 rounded-sm p-4 border border-blue-100">
                            <div className="flex items-start gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-blue-500 flex-shrink-0 mt-0.5">
                                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                                </svg>
                                <div>
                                    <p className="text-sm font-medium text-blue-800">Need Help?</p>
                                    <p className="text-xs text-blue-600 mt-1">
                                        If you have any issues with your order, please contact our 
                                        <Link to="/" className="underline ml-1">Customer Support</Link>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

export default OrderConfirmation;
