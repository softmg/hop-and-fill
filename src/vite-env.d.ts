/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string;
  readonly VITE_LEADERBOARD_BACKEND_URL?: string;
  readonly VITE_YANDEX_LEADERBOARD_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
