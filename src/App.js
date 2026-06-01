// src/App.js
// ============================================================
// Racine applicative : providers thème + langue, header, routes, footer.
// ============================================================

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './store/context/themeContext';
import { LangProvider } from './store/context/langContext';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Home from './pages/Home/Home';
import Act1Emissions from './pages/Act1Emissions/Act1Emissions';
import Act2Ocean from './pages/Act2Ocean/Act2Ocean';
import Act3Territory from './pages/Act3Territory/Act3Territory';
import Act4Impact from './pages/Act4Impact/Act4Impact';
import Act5Momentum from './pages/Act5Momentum/Act5Momentum';
import Act6Agriculture from './pages/Act6Agriculture/Act6Agriculture';
import Act7Vivant from './pages/Act7Vivant/Act7Vivant';
import Act8Ciel from './pages/Act8Ciel/Act8Ciel';
import Act9Eco from './pages/Act9Eco/Act9Eco';
import Act10Sante from './pages/Act10Sante/Act10Sante';
import Act11Synthese from './pages/Act11Synthese/Act11Synthese';

function AppContent() {
  return (
    <div className="app-root">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/emissions" element={<Act1Emissions />} />
        <Route path="/ocean" element={<Act2Ocean />} />
        <Route path="/territory" element={<Act3Territory />} />
        <Route path="/impact" element={<Act4Impact />} />
        <Route path="/momentum" element={<Act5Momentum />} />
        <Route path="/agriculture" element={<Act6Agriculture />} />
        <Route path="/vivant" element={<Act7Vivant />} />
        <Route path="/ciel" element={<Act8Ciel />} />
        <Route path="/economie" element={<Act9Eco />} />
        <Route path="/sante" element={<Act10Sante />} />
        <Route path="/synthese" element={<Act11Synthese />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AppContent />
      </LangProvider>
    </ThemeProvider>
  );
}