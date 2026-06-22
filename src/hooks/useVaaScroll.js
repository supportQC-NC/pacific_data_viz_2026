// src/hooks/useVaaScroll.js
// ============================================================
// MOTEUR VA'A (innovation A). Mapping DIRECT : la position de scroll de la
// section épinglée détermine immédiatement le territoire courant (pas de
// minuterie qui bouge toute seule → navigation naturelle, collée au scroll).
//   route : limite la traversée aux territoires ayant la donnée du chapitre.
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { setTerritory } from "../store/slices/territorySlice";
import { VAA_ROUTE } from "../data/vaaRoute";

export default function useVaaScroll({ active = true, route } = {}) {
  const dispatch = useDispatch();
  const ref = useRef(null);
  const lastCode = useRef(null);
  const [progress, setProgress] = useState(0);
  const [index, setIndex] = useState(0);

  const path = route && route.length ? route : VAA_ROUTE;
  const pathRef = useRef(path);
  pathRef.current = path;

  const compute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const total = rect.height - vh;
    const p = total <= 0 ? 0 : Math.min(1, Math.max(0, -rect.top / total));
    setProgress(p);
    const n = pathRef.current.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
    setIndex(i);
    const code = pathRef.current[i];
    if (code && code !== lastCode.current) {
      lastCode.current = code;
      dispatch(setTerritory(code));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          compute();
        });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active, compute]);

  const i = Math.min(index, path.length - 1);
  return { ref, progress, index: i, code: path[i] };
}