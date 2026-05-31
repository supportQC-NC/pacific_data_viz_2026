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