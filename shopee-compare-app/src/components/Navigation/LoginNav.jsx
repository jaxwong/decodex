import React from 'react';
import { Link } from 'react-router-dom';

function LoginNav() {
    return (
        <header className="bg-white border-b border-gray-200">
            <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
                {/* Logo + Page Title */}
                <div className="flex items-center gap-4">
                    <Link to="/">
                        <img 
                            src="/images/shopee_logo.webp" 
                            alt="Shopee" 
                            className="h-[40px] w-auto object-contain"
                            style={{ filter: 'brightness(0) saturate(100%) invert(35%) sepia(93%) saturate(1352%) hue-rotate(348deg) brightness(93%) contrast(93%)' }}
                        />
                    </Link>
                    <span className="text-xl text-gray-800 font-normal hidden sm:inline">Login</span>
                </div>
                
                {/* Help Link */}
                <Link to="/" className="text-shopee text-sm hover:text-shopee2 transition-colors">
                    Need help?
                </Link>
            </div>
        </header>
    );
}

export default LoginNav;