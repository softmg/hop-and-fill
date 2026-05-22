import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { LanguageProvider } from "@/platform/i18n";
import { initYandexGames, ysdkGetLanguage } from "@/platform/yandexGames";
import "./index.css";

async function bootstrap() {
  await initYandexGames();
  const language = await ysdkGetLanguage();
  document.documentElement.lang = language;

  createRoot(document.getElementById("root")!).render(
    <LanguageProvider language={language}>
      <App />
    </LanguageProvider>,
  );
}

void bootstrap();
