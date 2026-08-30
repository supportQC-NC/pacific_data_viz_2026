# Datamoana — le climat du Pacifique en données ouvertes

Application web interactive proposée au **Pacific Dataviz Challenge 2026**
(thème : changement climatique — catégorie *Interactive Dataviz*).

Douze **escales** racontent une histoire climatique des territoires insulaires du
Pacifique : émissions, océan, littoral, santé, agriculture, énergie, économie,
biodiversité, cyclones. Interface **française et anglaise**.

**Principe non négociable du projet : aucun chiffre n'est écrit en dur.**
Toutes les valeurs affichées proviennent d'appels API au moment de l'exécution
(Pacific Data Hub .Stat, principalement). Quand une source est indisponible, la
vue affiche « indisponible » — elle n'invente jamais une valeur de repli.

---

## Démarrage

Prérequis : **Node.js 18+** et npm.

```bash
npm install
cp .env.example .env.local   # puis renseigner les variables (voir plus bas)
npm start                    # serveur de dev sur http://localhost:3000
npm run build                # bundle de production dans build/
```

`npm test` est câblé par Create React App mais **le projet ne contient aucun
test** : la vérification se fait dans le navigateur et par `npm run build`.
Le build de production est le seul garde-fou de compilation — le serveur de dev
tolère des erreurs qu'il refuse.

## Variables d'environnement

| Variable | Rôle | Sans elle |
|---|---|---|
| `REACT_APP_MAPBOX_TOKEN` | Fonds de carte Mapbox GL (escales 2, 3, 12) | Les scènes carte se dégradent, l'app ne plante pas |
| `REACT_APP_PDH_BASE` | Surcharge la base SDMX Pacific Data Hub | Base publique par défaut |
| `REACT_APP_CYCLONE_FILE` / `..._POINTS_FILE` | Surcharge les GeoJSON cyclones | Fichiers de `public/data/cyclones/` |

Le fichier `.env.local` n'est **jamais** versionné. `.env.example` ne doit
contenir que des clés vides.

## Proxies de données

`src/setupProxy.js` relaie deux API qui refusent l'appel direct depuis
`localhost` (Pacific Data Hub en 403, World Bank Data360 sans en-têtes CORS).
**Ces proxies n'existent qu'en développement** (`npm start`).

Conséquence pour la mise en ligne : les services Pacific Data Hub tentent
l'appel **direct d'abord**, le proxy seulement en secours — la version déployée
fonctionne donc sans proxy. Si l'hébergeur en impose un, configurer le même
reverse-proxy côté serveur (Nginx, fonction serverless…) et pointer
`REACT_APP_PDH_BASE` dessus.

## Organisation du code

```
src/
  App.js               routes — 12 escales + 5 chapitres + /recit
  pages/               une page par escale et par chapitre (25)
  components/          77 dossiers, dont components/charts/ (32 graphiques)
    charts/echartsBase.js   fragments d'options ECharts + helpers de calcul
    charts/apexBase.js      équivalent ApexCharts (réexporte les helpers)
  services/            10 clients API — un par domaine de données
  data/                catalogue des jeux de données, référentiels
  store/context/       contextes langue et parcours narratif (JOURNEY)
  i18n/                chaînes FR/EN
  styles/_variables.scss  tous les tokens de couleur et d'espacement
  hooks/UseThemeTokens.js lit les tokens CSS pour les graphes canvas
public/data/           GeoJSON statiques (cyclones, littoral)
scripts/               scripts d'analyse et de contrôle i18n (Node, hors build)
```

Deux points d'architecture à connaître avant toute modification :

- **`store/context/journeyContext.js` est la source de vérité de l'ordre narratif.**
  Les numéros d'escale se recalculent à partir de `JOURNEY` ; ne jamais écrire
  un numéro d'escale en dur, utiliser `numberOf(id)` / `padOf(id)`.
- **Le thème passe par des variables CSS.** ECharts et ApexCharts ne savent pas
  résoudre `var()` : chaque graphique appelle `useThemeTokens()` et passe `tk`
  dans ses options. Un hexadécimal écrit en dur dans un graphique est un bug —
  il ne suivra pas le changement de thème.

Le détail complet de l'architecture et des conventions dataviz est dans
`CLAUDE.md`.

## Données

Le catalogue des jeux de données consommés — avec pour chacun le lien amont et
le lien officiel Pacific Data Hub .Stat du flux réellement appelé — vit dans
`src/data/datasetCatalog.js` et s'affiche dans l'application sur `/a-propos` et
`/data/:id`.

## Stack

React 19 · React Router 7 · Redux Toolkit · Sass · ECharts 6 · ApexCharts 4 ·
D3 7 · Mapbox GL 3 · GSAP — sur Create React App 5.

## Licence

Code source sous **licence MIT** (voir `LICENSE`) — licence ouverte conforme à
l'*Open Definition*, comme l'exige le règlement du Challenge.

Les données restent sous la licence de leurs producteurs. Le détail source par
source — origine amont et lien Pacific Data Hub .Stat du flux réellement
appelé — est dans `src/data/datasetCatalog.js` et s'affiche sur `/a-propos`.
