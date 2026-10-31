import React from 'react';
import BelowHeader from './SubNavigation/BelowHeader';
import Hero from './landingpage/Hero';
import Shoes from './Section/shoes';

function Landing() {
    return(
        <main className="bg-gray-100 min-h-screen">
            <BelowHeader/>
            <Hero/>
            <Shoes/>
        </main>
    );
}

export default Landing;