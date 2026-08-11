/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLOW_BALLOON_TEST_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
