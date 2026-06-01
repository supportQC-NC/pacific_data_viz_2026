// src/components/HeroOcean/HeroOcean.jsx
// ============================================================
// Océan WebGL plein écran (fragment shader GLSL, sans dépendance).
// - Vagues FBM + perspective, scintillement solaire, écume, profondeur.
// - LIGNE D'EAU QUI MONTE : pilotée par la donnée (riseTarget) + le scroll.
// - Theme-aware : lit les tokens CSS (--c-bg, --c-accent…) → uniforms.
// - GPU-friendly : DPR plafonné, pause hors-écran / onglet inactif.
// - Accessible : respecte prefers-reduced-motion (mer figée).
// - Robuste StrictMode : le contexte WebGL N'EST PAS détruit au démontage
//   (on libère seulement program/buffers), pour survivre au remontage dev.
// - Fallback CSS animé (jamais l'image statique) si WebGL indisponible.
// Aucun style inline : tout est dans HeroOcean.scss.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "../../store/context/themeContext";
import "./HeroOcean.scss";

/* ----------------------------- Shaders ----------------------------- */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// GLSL ES 1.00 (WebGL1) pour une compatibilité maximale.
const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uTide;     // 0..1 : hauteur de la ligne d'eau
uniform float uReduced;  // 1.0 = mouvement réduit (mer figée)
uniform vec2  uMouse;    // -1..1 parallaxe douce
uniform vec3  uAbyss;    // fond profond  (--c-bg)
uniform vec3  uSky;      // ciel / brume  (--c-bg-2)
uniform vec3  uSea;      // mer de base   (dérivée de --c-accent-deep)
uniform vec3  uAccent;   // cyan d'accent (--c-accent)

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.02;
    amp *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;        // 0..1, y vers le haut
  float aspect = uRes.x / uRes.y;
  float tm = uTime * (1.0 - uReduced);

  // Ligne d'eau : monte avec uTide. Légère ondulation + parallaxe.
  float horizon = mix(0.30, 0.52, clamp(uTide, 0.0, 1.0));
  horizon += uMouse.y * 0.015;
  horizon += sin(uv.x * 3.0 + tm * 0.25) * 0.004;

  vec3 col;

  if (uv.y > horizon) {
    // ---- CIEL / ABYSSE ----
    float t = (uv.y - horizon) / max(1.0 - horizon, 0.001);
    col = mix(uSky, uAbyss, pow(t, 1.15));
    vec2 sun = vec2(0.62 + uMouse.x * 0.03, horizon + 0.05);
    float d = distance(vec2(uv.x * aspect, uv.y), vec2(sun.x * aspect, sun.y));
    col += mix(uAccent, vec3(1.0), 0.6) * exp(-d * 6.5) * 0.45;
    col += uAccent * exp(-d * 2.3) * 0.05;
    col += hash(floor(uv * uRes * 0.5)) * t * 0.012;
  } else {
    // ---- MER ----
    float depth = (horizon - uv.y) / max(horizon, 0.001);   // 0 surface → 1 fond
    float persp = 1.0 / (depth * depth * 7.0 + 0.06);
    vec2 sp = vec2(uv.x * aspect * persp * 0.55,
                   uv.y * persp * 1.9 - tm * 0.14);
    float w1 = fbm(sp + vec2(0.0, tm * 0.05));
    float w2 = fbm(sp * 2.3 - vec2(tm * 0.08, 0.0));
    float waves = w1 * 0.65 + w2 * 0.35;

    col = mix(mix(uSea, uAccent, 0.10), uAbyss, depth * 0.92);
    col += (waves - 0.5) * vec3(0.10, 0.16, 0.18) * (1.0 - depth * 0.6);

    float glint = smoothstep(0.58, 0.95, waves)
                * exp(-abs(uv.x - 0.62) * 3.0)
                * (1.0 - depth);
    col += mix(uAccent, vec3(1.0), 0.5) * glint * 0.7;

    float foam = smoothstep(0.0, 0.035, depth) * (1.0 - smoothstep(0.035, 0.10, depth));
    col += uAccent * foam * 0.28 * (0.6 + 0.4 * sin(uv.x * 42.0 + tm * 2.0));

    col = mix(col, uSky, (1.0 - smoothstep(0.0, 0.16, depth)) * 0.35);
  }

  float vig = smoothstep(1.25, 0.2, distance(uv, vec2(0.5)));
  col *= mix(0.82, 1.0, vig);
  col += (hash(uv * uRes + tm) - 0.5) * 0.014;

  gl_FragColor = vec4(col, 1.0);
}
`;

/* --------------------------- Utilitaires --------------------------- */

function cssColorToRGB(str, fallback) {
  if (!str) return fallback;
  const s = str.trim();
  if (s[0] === "#") {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const n = parseInt(hex, 16);
    if (Number.isNaN(n)) return fallback;
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(",").map((v) => parseFloat(v));
    return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255];
  }
  return fallback;
}

function mix3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function readPalette() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fb) => cssColorToRGB(cs.getPropertyValue(name), fb);
  const abyss = get("--c-bg", [0.008, 0.035, 0.07]);
  const sky = get("--c-bg-2", [0.02, 0.08, 0.13]);
  const accentDeep = get("--c-accent-deep", [0.0, 0.56, 0.78]);
  const accent = get("--c-accent", [0.0, 0.9, 1.0]);
  const sea = mix3(accentDeep, abyss, 0.55);
  return { abyss, sky, sea, accent };
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("HeroOcean shader error:", gl.getShaderInfoLog(sh));
    }
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/* ---------------------------- Composant ---------------------------- */

export default function HeroOcean({ riseTarget = 0.5 }) {
  const { theme } = useTheme();
  const canvasRef = useRef(null);
  const [unsupported, setUnsupported] = useState(false);

  const tideTargetRef = useRef(riseTarget);
  const paletteRef = useRef(null);
  const mouseRef = useRef([0, 0]);

  useEffect(() => {
    const base = Math.max(0, Math.min(1, riseTarget));
    const onScroll = () => {
      const h = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, window.scrollY / h));
      tideTargetRef.current = Math.min(0.98, base + p * 0.28);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [riseTarget]);

  useEffect(() => {
    paletteRef.current = readPalette();
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl =
      canvas.getContext("webgl", { antialias: true, alpha: false }) ||
      canvas.getContext("experimental-webgl", { antialias: true, alpha: false });
    if (!gl) {
      setUnsupported(true);
      return undefined;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      setUnsupported(true);
      return undefined;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setUnsupported(true);
      return undefined;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      tide: gl.getUniformLocation(prog, "uTide"),
      reduced: gl.getUniformLocation(prog, "uReduced"),
      mouse: gl.getUniformLocation(prog, "uMouse"),
      abyss: gl.getUniformLocation(prog, "uAbyss"),
      sky: gl.getUniformLocation(prog, "uSky"),
      sea: gl.getUniformLocation(prog, "uSea"),
      accent: gl.getUniformLocation(prog, "uAccent"),
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!paletteRef.current) paletteRef.current = readPalette();

    const DPR_CAP = 1.75;
    let raf = 0;
    let running = true;
    let visible = true;
    let tide = tideTargetRef.current;
    const start = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function frame(now) {
      raf = 0;
      if (!running || !visible) return;
      resize();
      const p = paletteRef.current;
      tide += (tideTargetRef.current - tide) * 0.06;
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, (now - start) / 1000);
      gl.uniform1f(U.tide, tide);
      gl.uniform1f(U.reduced, reduced ? 1 : 0);
      gl.uniform2f(U.mouse, mouseRef.current[0], mouseRef.current[1]);
      gl.uniform3fv(U.abyss, p.abyss);
      gl.uniform3fv(U.sky, p.sky);
      gl.uniform3fv(U.sea, p.sea);
      gl.uniform3fv(U.accent, p.accent);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) raf = requestAnimationFrame(frame);
    }

    function kick() {
      if (!raf && running && visible) raf = requestAnimationFrame(frame);
    }

    function onMouse(e) {
      mouseRef.current = [
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      ];
    }

    function onVisibility() {
      running = document.visibilityState !== "hidden";
      kick();
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        kick();
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    function onLost(e) {
      e.preventDefault();
      running = false;
      if (raf) cancelAnimationFrame(raf);
    }

    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);

    window.addEventListener("mousemove", onMouse, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onLost, false);

    resize();
    requestAnimationFrame(frame); // première frame immédiate
    kick();

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      // On libère program/buffers MAIS PAS le contexte : ainsi le remontage
      // StrictMode (dev) réutilise le même contexte sans casser le rendu.
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  if (unsupported) {
    return <div className="hero-ocean hero-ocean--fallback" aria-hidden="true" />;
  }

  return (
    <canvas
      ref={canvasRef}
      className="hero-ocean"
      aria-hidden="true"
      role="presentation"
    />
  );
}