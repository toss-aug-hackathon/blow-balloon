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
  "tailscale",
];

function getLocalDevelopmentHost(): string {
  const candidates = Object.entries(networkInterfaces()).flatMap(
    ([name, addresses]) =>
      (addresses ?? [])
        .filter(({ family, internal }) => family === "IPv4" && !internal)
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
      const normalizedName = name.toLowerCase();
      if (normalizedName === "wi-fi" || normalizedName === "wifi") return 4;
      if (normalizedName === "ethernet") return 3;
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
  appName: "hoo-balloon",
  brand: {
    displayName: "후우풍선",
    primaryColor: "#ff6b74",
    icon: "https://static.toss.im/appsintoss/70341/7485fa11-d391-4798-a494-0b8a3167d003.png",
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
    withBackButton: true,
    withHomeButton: false,
    withTitle: true,
    transparentBackground: false,
    theme: "light",
  },
  webViewProps: {
    type: "partner",
    bounces: false,
    pullToRefreshEnabled: false,
    overScrollMode: "never",
    mediaPlaybackRequiresUserAction: true,
  },
  outdir: "dist",
});
