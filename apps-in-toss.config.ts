import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "hoo-balloon",

  brand: {
    primaryColor: "#ff6b74",
  },

  permissions: [
    {
      name: "microphone",
      access: "access",
    },
  ],

  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
    withTitle: true,
    transparentBackground: false,
    theme: "light",
  },

  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
    mediaPlaybackRequiresUserAction: true,
  },

  webBundleDir: "dist",
});
