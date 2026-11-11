import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// الصفحات التي يقدّمها السيرفر كتطبيق React واحد (نفس روابط الموقع القديمة).
const PAGES = new Set(["/login", "/login.html", "/dashboard.html", "/index.html"]);

export default defineConfig({
  root: "client",
  plugins: [
    react(),
    {
      // في وضع التطوير: وجّه روابط الصفحات إلى index.html الخاص بـ React.
      name: "page-routes",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const [p, q] = (req.url || "").split("?");
          if (PAGES.has(p)) req.url = "/index.html" + (q ? "?" + q : "");
          next();
        });
      },
    },
  ],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3000", "/healthz": "http://localhost:3000" },
  },
});
