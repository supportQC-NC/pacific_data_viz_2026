// src/App.js
// ============================================================
// Racine applicative : providers thème + langue + parcours guidé,
// header, ScrollToTop, routes. Chaque acte est enveloppé par <ActFlow>
// au niveau de la route → barre de progression + navigation suivant/
// précédent + intro plein écran sur TOUS les actes, sans toucher aux pages.
// La page « À propos » (/a-propos) est hors parcours guidé.
// ============================================================

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './store/context/themeContext';
import { LangProvider } from './store/context/langContext';
import { JourneyProvider } from './store/context/journeyContext';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import ActFlow from './components/ActFlow/ActFlow';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import Home from './pages/Home/Home';
import About from './pages/About/About';
import FunFacts from './pages/FunFacts/FunFacts';
import ActsIndex from './pages/ActsIndex/ActsIndex';
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
import DatasetPage from './pages/DatasetPage/DatasetPage';

function AppContent() {
  return (
    <div className="app-root">
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/a-propos" element={<About />} />
        <Route path="/le-saviez-vous" element={<FunFacts />} />
        <Route path="/actes" element={<ActsIndex />} />
        <Route path="/emissions" element={<ActFlow actId="a1"><Act1Emissions /></ActFlow>} />
        <Route path="/ocean" element={<ActFlow actId="a2"><Act2Ocean /></ActFlow>} />
        <Route path="/territory" element={<ActFlow actId="a3"><Act3Territory /></ActFlow>} />
        <Route path="/impact" element={<ActFlow actId="a4"><Act4Impact /></ActFlow>} />
        <Route path="/momentum" element={<ActFlow actId="a5"><Act5Momentum /></ActFlow>} />
        <Route path="/agriculture" element={<ActFlow actId="a6"><Act6Agriculture /></ActFlow>} />
        <Route path="/vivant" element={<ActFlow actId="a7"><Act7Vivant /></ActFlow>} />
        <Route path="/ciel" element={<ActFlow actId="a8"><Act8Ciel /></ActFlow>} />
        <Route path="/economie" element={<ActFlow actId="a9" hasDeck><Act9Eco /></ActFlow>} />
        <Route path="/sante" element={<ActFlow actId="a10"><Act10Sante /></ActFlow>} />
        <Route path="/synthese" element={<ActFlow actId="a11"><Act11Synthese /></ActFlow>} />
        <Route path="/data/:id" element={<DatasetPage />} />
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
        <JourneyProvider>
          <AppContent />
        </JourneyProvider>
      </LangProvider>
    </ThemeProvider>
  );
}