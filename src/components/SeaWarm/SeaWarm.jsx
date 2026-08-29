// src/components/SeaWarm/SeaWarm.jsx
// ============================================================
// SECTION SIGNATURE #9 — « La mer qui chauffe » (Home). Un océan à HOULE
// animée (couleur constante) dans lequel est planté un THERMOMÈTRE — le cœur
// du visuel. Le mercure MONTE / DESCEND selon l'ANOMALIE DE TEMPÉRATURE réelle
// du territoire (°C vs normale), via le service dédié `cielApi` (NOAA · via
// Pacific Data Hub). On passe par cielApi (sonde de clé + repli proxy) car le
// fetch générique à clé fixe échoue sur cette série.
//
// Le « 0 » = la normale ; au-dessus = plus chaud (mercure corail), en-dessous
// = plus frais (mercure cyan). L'EAU NE CHANGE PAS DE COULEUR.
//
// Honnête : grand nombre = anomalie RÉELLE (°C, signée) ; hauteur du mercure =
// échelle symétrique relative à l'amplitude du Pacifique (dit sous le visuel) ;
// tendance « depuis {année} » réelle. Houle animée (rAF) ; mercure animé par
// GSAP. prefers-reduced-motion respecté. <section>/ref toujours montés.
// Tokens, FR/EN, zéro inline.
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import gsap from "gsap";
import { useLang } from "../../store/context/langContext";
import { isPict, pictName } from "../../i18n/pictNames";
import flagUrl from "../../i18n/flagUrl";
import useInView from "../../hooks/UseInView";
import useCiel from "../../hooks/UseCiel";
import Loader from "../Loader/Loader";
import "./SeaWarm.scss";

const SURFACE_Y = 138;
const HIGH_Y = 58;
const LOW_Y = 226;
const BULB_Y = 260;
// Le zéro du tube : la normale 1971-2000. Il tombe au milieu de la course
// du mercure, puisque l'échelle est symétrique autour de lui.
const ZERO_Y = (HIGH_Y + LOW_Y) / 2;
const BUBBLES = [120, 142, 178, 198, 150];

function median(arr) {
  const v = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function firstFinite(serie) {
  for (let i = 0; i < serie.length; i += 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function lastFinite(serie) {
  for (let i = serie.length - 1; i >= 0; i -= 1)
    if (Number.isFinite(serie[i].value)) return serie[i];
  return null;
}
function fillTpl(str, map) {
  return Object.entries(map).reduce(
    (s, [k, val]) => s.split(`{${k}}`).join(String(val)),
    String(str),
  );
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export default function SeaWarm({ embed = false, code = null } = {}) {
  const { t, lang } = useLang();
  const [ref, inView, visible] = useInView({ threshold: 0.25 });
  const nf = useMemo(
    () =>
      new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [lang],
  );
  const signed = useCallback(
    (val) => (val < 0 ? "\u2212" : "+") + nf.format(Math.abs(val)),
    [nf],
  );

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ciel = useCiel(lang);
  const tempDs = ciel.data && ciel.data.landTemp;
  const ready =
    ciel.status === "done" &&
    tempDs &&
    tempDs.status === "live" &&
    tempDs.byArea;

  const list = useMemo(() => {
    if (!ready) return [];
    const raw = Object.entries(tempDs.byArea)
      .filter(([code]) => isPict(code))
      .map(([code, serie]) => {
        const pt = lastFinite(serie);
        if (!pt || !Number.isFinite(pt.value)) return null;
        const f = firstFinite(serie);
        return {
          code,
          name: pictName(code, lang),
          val: pt.value,
          year: pt.year,
          delta: f ? pt.value - f.value : null,
          fromYear: f ? f.year : null,
        };
      })
      .filter(Boolean);
    if (!raw.length) return [];
    const a = Math.max(...raw.map((o) => Math.abs(o.val))) || 1;
    return raw
      .map((o) => ({ ...o, amp: a, w: Math.max(-1, Math.min(1, o.val / a)) }))
      .sort((a2, b2) => a2.name.localeCompare(b2.name, lang));
  }, [ready, tempDs, lang]);

  // AMPLITUDE DE L'ÉCHELLE — le plus grand écart absolu observé, tous
  // territoires confondus. Elle bornait déjà la hauteur du mercure ; elle sort
  // du memo parce que c'est elle qui donne leur VALEUR aux graduations : sans
  // elle, les traits du tube ne sont que du décor.
  const amp = list.length ? list[0].amp : 1;

  // GRADUATIONS. On place des traits à des valeurs rondes plutôt qu'à des
  // positions rondes : un thermomètre se lit en degrés, pas en pixels. Le pas
  // s'adapte à l'amplitude du jeu — inutile de graduer tous les 0,5 °C une
  // échelle qui monte à 0,6.
  const tickStep = amp > 1.6 ? 0.5 : amp > 0.8 ? 0.25 : 0.1;
  const yForVal = (v) => ZERO_Y - (v / amp) * ((LOW_Y - HIGH_Y) / 2);
  const graduations = (() => {
    const out = [];
    for (let v = -Math.floor(amp / tickStep) * tickStep; v <= amp + 1e-9; v += tickStep) {
      const r = Math.round(v / tickStep) * tickStep;
      const y = yForVal(r);
      if (y >= HIGH_Y - 1 && y <= LOW_Y + 1) out.push({ v: r, y });
    }
    return out;
  })();

  const byCode = useMemo(() => {
    const m = {};
    list.forEach((o) => {
      m[o.code] = o;
    });
    return m;
  }, [list]);

  const medianVal = useMemo(() => median(list.map((o) => o.val)), [list]);
  const extremes = useMemo(() => {
    if (!list.length) return null;
    let warm = list[0];
    let cool = list[0];
    list.forEach((o) => {
      if (o.val > warm.val) warm = o;
      if (o.val < cool.val) cool = o;
    });

    // EX ÆQUO — l'égalité se juge sur la valeur TELLE QU'ELLE EST AFFICHÉE.
    // Les anomalies sont montrées à deux décimales : deux îles qui portent
    // toutes les deux « +0,92 » sont ex æquo pour le lecteur, même si leurs
    // valeurs brutes diffèrent au millième. Trancher sur la valeur brute
    // désignerait un vainqueur que rien à l'écran ne distingue de son voisin.
    const same = (a, b) => signed(a) === signed(b);
    const warmTies = list.filter((o) => same(o.val, warm.val));
    const coolTies = list.filter((o) => same(o.val, cool.val));
    return { warm, cool, warmTies, coolTies };
  }, [list, signed]);

  // Quelle liste d'ex æquo est ouverte : "warm", "cool", ou aucune.
  const [tiesOpen, setTiesOpen] = useState(null);

  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!list.length) return;
    if (!selected || !byCode[selected]) {
      setSelected(extremes ? extremes.warm.code : list[0].code);
    }
  }, [list, selected, byCode, extremes]);

  const sel = selected ? byCode[selected] : null;
  useEffect(() => {
    if (embed && code) setSelected(code);
  }, [embed, code]);

  /* ----------- Houle + mercure ----------- */
  const seaRef = useRef(null);
  const crestRef = useRef(null);
  const bubbleRefs = useRef([]);
  const mercuryRef = useRef(null);
  // Les deux nappes de volume posées sur le capillaire : elles doivent monter
  // et descendre avec lui, sinon l'ombre reste accrochée au verre.
  const mercShadeRef = useRef(null);
  const mercShadeDarkRef = useRef(null);
  const numberRef = useRef(null);
  const animObj = useRef({ w: 0, val: 0 });
  const startedRef = useRef(false);

  const draw = useCallback(
    (phase) => {
      const w = animObj.current.w;
      if (numberRef.current)
        numberRef.current.textContent = signed(animObj.current.val);

      const f = 0.5 + 0.5 * w;
      const my = LOW_Y + (HIGH_Y - LOW_Y) * f;
      const mh = (BULB_Y + 6 - my).toFixed(1);
      const myTxt = my.toFixed(1);
      [mercuryRef, mercShadeRef, mercShadeDarkRef].forEach((r) => {
        if (!r.current) return;
        r.current.setAttribute("y", myTxt);
        r.current.setAttribute("height", mh);
      });

      const build = (amp, k, sp, off) => {
        let d = `M-10,${SURFACE_Y}`;
        for (let x = -10; x <= 330; x += 16) {
          const yy = reduced
            ? SURFACE_Y
            : SURFACE_Y + amp * Math.sin(x * k + phase * sp + off);
          d += ` L${x},${yy.toFixed(2)}`;
        }
        return d;
      };
      if (seaRef.current)
        seaRef.current.setAttribute(
          "d",
          `${build(5, 0.05, 1.3, 0)} L330,300 L-10,300 Z`,
        );
      if (crestRef.current)
        crestRef.current.setAttribute("d", build(4, 0.06, 1.7, 1.2));

      bubbleRefs.current.forEach((node, i) => {
        if (!node) return;
        const sp = 26 + (i % 3) * 9;
        const yb = reduced
          ? 220 - i * 14
          : 272 - ((phase * sp + i * 30) % 130);
        const op = clamp01((yb - SURFACE_Y) / 60) * 0.5;
        node.setAttribute("cy", yb.toFixed(1));
        node.setAttribute("opacity", op.toFixed(3));
      });
    },
    [reduced, signed],
  );

  useEffect(() => {
    if (!sel) return undefined;
    if (inView) startedRef.current = true;

    if (reduced || !startedRef.current) {
      animObj.current.w = sel.w;
      animObj.current.val = sel.val;
      draw(0);
      return undefined;
    }
    const tween = gsap.to(animObj.current, {
      w: sel.w,
      val: sel.val,
      duration: 1.3,
      ease: "power2.out",
    });
    return () => tween.kill();
  }, [inView, sel, reduced, draw]);

  useEffect(() => {
    if (reduced) {
      draw(0);
      return undefined;
    }
    if (!visible) return undefined;
    let raf = 0;
    let phase = 0;
    let last = performance.now();
    const loop = (now) => {
      phase += (now - last) / 1000;
      last = now;
      draw(phase);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced, visible, draw]);

  const loading = ciel.status === "loading";
  const failed =
    ciel.status === "error" ||
    (ciel.status === "done" && (!tempDs || tempDs.status !== "live"));
  const empty = ready && list.length === 0;

  const valText = sel ? signed(sel.val) : "0";
  // LE SEUIL DE COULEUR EST LA MÉDIANE RÉGIONALE, PAS LE ZÉRO.
  //
  // Le mercure basculait de teinte au passage de la normale 1971-2000. Mais
  // en 2025 tout le Pacifique est au-dessus de sa normale : le thermomètre
  // affichait la même couleur pour les vingt-et-un territoires, et ne
  // distinguait donc plus rien. Une couleur qui ne varie jamais n'encode rien.
  //
  // Rapportée à la MÉDIANE des territoires, la teinte redevient une
  // information : elle dit « plus chaud que la moitié du Pacifique » ou
  // « moins chaud ». C'est une comparaison entre pairs, pas un jugement — et
  // c'est ce que le lecteur cherche en changeant d'île dans le sélecteur.
  const warm = sel && medianVal != null ? sel.val >= medianVal : sel ? sel.val >= 0 : true;

  const trendEl = (() => {
    if (!sel || sel.delta == null || sel.fromYear == null) return null;
    const d = sel.delta;
    if (Math.abs(d) < 0.01)
      return (
        <span className="sea__trend sea__trend--flat">
          {fillTpl(t("home.sea.trend_flat"), { year: sel.fromYear })}
        </span>
      );
    if (d > 0)
      return (
        <span className="sea__trend sea__trend--up">
          {fillTpl(t("home.sea.trend_up"), {
            n: nf.format(d),
            year: sel.fromYear,
          })}
        </span>
      );
    return (
      <span className="sea__trend sea__trend--down">
        {fillTpl(t("home.sea.trend_down"), {
          n: nf.format(Math.abs(d)),
          year: sel.fromYear,
        })}
      </span>
    );
  })();

  const svgLabel = sel
    ? fillTpl(t("home.sea.aria"), { area: sel.name, n: valText, year: sel.year })
    : t("home.sea.title");

  return (
    <section
      className={`sea ${embed ? "sea--embed" : ""}`}
      ref={ref}
      data-inview={inView ? "true" : "false"}
    >
      <div className="sea__inner container">
        <header className="sea__head">
          <p className="eyebrow sea__kicker">{t("home.sea.kicker")}</p>
          <h2 className="sea__title">{t("home.sea.title")}</h2>
          <p className="sea__lead">{t("home.sea.lead")}</p>
        </header>

        {/* Même attente que partout ailleurs : la pirogue en filigrane.
            Le chargement de cette série est long (sonde de clé côté API),
            et un simple « Chargement… » sur un panneau vide donnait
            l'impression que rien ne se passait. */}
        {loading && <Loader compact label={t("home.sea.loading")} />}
        {(failed || empty) && (
          <p className="sea__state sea__state--err">
            {t("home.sea.unavailable")}
          </p>
        )}

        {ready && sel && (
          <div className="sea__stage">
            {/* Colonne 1 — contrôles */}
            <div className="sea__controls">
              <label className="sea__field">
                <span className="sea__field-label">
                  {t("home.sea.select_label")}
                </span>
                <span className="sea__select">
                  <img
                    className="sea__flag"
                    src={flagUrl(sel.code)}
                    alt=""
                    aria-hidden="true"
                  />
                  <select
                    className="sea__native"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    aria-label={t("home.sea.select_label")}
                  >
                    {list.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                  <span className="sea__chevron" aria-hidden="true">
                    ▾
                  </span>
                </span>
              </label>

              {extremes && (
                /* ============================================================
                   LES DEUX EXTRÊMES, ET CE QU'ILS CACHAIENT
                   ------------------------------------------------------------
                   « Le plus chaud +0,92 » désignait UN territoire. Mais les
                   valeurs sont lues à deux décimales : plusieurs îles affichent
                   régulièrement le même chiffre, et la pastille en choisissait
                   une arbitrairement — la première rencontrée dans la boucle.
                   Le lecteur croyait à un record unique là où il y avait une
                   égalité.

                   La pastille annonce donc le nombre d'ex æquo, et les nomme au
                   survol. Chacun est cliquable : l'égalité devient une porte
                   d'entrée dans la donnée au lieu d'un détail escamoté.
                   ============================================================ */
                <div className="sea__chips">
                  {[
                    { key: "warm", peak: extremes.warm, ties: extremes.warmTies, label: t("home.sea.warmest") },
                    { key: "cool", peak: extremes.cool, ties: extremes.coolTies, label: t("home.sea.coolest") },
                  ].map(({ key, peak, ties, label }) => (
                    <div
                      key={key}
                      className="sea__chipwrap"
                      onMouseEnter={() => setTiesOpen(key)}
                      onMouseLeave={() => setTiesOpen(null)}
                      onFocus={() => setTiesOpen(key)}
                      onBlur={(e) => {
                        // On ne referme que si le focus QUITTE le groupe : sans
                        // ce test, tabuler de la pastille vers la liste la
                        // refermait avant qu'on ait pu l'atteindre.
                        if (!e.currentTarget.contains(e.relatedTarget)) setTiesOpen(null);
                      }}
                    >
                      <button
                        type="button"
                        className="sea__chip"
                        onClick={() => setSelected(peak.code)}
                        aria-expanded={ties.length > 1 ? tiesOpen === key : undefined}
                      >
                        {label}
                        <em>{signed(peak.val)}</em>
                        {ties.length > 1 ? (
                          <span className="sea__chip-count">{ties.length}</span>
                        ) : null}
                      </button>

                      {ties.length > 1 && tiesOpen === key ? (
                        <div className="sea__ties" role="group" aria-label={label}>
                          <p className="sea__ties-head">
                            {fillTpl(t("home.sea.ties_head"), { n: ties.length })}
                          </p>
                          <ul className="sea__ties-list">
                            {ties.map((o) => (
                              <li key={o.code}>
                                <button
                                  type="button"
                                  className={`sea__ties-item ${
                                    o.code === selected ? "is-on" : ""
                                  }`}
                                  onClick={() => setSelected(o.code)}
                                >
                                  <img
                                    className="sea__ties-flag"
                                    src={flagUrl(o.code)}
                                    alt=""
                                    aria-hidden="true"
                                  />
                                  <span className="sea__ties-name">{o.name}</span>
                                  <span className="sea__ties-val">{signed(o.val)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Colonne 2 — l'océan + thermomètre */}
            <figure className="sea__viz">
              <svg
                className="sea__svg"
                viewBox="0 0 320 300"
                role="img"
                aria-label={svgLabel}
              >
                <defs>
                  <clipPath id="sea-frame">
                    <rect x="0" y="0" width="320" height="300" rx="16" />
                  </clipPath>

                  {/* VOLUME DU MERCURE.
                      Un liquide dans un capillaire ROND ne se voit pas à plat :
                      la lumière frappe le bord gauche, le centre reste franc,
                      le bord droit tombe dans l'ombre. C'est ce dégradé qui
                      fait la différence entre un trait de couleur et une
                      colonne de métal liquide.

                      Deux nappes NEUTRES posées par-dessus la teinte, plutôt
                      qu'un dégradé de teintes : la couleur du mercure doit
                      rester exactement celle des jetons de l'escale, quel que
                      soit le thème et quel que soit le côté de la médiane. Du
                      blanc et du noir en opacité ne déplacent aucune teinte,
                      ils ne font que sculpter. */}
                  <linearGradient id="sea-cyl-light" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
                    <stop offset="34%" stopColor="#fff" stopOpacity="0.12" />
                    <stop offset="62%" stopColor="#fff" stopOpacity="0" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="sea-cyl-dark" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#000" stopOpacity="0" />
                    <stop offset="55%" stopColor="#000" stopOpacity="0" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
                  </linearGradient>

                  {/* Le réservoir est une sphère allongée : sa lumière vient du
                      même côté, mais elle rayonne au lieu de filer. */}
                  <radialGradient id="sea-bulb-light" cx="0.32" cy="0.28" r="0.85">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
                    <stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0.32" />
                  </radialGradient>
                </defs>

                <g clipPath="url(#sea-frame)">
                  <rect className="sea__sky" x="0" y="0" width="320" height="300" />
                  <path ref={seaRef} className="sea__water" d="" />
                  <path ref={crestRef} className="sea__crest" d="" fill="none" />
                  {BUBBLES.map((x, i) => (
                    <circle
                      key={i}
                      ref={(n) => {
                        bubbleRefs.current[i] = n;
                      }}
                      className="sea__bubble"
                      cx={x}
                      cy="260"
                      r={2 + (i % 3)}
                      opacity="0"
                    />
                  ))}

                  {/* ============================================================
                      THERMOMÈTRE MÉDICAL À MERCURE
                      ------------------------------------------------------------
                      La forme est celle d'un thermomètre à fièvre, pas d'un
                      pictogramme de température. Ce qui la caractérise, et qui
                      est repris ici pièce par pièce :

                        • une TIGE longue et étroite, pas un gros tube ;
                        • une ARÊTE PRISMATIQUE sur la face avant — c'est elle
                          qui, sur l'objet réel, grossit la colonne pour la
                          rendre lisible ; sans elle un filet de mercure de
                          quelques dixièmes de millimètre serait invisible ;
                        • un CAPILLAIRE très fin, et non une colonne large ;
                        • un ÉTRANGLEMENT juste au-dessus du réservoir : c'est
                          le détail qui fait qu'un thermomètre médical retient
                          son maximum au lieu de redescendre ;
                        • un RÉSERVOIR allongé en capsule, pas une boule ;
                        • des graduations FINES et serrées, chiffrées une fois
                          sur deux.

                      LES COULEURS NE CHANGENT PAS. L'ambre et le bleu de la
                      rampe divergente disent « au-dessus » et « au-dessous » de
                      la normale dans toutes les vues de l'escale. Seule la forme
                      devient celle d'un vrai instrument.
                      ============================================================ */}
                  <g className="sea__thermo">
                    {/* La tige et son réservoir, d'un seul tenant de verre. */}
                    <rect
                      className="sea__stem"
                      x="151"
                      y="42"
                      width="18"
                      height="200"
                      rx="9"
                    />
                    <rect
                      className="sea__stem"
                      x="150"
                      y="236"
                      width="20"
                      height="48"
                      rx="10"
                    />

                    {/* L'arête prismatique : la bande centrale, plus claire, qui
                        court sur toute la tige. */}
                    <rect
                      className="sea__prism"
                      x="155"
                      y="46"
                      width="10"
                      height="192"
                      rx="5"
                    />

                    {/* LE MERCURE — un filet, pas une colonne. Le rectangle est
                        piloté à la frame près (`mercuryRef`) ; la capsule reste
                        pleine, comme le réservoir d'un vrai thermomètre. */}
                    <g
                      className={
                        warm ? "sea__merc sea__merc--warm" : "sea__merc sea__merc--cool"
                      }
                    >
                      <rect ref={mercuryRef} x="157.5" y="150" width="5" height="100" rx="2.5" />
                      <rect x="153.5" y="240" width="13" height="40" rx="6.5" />
                    </g>

                    {/* Le VOLUME, posé par-dessus la teinte. Les nappes suivent
                        la géométrie du mercure — même x, même largeur — et non
                        celle du verre : c'est le liquide qu'on sculpte.
                        Le capillaire suit `mercuryRef` par un second ref, sinon
                        l'ombre resterait immobile pendant que la colonne monte. */}
                    <rect
                      ref={mercShadeRef}
                      x="157.5"
                      y="150"
                      width="5"
                      height="100"
                      rx="2.5"
                      fill="url(#sea-cyl-light)"
                      pointerEvents="none"
                    />
                    <rect
                      ref={mercShadeDarkRef}
                      x="157.5"
                      y="150"
                      width="5"
                      height="100"
                      rx="2.5"
                      fill="url(#sea-cyl-dark)"
                      pointerEvents="none"
                    />
                    <rect
                      x="153.5"
                      y="240"
                      width="13"
                      height="40"
                      rx="6.5"
                      fill="url(#sea-bulb-light)"
                      pointerEvents="none"
                    />

                    {/* L'ÉTRANGLEMENT. Sur l'objet réel, ce rétrécissement du
                        capillaire empêche le mercure de redescendre : le
                        thermomètre garde la température la plus haute atteinte,
                        et il faut le secouer pour le remettre à zéro. C'est ce
                        qui distingue un thermomètre médical de tous les autres,
                        et cela se voit à l'œil nu sur le verre. */}
                    <rect className="sea__neck" x="155" y="230" width="10" height="6" rx="3" />

                    {/* Reflet spéculaire : la lumière prise par l'arête. */}
                    <rect
                      className="sea__merc-shine"
                      x="153.2"
                      y="48"
                      width="2.2"
                      height="188"
                      rx="1.1"
                    />
                    <rect
                      className="sea__bulb-shine"
                      x="151.6"
                      y="243"
                      width="2.4"
                      height="28"
                      rx="1.2"
                    />

                    {/* Le contour du verre, par-dessus tout le reste. */}
                    <rect
                      className="sea__glass"
                      x="151"
                      y="42"
                      width="18"
                      height="200"
                      rx="9"
                      fill="none"
                    />
                    <rect
                      className="sea__glass"
                      x="150"
                      y="236"
                      width="20"
                      height="48"
                      rx="10"
                      fill="none"
                    />

                    {/* LE CODE DU TERRITOIRE, DANS LE RÉSERVOIR.
                        Le sélecteur est à l'autre bout du panneau : en regardant
                        l'instrument seul, on ne savait pas ce qu'on lisait. La
                        capsule est la seule pièce assez large du dessin pour
                        porter deux lettres, et c'est là que l'œil arrive en
                        descendant la tige. */}
                    <text className="sea__bulb-code" x="160" y={BULB_Y + 5}>
                      {sel.code}
                    </text>

                    {/* Les graduations, fines et serrées comme sur l'objet. */}
                    <g className="sea__ticks">
                      {graduations.map((g) => {
                        // Une graduation sur deux porte son chiffre — et la
                        // parité se calcule sur la VALEUR, pas sur le rang dans
                        // la liste : ancrée sur le rang, elle sautait le zéro
                        // une fois sur deux selon l'amplitude du jeu, alors que
                        // c'est la seule valeur qu'il faut toujours pouvoir
                        // lire.
                        const major =
                          Math.round(Math.abs(g.v) / tickStep) % 2 === 0;
                        return (
                          <g key={g.v.toFixed(3)}>
                            <line
                              className={major ? "sea__tick sea__tick--major" : "sea__tick"}
                              x1="170"
                              y1={g.y}
                              x2={major ? 180 : 176}
                              y2={g.y}
                            />
                            {major ? (
                              <text className="sea__tick-lab" x="184" y={g.y + 3.5}>
                                {g.v > 0 ? "+" : g.v < 0 ? "−" : ""}
                                {Math.abs(g.v).toFixed(tickStep < 0.25 ? 1 : 2)}
                              </text>
                            ) : null}
                          </g>
                        );
                      })}
                    </g>

                    {/* DEUX REPÈRES, DEUX RÔLES — et c'est le second qui
                        commande la couleur.

                        La NORMALE (1971-2000) est l'origine de l'échelle : elle
                        dit d'où l'on compte. Discrète, en pointillés.

                        La MÉDIANE régionale est le seuil de LECTURE : le
                        mercure prend sa teinte chaude au-dessus, froide en
                        dessous. Elle était jusqu'ici reléguée à une ligne de
                        texte sous le dessin, alors qu'elle est ce qui explique
                        la couleur qu'on a sous les yeux. Elle est donc tracée
                        sur le tube, en trait plein, avec sa valeur. */}
                    <line className="sea__zero" x1="146" y1={ZERO_Y} x2="180" y2={ZERO_Y} />
                    <text className="sea__zero-tag" x="142" y={ZERO_Y + 3.5}>
                      {t("home.sea.normal_tag")}
                    </text>

                    {medianVal != null ? (
                      <g className="sea__median">
                        <line
                          className="sea__median-line"
                          x1="140"
                          y1={yForVal(medianVal)}
                          x2="180"
                          y2={yForVal(medianVal)}
                        />
                        <text className="sea__median-tag" x="136" y={yForVal(medianVal) - 5}>
                          {t("home.sea.median_tag")}
                        </text>
                        <text className="sea__median-val" x="136" y={yForVal(medianVal) + 9}>
                          {signed(medianVal)}
                        </text>
                      </g>
                    ) : null}
                  </g>
                </g>

                <rect
                  className="sea__frame"
                  x="1"
                  y="1"
                  width="318"
                  height="298"
                  rx="16"
                  fill="none"
                />
              </svg>
              <figcaption className="sea__viz-cap">
                {t("home.sea.intensity_caption")}
              </figcaption>
            </figure>

            {/* Colonne 3 — lecture */}
            <div className="sea__readout">
              <p className={`sea__val ${warm ? "sea__val--warm" : "sea__val--cool"}`}>
                <span ref={numberRef} className="sea__val-num">
                  {valText}
                </span>
                <span className="sea__val-unit">{t("home.sea.unit")}</span>
              </p>
              <p className="sea__val-cap">{t("home.sea.value_caption")}</p>
              <p className="sea__name">
                <img
                  className="sea__name-flag"
                  src={flagUrl(sel.code)}
                  alt=""
                  aria-hidden="true"
                />
                {sel.name}
              </p>
              <p className="sea__year">
                {fillTpl(t("home.sea.year_label"), { year: sel.year })}
                {trendEl ? <> · {trendEl}</> : null}
              </p>

              {medianVal != null && (
                <p className="sea__legend">
                  {fillTpl(t("home.sea.median_label"), { n: signed(medianVal) })}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="sea__source">{t("home.sea.source")}</p>
      </div>
    </section>
  );
}