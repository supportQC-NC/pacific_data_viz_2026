// src/components/CropExplorer/cropIcons.jsx
// ============================================================
// Icône par culture/produit. Mappe un libellé (FR/EN) vers une icône
// react-icons "Game Icons" (Gi*) via mots-clés, avec lookup DYNAMIQUE
// (Gi[name]) : si l'icône n'existe pas dans la version installée, on
// retombe sur un SVG "pousse" — le build ne peut jamais casser sur une
// icône manquante.
//
// Export PAR DÉFAUT : <CropIcon label="Bananes" className="..." />
// Export nommé      : cropIconName(label) -> string | null
// ============================================================

import React from "react";
import * as Gi from "react-icons/gi";

// [mots-clés (minuscule, sans accents), nom d'icône Gi]
const RULES = [
  [["banane", "banana", "plantain"], "GiBananaBunch"],
  [["coco", "coconut"], "GiCoconuts"],
  [["ananas", "pineapple"], "GiPineapple"],
  [["mais", "maize", "corn"], "GiCorn"],
  [["carotte", "carrot", "navet"], "GiCarrot"],
  [["tomate", "tomato"], "GiTomato"],
  [["aubergine", "eggplant"], "GiEggplant"],
  [["piment", "poivron", "chili", "pepper"], "GiChiliPepper"],
  [["avocat", "avocado"], "GiAvocado"],
  [["raisin", "grape", "vigne"], "GiGrapes"],
  [["citron", "orange", "agrume", "pomelo", "pamplemousse", "mandarine", "tangerine", "lemon", "citrus", "lime"], "GiOrange"],
  [["mangue", "mango", "goyave", "guava"], "GiMango"],
  [["papaye", "papaya"], "GiPapayas"],
  [["courge", "potiron", "pumpkin", "squash", "calebasse"], "GiPumpkin"],
  [["pasteque", "melon", "watermelon", "cantaloup"], "GiWatermelon"],
  [["cafe", "coffee"], "GiCoffeeBeans"],
  [["the", "tea"], "GiTeapotLeaves"],
  [["canne", "sugar"], "GiSugarCane"],
  [["riz", "rice"], "GiRiceCooker"],
  [["ble", "wheat", "sorgho", "sorghum"], "GiWheat"],
  [["haricot", "feve", "bean", "soja", "soybean", "legumineuse", "pois"], "GiBeanstalk"],
  [["arachide", "peanut", "cacahuete"], "GiPeanut"],
  [["pomme de terre", "patate", "potato"], "GiPotato"],
  [["manioc", "cassava", "igname", "yam", "taro", "tubercule", "racine", "root"], "GiPlantRoots"],
  [["gingembre", "ginger", "epice", "spice", "vanille", "vanilla", "poivre", "muscade", "cardamome", "aromatique", "stimulante"], "GiHerbsBundle"],
  [["chou", "cabbage", "laitue", "lettuce", "chicoree", "legume", "vegetable", "concombre", "cornichon", "cucumber", "gombo", "okra", "poireau", "oignon", "onion", "echalote", "alliac"], "GiBroccoli"],
  [["palmier", "palm", "huile", "oil"], "GiPalmTree"],
  [["tabac", "tobacco"], "GiRolledCloth"],
  [["cacao", "cocoa"], "GiChocolateBar"],
  [["noix", "nut", "amande", "noisette"], "GiAcorn"],
  [["fruit", "baie", "berry"], "GiFruitBowl"],
  // Bétail
  [["bovin", "boeuf", "buffle", "cattle", "beef", "buffalo", "veau"], "GiCow"],
  [["chevre", "goat", "caprin"], "GiGoat"],
  [["porc", "pig", "cochon", "swine"], "GiPig"],
  [["poulet", "volaille", "chicken", "poultry", "oeuf", "egg"], "GiChicken"],
  [["mouton", "ovin", "sheep", "agneau", "lamb"], "GiSheep"],
];

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function cropIconName(label) {
  const t = normalize(label);
  for (const [keys, name] of RULES) {
    if (keys.some((k) => t.includes(k))) return name;
  }
  return null;
}

export default function CropIcon({ label, className }) {
  const name = cropIconName(label);
  const Ic = name ? Gi[name] : null;
  if (Ic) return <Ic className={className} aria-hidden="true" focusable="false" />;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 21V11M12 11c0-3 2-5 5-5 0 3-2 5-5 5Zm0 0C12 8 10 6 7 6c0 3 2 5 5 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}