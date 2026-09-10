import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function stripYandexSdkPlugin(): Plugin {
  const bootstrapPattern = /\s*<script>\s*window\.__yandexSdkScriptReady[\s\S]*?<\/script>/;
  const sdkPattern = /\s*<script async src="\/sdk\.js"[\s\S]*?<\/script>/;

  return {
    name: "hop-and-fill-strip-yandex-sdk",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        if (!bootstrapPattern.test(html) || !sdkPattern.test(html)) {
          throw new Error("Не удалось удалить загрузчик SDK Яндекс.Игр из web-сборки.");
        }
        return html.replace(bootstrapPattern, "").replace(sdkPattern, "");
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === "yandex" ? "./" : mode === "web" ? "/games/hop-and-fill/" : "/",
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ["unwillingly-rested-whitefish.cloudpub.ru"],
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "web" && stripYandexSdkPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
