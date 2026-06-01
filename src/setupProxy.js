// src/setupProxy.js
// ============================================================
// Proxy de développement (utilisé automatiquement par `npm start` / CRA).
//
// POURQUOI : le dataflow DF_AGRICULTURAL_PRODUCTION (source "SPC2") est servi
// par un hôte PDH qui VÉRIFIE l'origine de la requête et REFUSE (403) les
// appels directs depuis http://localhost. Les datasets climat, eux, sont sur
// un hôte à CORS ouvert → pas besoin de proxy pour eux.
//
// Ici, le serveur de dev relaie `/pdh/...` vers l'API PDH CÔTÉ SERVEUR
// (donc sans origine "localhost", avec un Referer/Origin légitimes), ce qui
// débloque le 403. `agriApi.js` appelle donc le chemin relatif `/pdh/rest/...`.
//
// Note : ce proxy ne s'applique qu'en développement (`npm start`). En
// production, configure le même reverse-proxy côté serveur (Nginx, etc.)
// ou sers les données via ta propre API.
//
// Requiert http-proxy-middleware (inclus avec react-scripts ; sinon :
//   npm i -D http-proxy-middleware
// ).
// ============================================================

const { createProxyMiddleware } = require("http-proxy-middleware");

// Hôtes PDH possibles pour la source "SPC2". On garde nsi-stable en cible
// principale (celui que documente PDH pour l'accès données).
const PDH_TARGET =
  process.env.REACT_APP_PDH_PROXY_TARGET || "https://stats-sdmx-disseminate.pacificdata.org";

module.exports = function setupProxy(app) {
  // eslint-disable-next-line no-console
  console.log("[proxy /pdh] actif → " + PDH_TARGET);
  app.use(
    "/pdh",
    createProxyMiddleware({
      target: PDH_TARGET,
      changeOrigin: true,
      secure: true,
      pathRewrite: { "^/pdh": "" },
      onProxyReq(proxyReq) {
        // On se présente comme le Data Explorer officiel (l'hôte l'autorise).
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
};