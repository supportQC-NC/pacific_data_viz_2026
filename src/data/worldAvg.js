// src/data/worldAvg.js
// ============================================================
// Moyenne mondiale d'émissions de CO₂ par habitant (t/hab.), par année.
// Source : Global Carbon Budget / EIA — via Our World in Data & Statista.
// Sert de repère MOBILE (la moyenne mondiale évolue dans le temps).
// ============================================================

const WORLD_AVG_BY_YEAR = {
  1960: 3.11, 1961: 3.07, 1962: 3.12, 1963: 3.21, 1964: 3.31,
  1965: 3.39, 1966: 3.48, 1967: 3.52, 1968: 3.64, 1969: 3.80,
  1970: 4.03, 1971: 4.11, 1972: 4.22, 1973: 4.36, 1974: 4.26,
  1975: 4.19, 1976: 4.34, 1977: 4.39, 1978: 4.45, 1979: 4.49,
  1980: 4.39, 1981: 4.20, 1982: 4.10, 1983: 4.05, 1984: 4.11,
  1985: 4.18, 1986: 4.16, 1987: 4.22, 1988: 4.30, 1989: 4.29,
  1990: 4.28, 1991: 4.29, 1992: 4.10, 1993: 4.08, 1994: 4.06,
  1995: 4.10, 1996: 4.16, 1997: 4.13, 1998: 4.06, 1999: 4.10,
  2000: 4.15, 2001: 4.13, 2002: 4.16, 2003: 4.33, 2004: 4.42,
  2005: 4.52, 2006: 4.61, 2007: 4.69, 2008: 4.71, 2009: 4.57,
  2010: 4.77, 2011: 4.88, 2012: 4.89, 2013: 4.87, 2014: 4.83,
  2015: 4.77, 2016: 4.71, 2017: 4.74, 2018: 4.78, 2019: 4.78,
  2020: 4.48, 2021: 4.68, 2022: 4.68, 2023: 4.70, 2024: 4.89,
};

const YEARS = Object.keys(WORLD_AVG_BY_YEAR).map(Number).sort((a, b) => a - b);

// Valeur pour une année donnée ; retombe sur l'année connue la plus proche.
export function worldAvgFor(year) {
  if (year == null) return null;
  if (WORLD_AVG_BY_YEAR[year] != null) return WORLD_AVG_BY_YEAR[year];
  if (year <= YEARS[0]) return WORLD_AVG_BY_YEAR[YEARS[0]];
  if (year >= YEARS[YEARS.length - 1]) return WORLD_AVG_BY_YEAR[YEARS[YEARS.length - 1]];
  let nearest = YEARS[0];
  YEARS.forEach((y) => {
    if (Math.abs(y - year) < Math.abs(nearest - year)) nearest = y;
  });
  return WORLD_AVG_BY_YEAR[nearest];
}

export default WORLD_AVG_BY_YEAR;