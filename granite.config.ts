import { defineConfig } from "@apps-in-toss/web-framework/config";
import { networkInterfaces } from "node:os";

const IGNORED_INTERFACE_PREFIXES = [
  "lo",
  "utun",
  "awdl",
  "llw",
  "bridge",
  "docker",
  "vbox",
];

function getLocalDevelopmentHost(): string {
  const candidates = Object.entries(networkInterfaces()).flatMap(
    ([name, addresses]) =>
      (addresses ?? [])
        .filter(
          ({ family, internal }) => family === "IPv4" && !internal,
        )
        .filter(
          () =>
            !IGNORED_INTERFACE_PREFIXES.some((prefix) =>
              name.startsWith(prefix),
            ),
        )
        .map(({ address }) => ({ name, address })),
  );

  candidates.sort((a, b) => {
    const priority = (name: string) => {
      if (name === "en0") return 3;
      if (name === "en1") return 2;
      if (name.startsWith("en") || name.startsWith("eth")) return 1;
      return 0;
    };

    return priority(b.name) - priority(a.name);
  });

  return candidates[0]?.address ?? "127.0.0.1";
}

export default defineConfig({
  appName: "blow-balloon",
  brand: {
    displayName: "후우풍선",
    primaryColor: "#ff6b74",
    icon: "https://static.toss.im/appsintoss/70341/b002c5f9-9027-4808-bb49-9d1c5e2931ea.png",
  },
  web: {
    host: getLocalDevelopmentHost(),
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
