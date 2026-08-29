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

**Routes do not match the French names.** `/territory` (not `/territoire`), `/economie`,
`/cyclones` for the escale titled *La mémoire des tempêtes*. Check `App.js` before assuming.

The act **ids** are lowercase (`a1` … `a12`). One of them was `A12` and that single capital
broke the escale: the id keys `JOURNEY`, the i18n `home.acts.a12_*` and `/intro/a12.jpg`, so
the page announced "Acte 00 · Étape 00 / 12" and printed three raw i18n paths.

### `journeyContext.js` is the single source of truth for narrative order

`JOURNEY` (act id → route, in narrative order) and `MOVEMENTS` (5 narrative groupings)
drive act **numbering**, progress, and prev/next links everywhere. To reorder the story,
edit `JOURNEY` only — numbers recompute app-wide. **Never hardcode an act number** in a
component; use `numberOf(id)` / `padOf(id)`. Note the act *ids* are not in narrative order
(`a8` is act 03, `a12` is act 04) — that decoupling is intentional.

### Spacing and type

`_variables.scss` defines the spacing scale. **`--sp-5` was missing** while 40 call sites
across 7 files used it: `gap: var(--sp-5)` resolved to `normal` and the gaps silently
collapsed. It is now `1.25rem`. When adding a step, check every rung of the scale exists.

Type: **Newsreader** (display, 200–800), **Figtree** (body, 300–900), **DM Mono** (300/400/500),
loaded in `public/index.html`. Axis *values* carry `tk.text` at 13.5px; axis *titles* stay
`tk.textSoft` at 12px — the value is the data, the title is the label.

### Theming: CSS custom properties → JS tokens

`styles/_variables.scss` defines every color as a custom property under `:root` /
`[data-theme="light"]`. **Dark is the default.** CSS consumes `var(--c-*)` directly.

Canvas-based chart libraries (ECharts, ApexCharts) cannot resolve `var()`, so
`hooks/UseThemeTokens.js` reads the computed values into a plain `tk` object and re-reads
them via a `MutationObserver` on `[data-theme]`. **Every chart component calls
`useThemeTokens()` and passes `tk` into its options** — this is why charts retheme live.
Consequence: a hardcoded hex inside a chart is a bug, because it won't follow the theme.

### Chart layer

32 files in `components/charts/`, plus chart-bearing components among the 77
directories of `components/` — over ECharts, ApexCharts, D3, and Mapbox GL.
(25 pages, 10 services.)

- `charts/echartsBase.js` — ECharts option fragments (`axisStyle`, `tooltipStyle`,
  `paletteOf`) **and** the shared math helpers (`fmt`, `median`, `quantile`, `valAt`).
- `charts/apexBase.js` — the ApexCharts counterpart (`baseChart`, `baseGrid`, `baseLegend`,
  `baseXaxis`, `baseYaxis`, `baseTooltip`, `apexPalette`, `apexRamp`). It **re-exports** the
  math helpers from `echartsBase` rather than redefining them, so charts need one import.

New charts should compose these bases, not rebuild options from scratch.

### The escale template

Acts are now called **escales** in the UI. Eleven of the twelve render through `ActBoard` in
**focus mode** (`focus` prop) and share one layout; escale 12 (`/synthese`) is a GSAP scene
sequence with its own 14 components and none of this applies to it.

Note that the escale **number is not the act id**: `JOURNEY` orders them `a1, a2, a8, a12, a6,
a7, a3, a10, a4, a5, a9, a11` — so escale 03 is `Act8Ciel` and escale 04 is `Act12Cyclones`.
Never hardcode a number; use `numberOf(id)` / `padOf(id)`.

The pieces:

| Piece | Role |
|---|---|
| `EscaleBar` | one merged bar: escale prev/next + title + progress, then the view tabs. Replaces the old double header (ActBar + toolbar). |
| `ChartKey` | the reading column on the right: view title, *how to read* (↕ / ↔ / colour swatch), a `caveat` slot for method warnings, the takeaway, an *explore* hint, per-view `controls`, and the source pinned to the bottom. |
| `ChartHint` | the "?" pill, kept for the sub-1180 layout. |
| `VizSwitch` | segmented control **inside** the panel, when an escale carries several Home visuals. |
| `EscaleImmersion` | full-screen portal variant. Currently unused — kept for future escales. |

Rules the template enforces, so pages don't have to:

- **The map closes the navigation** — `ActBoard` sorts `id: "map"` last, *unless*
  the escale declares it `signature` (escale 04 does: the animated cyclone tracks
  are the demonstration, not a locator).
- **`INFO_IDS`** (`read`, `coverage`, `source`, `data`, `method`) leave the
  carousel and go behind the ⓘ button.
- **`ChartKey` is hidden below 1180px** — it would take from the plot the width it
  claims to earn. `ActBoard` therefore mirrors the view title, the finding and the
  `controls` into `.board__head` under that width. **Anything you put in the column
  must have that fallback, or it becomes unreachable on narrow screens.**

**Filters belong to the chart they drive, not to the bar.** A control that only
changes one view sits in that view's `controls` (rendered in the reading column);
one that changes every view stays in the escale bar.

Escale **10 · L'élan renouvelable** shows both cases at once: its year slider is global on the
*mix* dataset — it recomputes the band, the detail, the composition, the treemap and the donut
— and map-only on the *renewable* one, so it moves between the two places depending on the
selection. Escale **07 · La côte** is the pure case: `currentYear` has exactly one consumer,
the map's columns.

**Migrated so far** (empty bar, navigation only): escales **01, 02, 03, 05**. Escale 04 never
had filters. **The other six still carry theirs in the bar** — the migration is deliberate and
escale-by-escale, using the previous ones as the reference.

Before moving a filter, **verify its reach** — don't assume. The region predicate feeds 5 to 17
call sites depending on the escale: it really is global, and it stays in the bar.

Visual views take **no** filter: the Home drawings carry their own territory
selector and ignore the escale's filters.

### The voyage has a threshold

"Découvrir" (both the hero button and `ClosingCta`, which share `beginExperience`)
no longer navigates straight to `/recit`. It opens **`components/VoyageSetup`**, a
portal dialog asking two things the app used to guess:

- **Language** — was inferred from `navigator.language`, so an English reader on a
  French machine started in French. Options are self-labelled ("Français" /
  "English"), never translated.
- **Display** — was inferred from `prefers-color-scheme`, so a light system opened a
  story composed for darkness. **Dark is preselected on open regardless of the system
  setting**, and the card says why.

Two behaviours to preserve if you touch it:

- **Choices apply live.** Clicking a card calls `setLang`/`setTheme` immediately — the
  page behind the translucent panel rethemes, the panel itself changes language. The
  entering state is captured in a ref so Esc / scrim / "Pas encore" restores lang *and*
  theme exactly.
- **The theme swatches hardcode hex.** They must show the theme they *offer*, not the
  active one; `var(--c-*)` would paint both chips identically and the "Clair" card
  would render dark. This is the one place in the app where a literal colour is
  correct — the values mirror the two blocks of `_variables.scss`.

Strings live under `home.setup.*` in `extraStrings.js`.

### Escale 12 (`/synthese`): 22 scenes, and no reader-set weights

Two scenes were removed from the GSAP sequence (24 → 22):

- **"La distribution"** (the `StressSwarm` beeswarm) — it asked the reader to read a
  density of points, an analyst's gesture inside a narrative that shows rankings and
  maps everywhere else. What it said is carried by "Les plus exposés". The component
  survives in `components/charts/StressSwarm/` with no caller.
- **"À vous de juger"** (`WeightStudio`) — sliders letting the reader reweight each
  dimension of the composite index from 0 to 2. The intent was honest; the effect was
  not, since any ranking could be manufactured and nothing on screen distinguished it
  from the data's own. Component, state (`weights`/`setWeight`/`resetWeights`) and
  `.wstudio` styles are gone.

**`composite` is now a plain equal-weight mean.** The numbers are unchanged — the
weights defaulted to 1, so `wsum/wtot` was already `sum/count`.

Three strings promised the weighting and were corrected in `extraStrings.js`
(`act11.thesis`, `act11.outro.text`, both languages). `act11.story.studio_*`,
`act11.story.swarm_*`, `act11.calc.*` and `act11.guide_*` are now unused; the last two
groups were already dead — **nothing renders them**.

### Every escale title is a question

The twelve titles name no subject any more — each one asks something the
escale's own indicators can settle ("La mer monte-t-elle là où l'on vit ?",
"Plus de cyclones, ou des cyclones plus forts ?"). The dashboard is the answer;
the `thesis` under it says with what. Two rules when editing one:

- **The question must be answerable by that escale's data alone.** No causes
  where there are only correlations, no future where there are only past
  series.
- **`home.acts.<id>_title` is the single source.** Five pages used to read
  their own `act6.title` … `act10.title`, so a neighbour's prev/next arrow could
  announce a different title than the escale showed on arrival. They all read
  the shared key now; the `actN.title` entries are dead but left in the dicts.

The strings live in `i18n/extraStrings.js` (one `home.acts` object per language),
not in the JSON dicts.

Consequence on layout: questions run ten to twenty characters longer than the old
titles. `.escbar__where` keeps the question **whole above 1400px** and lets it
ellipsise below (full text on `title` hover). The view tabs scroll instead —
`.chcar__track` now carries an 18px edge mask, because its scrollbar is hidden and
a clipped tab used to look like the last one. **Six escales hide tabs at 1600px**
(Économie the worst, ~371px ≈ four tabs). That predates the questions; the mask
only makes it visible.

### The Home visuals live in the escales

The seventeen interactive SVG drawings (`SeaWarm`, `SmokePlume`, `PlantGrowth`,
`CattleThrive`, `ForestCover`, `SkyRain`, `BiodiversityReef`, `StiltHouse`,
`PopGrowth`, `CoastlineShift`, `WaterGlass`, `TbBacilli`, `CrowdAffected`,
`LossStack`, `EnergyCell`, `PowerMix`, `TourismBeach`) each read exactly one
escale's dataset. **They are no longer mounted on the Home** — `home__signatures`
is gone. Each is the opening view of its escale, and several in one escale are
grouped under a single tab with a `VizSwitch`.

They render with the `embed` prop, which emits `<block>--embed`. The layout reset
for that class lives once in **`styles/_embedded-visuals.scss`**, projected over the
block prefixes: without it a drawing keeps its full-page section template inside a
dashboard panel.

> **Gotcha, learned the hard way.** That partial hides `<block>__head` (the
> editorial header duplicates the view title). Any SVG element you name
> `<block>__head` inherits `display: none` — a cow's head vanished this way, leaving
> only its outline. Same risk for `__inner`, `__stage`, `__viz`, `__svg`.

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

**`extraStrings.js` holds ONE object per language.** A second key of the same name in the same
literal silently overwrites the first — the last one wins in JS, and nothing warns you. This
has already swallowed three legends. When adding to `fr` or `en`, merge into the existing
object; never append a second `home: {…}` or `act8: {…}`.

Pages carry a local `tx(key, fr, en)` helper: it returns the dictionary value when the key
exists and the literal otherwise, so a new string can ship before it is versed into the
dictionaries — without ever printing a dotted path on screen.

## Known repo hygiene issues

- **`npm run build` passes.** It used to fail: `src/data/datasetSources.js` declared
  `disastersAffected` twice, and `no-dupe-keys` is an error under CRA. The second entry (UNSD)
  was removed and the first kept — the PDH/UNDRR Sendai record, marked "jeu officiel du
  Challenge", which is what the service actually queries and what the contest's
  "at least one Pacific Data Hub dataset" rule needs. A comment at the old site records the
  choice. The dev server tolerated the duplicate, which is why it went unnoticed for so long:
  **run the production build before believing the app compiles.**
- **`.env.example` is tracked and contains what looks like a live SSH root password and host.**
  It is in git history. Treat as compromised: rotate the credential and purge it from history.
  *(Unchanged — still true.)*
- The "61 `.css` + 60 `.css.map` committed next to their `.scss`" is **no longer true**: only
  `src/App.css` remains. CRA compiles the `.scss` directly; editing a `.css` here has no effect.

## Dataviz conventions

### The colour system — three encodings, one rule each

Every chart must **declare what its colour encodes** rather than picking a ramp ad hoc.
This is what keeps 12 acts reading as one product. Use `rampFor(kind, tk)` from
`charts/echartsBase.js`, or pass `kind` to `HeatmapChart`:

| `kind` | For | Ramp | Legend must say |
|---|---|---|---|
| `magnitude` | grandeur with no value judgement (population, arrivals, counts) | sequential lavender (`--c-seq-*`) | "low → high" |
| `stress` (default) | oriented quantity — **dark is always worse** (emissions, TB, sea level) | ordinal lavender (`--c-ord-*`) | "spared → exposed" |
| `polarity` | true polarity around a meaningful zero (anomaly vs normal, change vs base) | diverging **blue ↔ amber** (`--c-div-*`), neutral grey centre | "below ← 0 → above" |

Two hard rules behind this:

- **Never green ↔ red.** Measured at **ΔE 4.1** under deuteranopia — the two poles are the
  *same colour* for ~8% of men — while reading ΔE 33.9 to normal vision. That gap is exactly
  why it survives everywhere: whoever picks it cannot see the problem.

  The diverging ramp is now **blue ↔ amber**, not lavender ↔ red. Candidates were measured
  on protan/deutan/tritan; blue ↔ amber won, then had its chroma pulled back 24% because the
  saturated version read as an alert. Final worst-case CVD **ΔE 20.5**; poles at 7.89:1 and
  8.18:1 on the dark surface, 5.41:1 and 5.40:1 on the light one.
- **Polarity is a property of the indicator, not of the number.** High water access is good;
  high TB incidence is bad. `services/syntheseApi.js` already declares this per indicator
  (`dir: "up" | "down" | "abs"`) — reuse that, don't re-derive it. A value that is positive
  for humans is not necessarily positive for the environment.

**No ramp is theme-invariant any more.** The diverging one never was — on the navy surface
its poles must be *light*, or the extreme values sink into the background. But the sequential
and ordinal ramps were, and that was a bug: their salience read **inverted** on dark. Measured
before the fix — `--c-seq-100` (the *lowest* value) at 14.37:1 on navy against `--c-seq-900`
(the *highest*) at 1.37:1. The low end shouted, the high end vanished.

`scripts/validate_palette.js` passes such a ramp: it checks monotonicity and the light end, not
whether salience follows value. **The validator cannot catch this — you have to look.**

All three ramps are therefore declared inside the two theme blocks of `_variables.scss`. The
invariant to preserve: **token 100/1 is the lowest value and 900/6 the highest, in both
themes** — on dark that means the high end is the *light* token, on light the dark one.

### Series colour follows the entity

`charts/seriesColor.js` (`territoryColors`) assigns territory colours from a **canonical,
unfiltered order**, so changing the sub-region filter never repaints the survivors. Past
8 series it switches to encoding the sub-region (3 hues — the validated all-pairs cap),
because nobody distinguishes 22 line colours. Never index a palette by position in a
filtered array, and never `i % palette.length`.

### Remaining violations

Re-audited against the sources. Most of the earlier list is **fixed** — don't re-report it:
`BarRace`, `ProfileRadar`, `RiverChart` and `TrendLines` now fall back to neutral ink past the
palette cap instead of `i % length`, and the duplicates `charts/RiverChart copy.jsx` and
`components/RiverChart/` no longer exist. Gridlines are dashed globally
(`apexBase.js` `strokeDashArray: 4`, `echartsBase.js` `type: "dashed"`).

What is still open:

- **No dual-axis charts.** `charts/DualAxisChart.jsx` and `charts/ParetoChart.jsx` use two
  y-scales. `EvolutionLines` has an `index` mode (base 100 + reference line) that is the
  correct one-axis replacement.
- **`OceanMap` still ships a `semantic` ramp — green ↔ red.** Two callers remain:
  `pages/Act3Territory` (the satellite coastline view, deliberately left alone by the entrant)
  and `pages/Ocean/Ocean.jsx` — a page outside the twelve escales, never re-read in this pass.
  The ramp is the doctrine violation, not the views.
- **`stress` has no inverted form.** Indicators where *low* is worse (Red List Index, safe
  water) are painted `magnitude` and the reading key says in words which end warns. A ramp
  that could carry that orientation would remove the words.
- **Stale colour words in the copy.** Ramps changed; sentences did not always follow. Three
  were caught on escale 03 (`heat_find`, `heat_take`, `map_sub` still said "rouge") and one on
  escale 04. **`fr.json:1020` and its English twin still name red on views not yet re-read.**
  A legend naming a colour absent from the screen is worse than no legend — check the copy
  whenever you touch a ramp.

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
