import React, { useState } from 'react';
import { Link } from 'react-router-dom';

function Checkout() {
    // Order items (would normally come from cart/context)
    const [orderItems] = useState([
        { 
            id: 1, 
            title: 'Wireless Bluetooth Earbuds TWS Pro Max Noise Cancelling IPX5 Waterproof', 
            img: '/images/categories/12.png', 
            price: 299, 
            originalPrice: 1299, 
            qty: 1, 
            shop: 'TechGadgets Official Store',
            variation: 'Black'
        },
        { 
            id: 2, 
            title: 'Men Casual Sneakers Breathable Running Sports Shoes Lightweight 2024', 
            img: '/images/sneakers.png', 
            price: 899, 
            originalPrice: 1799, 
            qty: 2, 
            shop: 'SportShoe Hub',
            variation: 'White, Size 42'
        },
    ]);

    // Shipping address state
    const [shippingAddress, setShippingAddress] = useState({
        fullName: 'Juan Dela Cruz',
        phone: '+63 912 345 6789',
        address: '123 Rizal Street, Barangay San Antonio',
        city: 'Makati City',
        province: 'Metro Manila',
        postalCode: '1234',
        isDefault: true
    });

    const [showAddressModal, setShowAddressModal] = useState(false);
    const [editAddress, setEditAddress] = useState({ ...shippingAddress });

    // Payment method state
    const [paymentMethod, setPaymentMethod] = useState('cod');
    const [cardDetails, setCardDetails] = useState({
        cardNumber: '',
        cardName: '',
        expiryDate: '',
        cvv: ''
    });

    // Voucher state
    const [voucherCode, setVoucherCode] = useState('');
    const [appliedVoucher, setAppliedVoucher] = useState(null);
    const [voucherError, setVoucherError] = useState('');

    // Shipping option
    const [shippingOption, setShippingOption] = useState('standard');

    const shippingOptions = [
        { id: 'standard', name: 'Standard Delivery', price: 50, days: '5-7 days' },
        { id: 'express', name: 'Express Delivery', price: 100, days: '2-3 days' },
        { id: 'sameday', name: 'Same Day Delivery', price: 200, days: 'Today' },
    ];

    const paymentMethods = [
        { id: 'cod', name: 'Cash on Delivery', icon: '💵', description: 'Pay when you receive' },
        { id: 'card', name: 'Credit/Debit Card', icon: '💳', description: 'Visa, Mastercard, JCB' },
        { id: 'gcash', name: 'GCash', icon: '🟢', description: 'GCash e-Wallet' },
        { id: 'maya', name: 'Maya', icon: '🟣', description: 'Maya e-Wallet' },
        { id: 'grabpay', name: 'GrabPay', icon: '🟢', description: 'GrabPay Wallet' },
        { id: 'shopeepay', name: 'ShopeePay', icon: '🧡', description: 'ShopeePay Wallet' },
    ];

    const vouchers = {
        'SHOPEE50': { discount: 50, minSpend: 500, type: 'fixed' },
        'WELCOME10': { discount: 10, minSpend: 300, type: 'percent', maxDiscount: 100 },
        'FREESHIP': { discount: 0, freeShipping: true, minSpend: 0, type: 'shipping' },
    };

    // Calculations
    const subtotal = orderItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const selectedShipping = shippingOptions.find(s => s.id === shippingOption);
    const shippingFee = appliedVoucher?.freeShipping ? 0 : selectedShipping.price;
    
    let voucherDiscount = 0;
    if (appliedVoucher && !appliedVoucher.freeShipping) {
        if (appliedVoucher.type === 'fixed') {
            voucherDiscount = appliedVoucher.discount;
        } else if (appliedVoucher.type === 'percent') {
            voucherDiscount = Math.min((subtotal * appliedVoucher.discount / 100), appliedVoucher.maxDiscount || Infinity);
        }
    }

    const total = subtotal + shippingFee - voucherDiscount;
    const totalSavings = orderItems.reduce((acc, item) => acc + ((item.originalPrice - item.price) * item.qty), 0) + voucherDiscount + (appliedVoucher?.freeShipping ? selectedShipping.price : 0);

    const applyVoucher = () => {
        const voucher = vouchers[voucherCode.toUpperCase()];
        if (!voucher) {
            setVoucherError('Invalid voucher code');
            setAppliedVoucher(null);
            return;
        }
        if (subtotal < voucher.minSpend) {
            setVoucherError(`Minimum spend of ₱${voucher.minSpend} required`);
            setAppliedVoucher(null);
            return;
        }
        setAppliedVoucher(voucher);
        setVoucherError('');
    };

    const removeVoucher = () => {
        setAppliedVoucher(null);
        setVoucherCode('');
        setVoucherError('');
    };

    const handleAddressSubmit = (e) => {
        e.preventDefault();
        setShippingAddress(editAddress);
        setShowAddressModal(false);
    };

    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = matches && matches[0] || '';
        const parts = [];
        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(' ') : value;
    };

    const formatExpiryDate = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + '/' + v.substring(2, 4);
        }
        return v;
    };

    return (
        <main className="bg-gray-100 min-h-screen py-4 sm:py-6">
            <div className="max-w-[1200px] mx-auto px-2 sm:px-4">
                {/* Header */}
                <div className="bg-white rounded-sm shadow-sm mb-4 p-4 sm:p-5 border-b-4 border-shopee">
                    <div className="flex items-center gap-3">
                        <Link to="/Cart" className="text-gray-500 hover:text-shopee transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                        </Link>
                        <h1 className="text-lg sm:text-xl text-shopee font-bold">Checkout</h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Left Column - Main Content */}
                    <div className="lg:col-span-2 space-y-4">
                        
                        {/* Shipping Address */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-shopee">
                                        <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                    <h2 className="font-semibold text-gray-800">Delivery Address</h2>
                                </div>
                                <button 
                                    onClick={() => {
                                        setEditAddress({ ...shippingAddress });
                                        setShowAddressModal(true);
                                    }}
                                    className="text-shopee text-sm font-medium hover:text-shopee2 transition-colors"
                                >
                                    Change
                                </button>
                            </div>
                            <div className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-800">{shippingAddress.fullName}</span>
                                            <span className="text-gray-400">|</span>
                                            <span className="text-gray-600 text-sm">{shippingAddress.phone}</span>
                                            {shippingAddress.isDefault && (
                                                <span className="bg-shopee/10 text-shopee text-[10px] px-1.5 py-0.5 rounded font-medium">Default</span>
                                            )}
                                        </div>
                                        <p className="text-gray-600 text-sm">
                                            {shippingAddress.address}, {shippingAddress.city}, {shippingAddress.province} {shippingAddress.postalCode}
                                        </p>
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
                                    <span className="text-gray-400 text-sm">({orderItems.length} items)</span>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {orderItems.map((item) => (
                                    <div key={item.id} className="p-4 flex gap-3">
                                        <img src={item.img} alt={item.title} className="w-16 h-16 sm:w-20 sm:h-20 object-contain bg-gray-50 rounded flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800 line-clamp-2 mb-1">{item.title}</p>
                                            <p className="text-xs text-gray-400 mb-2">Variation: {item.variation}</p>
                                            <div className="flex items-center justify-between">
                                                <span className="text-shopee font-medium">₱{item.price.toLocaleString()}</span>
                                                <span className="text-gray-500 text-sm">x{item.qty}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Shipping Option */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-shopee">
                                        <path fill="currentColor" d="M18 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5m1.5-9H17V12h4.46L19.5 9.5M6 18.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5M20 8l3 4v5h-2c0 1.66-1.34 3-3 3s-3-1.34-3-3H9c0 1.66-1.34 3-3 3s-3-1.34-3-3H1V6c0-1.11.89-2 2-2h14v4h3M3 6v9h.76c.55-.61 1.35-1 2.24-1s1.69.39 2.24 1H15V6H3z"/>
                                    </svg>
                                    <h2 className="font-semibold text-gray-800">Shipping Option</h2>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                {shippingOptions.map((option) => (
                                    <label 
                                        key={option.id}
                                        className={`flex items-center justify-between p-3 rounded-sm border-2 cursor-pointer transition-all ${
                                            shippingOption === option.id 
                                                ? 'border-shopee bg-orange-50' 
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="radio" 
                                                name="shipping" 
                                                value={option.id}
                                                checked={shippingOption === option.id}
                                                onChange={(e) => setShippingOption(e.target.value)}
                                                className="w-4 h-4 accent-shopee"
                                            />
                                            <div>
                                                <p className="font-medium text-gray-800 text-sm">{option.name}</p>
                                                <p className="text-xs text-gray-500">Estimated arrival: {option.days}</p>
                                            </div>
                                        </div>
                                        <span className={`font-medium ${appliedVoucher?.freeShipping && option.id === 'standard' ? 'text-green-500 line-through' : 'text-gray-800'}`}>
                                            ₱{option.price}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-shopee">
                                        <path fill="currentColor" d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                                    </svg>
                                    <h2 className="font-semibold text-gray-800">Payment Method</h2>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                                    {paymentMethods.map((method) => (
                                        <button
                                            key={method.id}
                                            onClick={() => setPaymentMethod(method.id)}
                                            className={`p-3 rounded-sm border-2 text-left transition-all ${
                                                paymentMethod === method.id 
                                                    ? 'border-shopee bg-orange-50' 
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xl">{method.icon}</span>
                                                <span className="font-medium text-sm text-gray-800">{method.name}</span>
                                            </div>
                                            <p className="text-[10px] sm:text-xs text-gray-500">{method.description}</p>
                                        </button>
                                    ))}
                                </div>

                                {/* Card Details Form */}
                                {paymentMethod === 'card' && (
                                    <div className="bg-gray-50 rounded-sm p-4 space-y-4 border border-gray-200">
                                        <h3 className="font-medium text-gray-800 text-sm flex items-center gap-2">
                                            <span>💳</span> Card Details
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Card Number</label>
                                                <input 
                                                    type="text"
                                                    placeholder="1234 5678 9012 3456"
                                                    value={cardDetails.cardNumber}
                                                    onChange={(e) => setCardDetails({...cardDetails, cardNumber: formatCardNumber(e.target.value)})}
                                                    maxLength={19}
                                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Cardholder Name</label>
                                                <input 
                                                    type="text"
                                                    placeholder="JUAN DELA CRUZ"
                                                    value={cardDetails.cardName}
                                                    onChange={(e) => setCardDetails({...cardDetails, cardName: e.target.value.toUpperCase()})}
                                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Expiry Date</label>
                                                    <input 
                                                        type="text"
                                                        placeholder="MM/YY"
                                                        value={cardDetails.expiryDate}
                                                        onChange={(e) => setCardDetails({...cardDetails, expiryDate: formatExpiryDate(e.target.value)})}
                                                        maxLength={5}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">CVV</label>
                                                    <input 
                                                        type="password"
                                                        placeholder="•••"
                                                        value={cardDetails.cvv}
                                                        onChange={(e) => setCardDetails({...cardDetails, cvv: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                                                        maxLength={4}
                                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" className="text-green-500">
                                                <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                                            </svg>
                                            Your payment information is secure and encrypted
                                        </div>
                                        {/* Card icons */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                            <span className="text-xs text-gray-500">We accept:</span>
                                            <div className="flex gap-1">
                                                <img src="/images/payment1.png" alt="Visa" className="h-6 object-contain" />
                                                <img src="/images/payment2.png" alt="Mastercard" className="h-6 object-contain" />
                                                <img src="/images/payment3.png" alt="JCB" className="h-6 object-contain" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* E-Wallet Info */}
                                {['gcash', 'maya', 'grabpay', 'shopeepay'].includes(paymentMethod) && (
                                    <div className="bg-blue-50 rounded-sm p-4 border border-blue-200">
                                        <div className="flex items-start gap-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" className="text-blue-500 flex-shrink-0 mt-0.5">
                                                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                                            </svg>
                                            <div>
                                                <p className="text-sm text-blue-800 font-medium">E-Wallet Payment</p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    After placing your order, you will be redirected to {paymentMethods.find(m => m.id === paymentMethod)?.name} to complete the payment.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* COD Info */}
                                {paymentMethod === 'cod' && (
                                    <div className="bg-green-50 rounded-sm p-4 border border-green-200">
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl">💵</span>
                                            <div>
                                                <p className="text-sm text-green-800 font-medium">Cash on Delivery</p>
                                                <p className="text-xs text-green-600 mt-1">
                                                    Pay with cash when your order arrives. Please prepare the exact amount: <strong>₱{total.toLocaleString()}</strong>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Order Summary */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-sm shadow-sm overflow-hidden sticky top-4">
                            <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-white border-b border-gray-100">
                                <h2 className="font-semibold text-gray-800">Order Summary</h2>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Voucher Section */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Voucher Code</label>
                                    {appliedVoucher ? (
                                        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-sm p-3">
                                            <div className="flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" className="text-green-500">
                                                    <path fill="currentColor" d="M21 5H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1 2 2 0 0 1 0 4 1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1 2 2 0 0 1 0-4 1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/>
                                                </svg>
                                                <div>
                                                    <p className="text-sm font-medium text-green-700">{voucherCode.toUpperCase()}</p>
                                                    <p className="text-xs text-green-600">
                                                        {appliedVoucher.freeShipping ? 'Free Shipping' : 
                                                         appliedVoucher.type === 'fixed' ? `₱${appliedVoucher.discount} off` : 
                                                         `${appliedVoucher.discount}% off (max ₱${appliedVoucher.maxDiscount})`}
                                                    </p>
                                                </div>
                                            </div>
                                            <button onClick={removeVoucher} className="text-gray-400 hover:text-red-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M18 6L6 18M6 6l12 12"/>
                                                </svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                placeholder="Enter voucher code"
                                                value={voucherCode}
                                                onChange={(e) => setVoucherCode(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                            />
                                            <button 
                                                onClick={applyVoucher}
                                                className="px-4 py-2 bg-shopee text-white text-sm rounded-sm hover:bg-shopee2 transition-colors"
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    )}
                                    {voucherError && (
                                        <p className="text-red-500 text-xs mt-1">{voucherError}</p>
                                    )}
                                    <p className="text-[10px] text-gray-400 mt-1">Try: SHOPEE50, WELCOME10, FREESHIP</p>
                                </div>

                                {/* Price Breakdown */}
                                <div className="space-y-2 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal ({orderItems.reduce((a, i) => a + i.qty, 0)} items)</span>
                                        <span className="text-gray-800">₱{subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Shipping Fee</span>
                                        <span className={appliedVoucher?.freeShipping ? 'text-green-500 line-through' : 'text-gray-800'}>
                                            ₱{selectedShipping.price}
                                        </span>
                                    </div>
                                    {appliedVoucher?.freeShipping && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-600">Free Shipping Applied</span>
                                            <span className="text-green-600">-₱{selectedShipping.price}</span>
                                        </div>
                                    )}
                                    {voucherDiscount > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-600">Voucher Discount</span>
                                            <span className="text-green-600">-₱{voucherDiscount.toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Total */}
                                <div className="pt-4 border-t border-gray-200">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-gray-800 font-medium">Total</span>
                                        <span className="text-shopee text-2xl font-bold">₱{total.toLocaleString()}</span>
                                    </div>
                                    {totalSavings > 0 && (
                                        <p className="text-right text-xs text-green-600">You saved ₱{totalSavings.toLocaleString()}!</p>
                                    )}
                                </div>                                {/* Place Order Button */}
                                <Link 
                                    to="/OrderConfirmation" 
                                    className="w-full bg-shopee hover:bg-shopee2 text-white py-3 rounded-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                    </svg>
                                    Place Order
                                </Link>

                                {/* Security badges */}
                                <div className="flex items-center justify-center gap-4 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" className="text-green-500">
                                            <path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                                        </svg>
                                        Secure
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" className="text-blue-500">
                                            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                        </svg>
                                        Verified
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" className="text-shopee">
                                            <path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                                        </svg>
                                        Encrypted
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Address Edit Modal */}
            {showAddressModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-800">Edit Delivery Address</h3>
                            <button onClick={() => setShowAddressModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddressSubmit} className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                                    <input 
                                        type="text"
                                        required
                                        value={editAddress.fullName}
                                        onChange={(e) => setEditAddress({...editAddress, fullName: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                    />
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs text-gray-600 mb-1">Phone Number *</label>
                                    <input 
                                        type="tel"
                                        required
                                        value={editAddress.phone}
                                        onChange={(e) => setEditAddress({...editAddress, phone: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Street Address *</label>
                                <input 
                                    type="text"
                                    required
                                    value={editAddress.address}
                                    onChange={(e) => setEditAddress({...editAddress, address: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">City *</label>
                                    <input 
                                        type="text"
                                        required
                                        value={editAddress.city}
                                        onChange={(e) => setEditAddress({...editAddress, city: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">Province *</label>
                                    <input 
                                        type="text"
                                        required
                                        value={editAddress.province}
                                        onChange={(e) => setEditAddress({...editAddress, province: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Postal Code *</label>
                                <input 
                                    type="text"
                                    required
                                    value={editAddress.postalCode}
                                    onChange={(e) => setEditAddress({...editAddress, postalCode: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-shopee"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={editAddress.isDefault}
                                    onChange={(e) => setEditAddress({...editAddress, isDefault: e.target.checked})}
                                    className="w-4 h-4 accent-shopee"
                                />
                                <span className="text-sm text-gray-700">Set as default address</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button"
                                    onClick={() => setShowAddressModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-sm hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 bg-shopee text-white rounded-sm hover:bg-shopee2 transition-colors"
                                >
                                    Save Address
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}

export default Checkout;
