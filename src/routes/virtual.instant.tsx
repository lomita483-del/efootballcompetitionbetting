import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { VirtualPage } from "@/components/VirtualPageShared";

export const Route = createFileRoute("/virtual/instant")({
  head: () => ({
    meta: [
      { title: "Virtual Gang League — Instant Shootouts | ECB" },
      {
        name: "description",
        content:
          "Gang vs gang instant shootout rounds. Watch the live shootout feed, line-ups, and previous scores — auto-played every round.",
      },
    ],
  }),
  component: () => <VirtualPage />,
  errorComponent: ({ error }) => (
    <Layout>
      <div className="container py-12 text-center text-destructive">{error.message}</div>
    </Layout>
  ),
  notFoundComponent: () => (
    <Layout>
      <div className="container py-12 text-center text-muted-foreground">Not found.</div>
    </Layout>
  ),
});