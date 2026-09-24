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
    // The native Android build uses Nitro's static preset to generate the
    // shell directly into .output/public. Do not enable Start's separate
    // SPA prerender here; the Lovable/Nitro preview bridge expects a
    // different server layout and was causing dist/server/server.js errors.
  },
});
