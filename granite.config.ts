import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "blow-balloon",
  brand: {
    displayName: "후우풍선",
    primaryColor: "#ff6b74",
    icon: "https://static.toss.im/appsintoss/70341/b002c5f9-9027-4808-bb49-9d1c5e2931ea.png",
  },
  web: {
    host: "192.168.219.150",
    port: 5173,
    commands: {
      dev: "vite --host",
      build: "tsc -b && vite build",
    },
  },
  permissions: [
    {
      name: "microphone",
      access: "access",
    },
  ],
  navigationBar: {
    withBackButton: false,
    withHomeButton: false,
    withTitle: false,
    transparentBackground: true,
    theme: "dark",
  },
  webViewProps: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
    mediaPlaybackRequiresUserAction: true,
  },
  outdir: "dist",
});
