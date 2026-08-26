# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Méthode de travail (prioritaire sur tout le reste de ce fichier)

Mon objectif est de continuer à améliorer cette application **progressivement, sans casser
les fonctionnalités existantes**.

## RÈGLE PRINCIPALE

**Ne pars jamais du principe qu'il faut recréer une fonctionnalité ou une architecture.**

Avant toute modification :

1. Explore le code existant concerné.
2. Comprends l'architecture actuelle.
3. Recherche les composants, services, routes, modèles, hooks, fonctions utilitaires et API
   déjà disponibles.
4. Identifie les dépendances entre les différentes parties de l'application.
5. Réutilise au maximum l'existant.

## AVANT CHAQUE MODIFICATION

Analyse d'abord la demande et le code concerné.

Si la modification est importante :

- identifie les fichiers concernés ;
- explique brièvement ce que tu comptes modifier ;
- vérifie les impacts possibles sur les fonctionnalités existantes ;
- privilégie la solution nécessitant le moins de changements inutiles.

## PENDANT LE DÉVELOPPEMENT

Respecte impérativement les règles suivantes :

- Ne casse aucune fonctionnalité existante.
- Ne supprime pas du code simplement parce qu'il semble inutilisé **sans avoir vérifié son
  utilisation**.
- Ne crée pas une nouvelle fonction si une fonction équivalente existe déjà.
- Ne crée pas une nouvelle API si une route existante peut être adaptée.
- Ne duplique pas la logique métier.
- Respecte les conventions et l'architecture existantes.
- Évite les refactorisations massives qui ne sont pas nécessaires à la demande.
- Fais des modifications ciblées et progressives.
- Vérifie les imports, appels API, modèles de données et dépendances après modification.

## IMPORTANT

Si tu découvres un problème architectural ou du code qui pourrait être fortement amélioré
mais qui **n'est pas directement lié à ma demande** :

**NE LE MODIFIE PAS automatiquement.**

Signale-le-moi simplement à la fin.

## À LA FIN DE CHAQUE TÂCHE

Donne-moi un résumé court avec :

- les fichiers modifiés ;
- ce qui a été ajouté/modifié ;
- les éventuels points à surveiller ;
- les tests ou vérifications que je devrais effectuer.

Ensuite **attends ma prochaine demande**.

---

## What this is

A React SPA submitted to the **Pacific Dataviz Challenge 2026** (theme: climate change,
Interactive Dataviz category). It tells a climate story about Pacific island territories
using live open data — the code contains **no invented figures**; every number comes from
an API at runtime. Preserve that property: never hardcode a data value to make a chart
render. UI language is French first, English second (both are required by the contest rules).

## Repository layout

The app lives in `pacific_data_viz_2026/`, which has **its own `.git`** nested inside the
outer `final_pacific` repo. Run all commands from `pacific_data_viz_2026/`, and commit
there — the outer repo sees this whole directory as one untracked folder.

## Commands

```bash
npm start        # CRA dev server on :3000 — also boots the API proxies (see below)
npm run build    # production bundle to build/
```

`npm test` is wired (react-scripts) but **there are no test files and no `setupTests.js`** —
it will find nothing. Don't cite test results as verification; verify in the browser.

Sass compiles through CRA's `sass` dependency — components import `.scss` directly. There is
**no separate style build step**.

### Environment

Copy `.env.example` → `.env.local`. `REACT_APP_MAPBOX_TOKEN` is required for the map scenes
(Acts 2, 3, 12); without it those components degrade rather than crash.

## Architecture

### Two parallel navigations coexist

`App.js` routes **both** structures at once and this is deliberate, mid-migration:

- **The 12 "actes"** (`/emissions`, `/ocean`, `/cyclones`, …) — the canonical, complete
  narrative. Each is wrapped in `<ActFlow actId="aN">`.
- **The 5 "chapitres"** (`/chapitre/humain`, `/chapitre/terre`, …) — "Datamoana 2.0", a newer
  parallel architecture. Less complete.

`/recit` is a third, separate narrative entry point. When asked to change "the story", clarify
which of these three is meant — they share chart components but not page code.

### `journeyContext.js` is the single source of truth for narrative order

`JOURNEY` (act id → route, in narrative order) and `MOVEMENTS` (5 narrative groupings)
drive act **numbering**, progress, and prev/next links everywhere. To reorder the story,
edit `JOURNEY` only — numbers recompute app-wide. **Never hardcode an act number** in a
component; use `numberOf(id)` / `padOf(id)`. Note the act *ids* are not in narrative order
(`a8` is act 03, `a12` is act 04) — that decoupling is intentional.

### Theming: CSS custom properties → JS tokens

`styles/_variables.scss` defines every color as a custom property under `:root` /
`[data-theme="light"]`. **Dark is the default.** CSS consumes `var(--c-*)` directly.

Canvas-based chart libraries (ECharts, ApexCharts) cannot resolve `var()`, so
`hooks/UseThemeTokens.js` reads the computed values into a plain `tk` object and re-reads
them via a `MutationObserver` on `[data-theme]`. **Every chart component calls
`useThemeTokens()` and passes `tk` into its options** — this is why charts retheme live.
Consequence: a hardcoded hex inside a chart is a bug, because it won't follow the theme.

### Chart layer

61 components in `components/charts/` plus chart-bearing components elsewhere, over
ECharts, ApexCharts, D3, and Mapbox GL.

- `charts/echartsBase.js` — ECharts option fragments (`axisStyle`, `tooltipStyle`,
  `paletteOf`) **and** the shared math helpers (`fmt`, `median`, `quantile`, `valAt`).
- `charts/apexBase.js` — the ApexCharts counterpart (`baseChart`, `baseGrid`, `baseLegend`,
  `baseXaxis`, `baseYaxis`, `baseTooltip`, `apexPalette`, `apexRamp`). It **re-exports** the
  math helpers from `echartsBase` rather than redefining them, so charts need one import.

New charts should compose these bases, not rebuild options from scratch.

### Data services

`src/services/*Api.js` (one per act/domain) fetch from three upstreams:

| Upstream | Dev proxy | Why the proxy |
|---|---|---|
| Pacific Data Hub (SDMX, `.Stat`) | `/pdh` | PDH returns 403 to direct localhost calls |
| World Bank Data360 | `/wbdata360` | no CORS headers |
| ArcGIS / Georep (cyclone tracks) | `/georep` | CORS; **target is a placeholder** |

`setupProxy.js` defines all three and runs **only under `npm start`**. Production needs the
same reverse proxy configured server-side. Services typically try `DIRECT` then fall back to
`PROXY`, so they keep working in both contexts — preserve that fallback chain when editing.

SDMX keys are positional and brittle (`A.SH_H2O_SAFE...._T.....`). Services therefore carry
**arrays of candidate keys per indicator** and probe them, because dimension counts vary
between dataflow versions. Don't "clean up" those arrays down to one key.

### State

Both systems are in use and split by concern — this is intentional, not leftover:

- **Redux Toolkit** (`store/store.js`: `ui`, `climate`, `territory`) — used by ~32 components,
  mainly the Va'a territory engine and shared climate data.
- **React Context** — `themeContext`, `langContext`, `journeyContext`. Providers nest in
  `App.js`; the Redux `Provider` and `BrowserRouter` sit above them in `index.js`.

### i18n

`i18n/fr.json` + `i18n/en.json`, plus `i18n/extraStrings.js`, an **override layer** deep-merged
over both dicts. Add or correct a string in `extraStrings` rather than editing the large JSON
files. `t('some.path')` returns the path itself when a key is missing — so a raw dotted string
visible in the UI means a missing translation, not a rendering bug.

## Known repo hygiene issues

- **`.env.example` is tracked and contains what looks like a live SSH root password and host.**
  It is in git history. Treat as compromised: rotate the credential and purge it from history.
- **61 `.css` + 60 `.css.map` files are committed next to their `.scss` sources.** They are
  stale compiled artifacts — CRA compiles the `.scss` directly, and nothing imports them.
  They should be gitignored. Editing a `.css` file here has no effect; edit the `.scss`.
- `components/charts/RiverChart copy.jsx` and `components/RiverChart/` duplicate
  `charts/RiverChart.jsx`, including a copy of the 18-color `BRAND` array in each.

## Dataviz conventions

### The colour system — three encodings, one rule each

Every chart must **declare what its colour encodes** rather than picking a ramp ad hoc.
This is what keeps 12 acts reading as one product. Use `rampFor(kind, tk)` from
`charts/echartsBase.js`, or pass `kind` to `HeatmapChart`:

| `kind` | For | Ramp | Legend must say |
|---|---|---|---|
| `magnitude` | grandeur with no value judgement (population, arrivals, counts) | sequential lavender, light→dark | "low → high" |
| `stress` (default) | oriented quantity — **dark is always worse** (emissions, TB, sea level) | ordinal lavender | "spared → exposed" |
| `polarity` | true polarity around a meaningful zero (anomaly vs normal, change vs base) | diverging lavender ↔ red, neutral grey centre | "below ← 0 → above" |

Two hard rules behind this:

- **Never green ↔ red.** Measured at **ΔE 4.1** under deuteranopia — the two poles are the
  *same colour* for ~8% of men — while reading ΔE 33.9 to normal vision. That gap is exactly
  why it survives everywhere: whoever picks it cannot see the problem. Lavender ↔ red
  measures 22.7.
- **Polarity is a property of the indicator, not of the number.** High water access is good;
  high TB incidence is bad. `services/syntheseApi.js` already declares this per indicator
  (`dir: "up" | "down" | "abs"`) — reuse that, don't re-derive it. A value that is positive
  for humans is not necessarily positive for the environment.

The diverging ramp is the one palette that is **not** theme-invariant: on the navy surface its
poles must be *light*, or the extreme values — the ones that matter most — sink into the
background. Both modes are defined in `_variables.scss`.

### Series colour follows the entity

`charts/seriesColor.js` (`territoryColors`) assigns territory colours from a **canonical,
unfiltered order**, so changing the sub-region filter never repaints the survivors. Past
8 series it switches to encoding the sub-region (3 hues — the validated all-pairs cap),
because nobody distinguishes 22 line colours. Never index a palette by position in a
filtered array, and never `i % palette.length`.

### Remaining violations

An audit against the `dataviz` skill found these; when touching charts, don't propagate them:

- **No dual-axis charts.** `charts/DualAxisChart.jsx` and `charts/ParetoChart.jsx` use two
  y-scales. `EvolutionLines` has an `index` mode (base 100 + reference line) that is the
  correct one-axis replacement.
- **Still cycling `i % palette.length`** (gives two entities the same colour):
  `components/BarRace/BarRace.jsx:59`, `charts/ProfileRadar.jsx:49-51` (a radar is an
  all-pairs form — cap 3), `charts/RiverChart.jsx:145` plus its own 18-hue `BRAND` copy at
  line 16, `components/TrendLines/TrendLines.jsx:121,222,292`, `pages/Act9Eco/Act9Eco.jsx:346`.
  Fix each with `territoryColors` or an explicit stable map.
- **Gridlines are solid hairlines.** `apexBase.js:56` and `echartsBase.js:43` set dashed grids
  globally.
- Hero/stat figures use proportional figures; reserve `tabular-nums` for axis ticks and table
  rows.

Validate any palette change with the `dataviz` skill's `scripts/validate_palette.js` against
**both** surfaces (`--surface #121828 --mode dark`, `--surface #ffffff --mode light`) — the
default theme is dark, so a light-only check will miss failures.

## Contest constraints that affect code decisions

From the official rules (2025 v2.0 text; confirm against the 2026 edition):

- Judged on **Storytelling, Design, Innovativeness, Technique** — explicitly *not* ranked by
  importance.
- Interactive entries are submitted **as a URL** that must stay live through judging, and the
  **source code must be provided** to the organisers under an open licence
  (Open Definition–compliant).
- Must use **at least one dataset from the official Pacific Data Hub list**.
- Dataviz must be in **English or French**.
- The rules disqualify "dataviz generated by artificial intelligence". Scope is ambiguous for
  AI-assisted development; the entrant should clarify with the organisers before submitting.
