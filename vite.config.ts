// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  plugins: [mcpPlugin()],
  tanstackStart: {
    // The Android release is a true standalone WebView APK. In that build only,
    // emit TanStack Start's static SPA shell so the full client can be shipped
    // inside the APK without depending on the live website for HTML.
    spa: {
      enabled: process.env.CAPACITOR_BUILD === "1",
    },
    // The normal web deployment keeps the custom server entry. The standalone
    // Android SPA build must let TanStack Start use its default server entry so
    // SPA shell prerendering can run correctly during the static build.
    server: process.env.CAPACITOR_BUILD === "1" ? undefined : { entry: "server" },
  },
});
