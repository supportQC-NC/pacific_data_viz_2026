// src/setupProxy.js
// ============================================================
// Proxy de developpement (utilise automatiquement par `npm start` / CRA).
//
// 1) /pdh        -> API Pacific Data Hub (source "SPC2"), qui refuse (403) les
//                   appels directs depuis localhost.
// 2) /wbdata360  -> API World Bank Data360 (OWID_CB), qui n'envoie pas
//                   d'en-tetes CORS -> l'appel direct depuis le navigateur
//                   echoue. On relaie cote serveur pour avoir les VRAIES
//                   donnees (aucune donnee mondiale inventee cote app).
//
// `data360Api.js` appelle le chemin relatif `/wbdata360/data360/data?...`.
//
// Note : ces proxys ne s'appliquent qu'en developpement (`npm start`). En
// production, configure le meme reverse-proxy cote serveur (Nginx, etc.).
//
// Requiert http-proxy-middleware (inclus avec react-scripts ; sinon :
//   npm i -D http-proxy-middleware
// ).
// ============================================================

const { createProxyMiddleware } = require("http-proxy-middleware");

const PDH_TARGET =
  process.env.REACT_APP_PDH_PROXY_TARGET ||
  "https://stats-sdmx-disseminate.pacificdata.org";

const DATA360_TARGET =
  process.env.REACT_APP_DATA360_PROXY_TARGET ||
  "https://data360api.worldbank.org";

module.exports = function setupProxy(app) {
  // eslint-disable-next-line no-console
  console.log("[proxy /pdh] actif -> " + PDH_TARGET);
  app.use(
    "/pdh",
    createProxyMiddleware({
      target: PDH_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/pdh": "" },
      onProxyReq(proxyReq) {
        proxyReq.setHeader("Origin", "https://stats.pacificdata.org");
        proxyReq.setHeader("Referer", "https://stats.pacificdata.org/");
        proxyReq.setHeader("Accept", "text/csv");
      },
      onError(err, req, res) {
        // eslint-disable-next-line no-console
        console.error("[proxy /pdh] erreur:", err && err.message);
        if (res && !res.headersSent) res.writeHead(502);
        if (res) res.end("Proxy PDH indisponible");
      },
    }),
  );

  // eslint-disable-next-line no-console
  console.log("[proxy /wbdata360] actif -> " + DATA360_TARGET);
  app.use(
    "/wbdata360",
    createProxyMiddleware({
      target: DATA360_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/wbdata360": "" },
      onProxyReq(proxyReq) {
        proxyReq.setHeader("Accept", "application/json");
      },
      onError(err, req, res) {
        // eslint-disable-next-line no-console
        console.error("[proxy /wbdata360] erreur:", err && err.message);
        if (res && !res.headersSent) res.writeHead(502);
        if (res) res.end("Proxy Data360 indisponible");
      },
    }),
  );
};