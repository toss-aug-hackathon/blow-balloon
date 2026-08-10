import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'blow-balloon',
  brand: {
    primaryColor: '#ff6b74',
  },
  permissions: [
    {
      name: 'microphone',
      access: 'access',
    },
  ],
  navigationBar: {
    withBackButton: false,
    withHomeButton: false,
    withTitle: false,
    transparentBackground: true,
    theme: 'dark',
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    mediaPlaybackRequiresUserAction: true,
  },
  webBundleDir: 'dist',
});
