import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Include the independent LARP website in every casino build, so a Cloudflare
 * project that publishes `dist` serves /larp/ as well as the original casino.
 * The root index.html sends only larp.playblockbet.com to /larp/.
 */
function bundleLarp(): Plugin {
  let root = process.cwd();
  let outDir = resolve(root, "dist");
  return {
    name: "bundle-standalone-larp",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = resolve(root, config.build.outDir);
    },
    writeBundle() {
      const source = resolve(root, "larp-site");
      if (!existsSync(resolve(source, "index.html"))) {
        throw new Error("Missing larp-site/index.html; cannot publish the LARP web app.");
      }
      cpSync(source, resolve(outDir, "larp"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleLarp()],
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/android/**", "**/dist/**"] },
  },
});
