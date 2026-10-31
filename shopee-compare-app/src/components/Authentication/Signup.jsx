import React from 'react';
import { Link } from 'react-router-dom';

function Signup() {
    return (
        <div 
            className="min-h-[600px] flex items-center justify-center md:justify-end bg-shopee"
            style={{ 
                backgroundImage: "url('/images/login_bg.png')", 
                backgroundSize: "contain",
                backgroundPosition: "center left",
                backgroundRepeat: "no-repeat"
            }}
        >
            <div className="bg-white w-full max-w-[400px] mx-4 md:mr-20 rounded-sm shadow-lg">
                {/* Header */}
                <div className="p-8 pb-6">
                    <h1 className="text-xl text-gray-800 font-normal">Sign Up</h1>
                </div>
                
                {/* Form */}
                <div className="px-8 pb-8">
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Phone number"
                            className="w-full px-3 py-3 border border-gray-300 rounded-sm text-sm outline-none focus:border-gray-500 transition-colors"
                        />
                    </div>
                    
                    <button className="w-full bg-shopee hover:bg-shopee2 text-white py-2.5 rounded-sm mt-4 text-sm font-medium uppercase transition-colors">
                        Next
                    </button>
                    
                    {/* Divider */}
                    <div className="flex items-center my-5">
                        <div className="flex-1 h-px bg-gray-200"></div>
                        <span className="px-4 text-xs text-gray-400">OR</span>
                        <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                    
                    {/* Social Signup */}
                    <div className="flex gap-2">
                        <button className="flex-1 flex items-center justify-center gap-2 border border-gray-300 py-2.5 rounded-sm hover:bg-gray-50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#1877F2" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95"/>
                            </svg>
                            <span className="text-sm text-gray-700">Facebook</span>
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-2 border border-gray-300 py-2.5 rounded-sm hover:bg-gray-50 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06c-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22l.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1C7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            <span className="text-sm text-gray-700">Google</span>
                        </button>
                    </div>
                    
                    {/* Terms */}
                    <p className="text-xs text-gray-500 text-center mt-5 leading-relaxed">
                        By signing up, you agree to Shopee's{' '}
                        <Link to="/" className="text-shopee hover:underline">Terms of Service</Link>
                        {' '}&{' '}
                        <Link to="/" className="text-shopee hover:underline">Privacy Policy</Link>
                    </p>
                    
                    {/* Login Link */}
                    <div className="text-center mt-6">
                        <span className="text-sm text-gray-400">Have an account? </span>
                        <Link to="/Login" className="text-sm text-shopee hover:text-shopee2 font-medium">Log In</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Signup;