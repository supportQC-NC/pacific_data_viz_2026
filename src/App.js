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

function AppContent() {
  return (
    <div className="app-root">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/emissions" element={<Act1Emissions />} />
        {/* Actes 2 à 5 à venir, étape par étape. */}
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