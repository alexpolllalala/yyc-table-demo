import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Static demo: no server, no database. Everything runs in the visitor's browser.
export default defineConfig({
  root: path.resolve(import.meta.dirname),
  base: "./",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: true, port: 5180 },
});
