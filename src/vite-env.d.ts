/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLOW_BALLOON_TEST_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
