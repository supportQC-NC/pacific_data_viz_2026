// src/components/ErrorBoundary/ErrorBoundary.jsx
// ============================================================
// Capture les erreurs d'un sous-arbre (ex. la carte Mapbox)
// et affiche un repli, sans faire planter le reste de la page.
// ============================================================

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.warn("Composant isolé en erreur :", error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback || null;
    return this.props.children;
  }
}
