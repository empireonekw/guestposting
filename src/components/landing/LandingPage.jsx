'use client';

import React from 'react';
import Hero from './Hero';
import MarketPreview from './MarketPreview';
import Services from './Services';
import Contact from './Contact';
import GrowthTree from './GrowthTree';
import AuthorityRoots from './AuthorityRoots';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-200">
      <main>
        <Hero />
        <Services />
        <AuthorityRoots />
        <MarketPreview />
        <GrowthTree />
        <Contact />
      </main>
    </div>
  );
};

export default LandingPage;