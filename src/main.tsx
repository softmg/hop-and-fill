import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { LanguageProvider } from "@/platform/i18n";
import { initYandexGames, ysdkGetLanguage, type GameLanguage } from "@/platform/yandexGames";
import "./index.css";

/**
 * Starts the React app with portal language when available and a render-safe fallback otherwise.
 */
async function bootstrap() {
  let language: GameLanguage = "en";

  try {
    await initYandexGames();
    language = await ysdkGetLanguage();
  } catch (error) {
    console.error("[bootstrap] Yandex initialization failed, rendering with fallback language.", error);
  }

  document.documentElement.lang = language;

  createRoot(document.getElementById("root")!).render(
    <LanguageProvider language={language}>
      <App />
    </LanguageProvider>,
  );
}

void bootstrap();
