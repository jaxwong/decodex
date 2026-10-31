import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
    return ( 
        <footer className="bg-neutral-100 border-t-4 border-shopee">
            {/* Main Footer Content */}
            <div className="max-w-[1200px] mx-auto px-4 py-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-8">
                    {/* Customer Service */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-800 mb-4 uppercase tracking-wide">Customer Service</h3>
                        <ul className="space-y-2">
                            {['Help Centre', 'How to Buy', 'How to Sell', 'Payment', 'Shopee Coins', 'Shipping', 'Return & Refund', 'Contact Us'].map((item) => (
                                <li key={item}>
                                    <Link to="/" className="text-xs text-gray-600 hover:text-shopee transition-colors">{item}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* About Shopee */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-800 mb-4 uppercase tracking-wide">About Shopee</h3>
                        <ul className="space-y-2">
                            {['About Us', 'Shopee Blog', 'Shopee Careers', 'Shopee Policies', 'Privacy Policy', 'Shopee Mall', 'Seller Centre', 'Flash Deals'].map((item) => (
                                <li key={item}>
                                    <Link to="/" className="text-xs text-gray-600 hover:text-shopee transition-colors">{item}</Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* Payment */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-800 mb-4 uppercase tracking-wide">Payment</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {['/images/payment1.png','/images/payment2.png','/images/payment3.png','/images/payment4.png','/images/payment5.png','/images/payment6.png','/images/payment7.png','/images/payment8.png'].map((src, i) => (
                                <div key={i} className="bg-white rounded shadow-sm p-1.5 flex items-center justify-center h-8">
                                    <img src={src} alt={`payment ${i + 1}`} className="max-h-full max-w-full object-contain"/>
                                </div>
                            ))}
                        </div>
                        
                        <h3 className="text-xs font-bold text-gray-800 mb-4 mt-6 uppercase tracking-wide">Logistics</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {['/images/logistics1.png','/images/logistics2.png','/images/logistics3.png','/images/logistics4.png','/images/logistics5.png','/images/logistics6.png'].map((src, i) => (
                                <div key={i} className="bg-white rounded shadow-sm p-1.5 flex items-center justify-center h-8">
                                    <img src={src} alt={`logistics ${i + 1}`} className="max-h-full max-w-full object-contain"/>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Follow Us */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-800 mb-4 uppercase tracking-wide">Follow Us</h3>
                        <ul className="space-y-3">
                            {[
                                { name: 'Facebook', icon: '/images/social1.png' },
                                { name: 'Instagram', icon: '/images/social2.png' },
                                { name: 'Twitter', icon: '/images/social3.png' },
                                { name: 'LinkedIn', icon: '/images/social4.png' },
                            ].map((social) => (
                                <li key={social.name}>
                                    <Link to="/" className="flex items-center gap-2 text-xs text-gray-600 hover:text-shopee transition-colors">
                                        <img src={social.icon} alt={social.name} className="w-4 h-4 object-contain"/>
                                        <span>{social.name}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    
                    {/* Shopee App Download */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-800 mb-4 uppercase tracking-wide">Shopee App Download</h3>
                        <div className="flex gap-3">
                            <Link to="/" className="bg-white rounded shadow-sm p-2">
                                <img src="/images/qr.png" alt="QR Code" className="w-20 h-20 object-contain"/>
                            </Link>
                            <div className="flex flex-col gap-2">
                                <Link to="/" className="bg-white rounded shadow-sm p-1.5">
                                    <img src="/images/download1.png" alt="App Store" className="h-5 object-contain"/>
                                </Link>
                                <Link to="/" className="bg-white rounded shadow-sm p-1.5">
                                    <img src="/images/download2.png" alt="Google Play" className="h-5 object-contain"/>
                                </Link>
                                <Link to="/" className="bg-white rounded shadow-sm p-1.5">
                                    <img src="/images/download3.png" alt="App Gallery" className="h-5 object-contain"/>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Bottom Bar */}
            <div className="bg-neutral-200">
                <div className="max-w-[1200px] mx-auto px-4 py-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <p className="text-xs text-gray-600">© 2024 Shopee. All Rights Reserved.</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                            <span>Country & Region:</span>
                            {['Singapore', 'Indonesia', 'Thailand', 'Malaysia', 'Vietnam', 'Philippines', 'Brazil', 'Mexico', 'Colombia', 'Chile', 'Taiwan'].map((country, i) => (
                                <span key={country}>
                                    <Link to="/" className="hover:text-shopee transition-colors">{country}</Link>
                                    {i < 10 && <span className="mx-1">|</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

export default Footer;
