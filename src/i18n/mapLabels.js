// src/i18n/mapLabels.js
// ============================================================
// Libelles de la carte (plein ecran + lecture animee), FR / EN.
// Externalises ici pour respecter l'i18n sans toucher fr.json / en.json.
// `coast` : mots de l'infobulle de la couche « trait de cote ».
// ============================================================

const mapLabels = {
  fr: {
    expand: "Voir la carte en grand",
    close: "Fermer la carte",
    play: "Lancer l'animation",
    pause: "Mettre en pause",
    year: "Annee",
    coast: { ero: "Recul du littoral", sta: "Littoral stable", acc: "Avancée du littoral", unit: "m/an" },
  },
  en: {
    expand: "View map fullscreen",
    close: "Close map",
    play: "Play animation",
    pause: "Pause",
    year: "Year",
    coast: { ero: "Coastline retreat", sta: "Stable coastline", acc: "Coastline growth", unit: "m/yr" },
  },
};

export default mapLabels;