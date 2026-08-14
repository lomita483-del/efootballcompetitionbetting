import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // Fixed 1280-wide design canvas: phones render the desktop layout scaled to fit
      // (no pinch, no side-scroll). A runtime effect swaps this for `width=device-width`
      // on real desktops / "Desktop Site" so those get an even wider layout.
      { name: "viewport", content: "width=1280, viewport-fit=cover" },
      { name: "google-site-verification", content: "VmJKgEfwpQsNav2Nc0ItKNySizECxM7nnKuyxh-A5gM" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "format-detection", content: "telephone=no" },
      { name: "theme-color", content: "#0b0a14" },
      { title: "E-Football Competition Bet — Virtual Token Shooting League" },
      { name: "description", content: "Live matches, gang leaderboards and virtual-token wagering for the E-Football Competition Bet." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "E-Football Competition Bet — Virtual Token Shooting League" },
      { property: "og:description", content: "Live matches, gang leaderboards and virtual-token wagering for the E-Football Competition Bet." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "E-Football Competition Bet" },
      { property: "og:url", content: "https://lslonlinebetting.lovable.app/" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "E-Football Competition Bet — Virtual Token Shooting League" },
      { name: "twitter:description", content: "Live matches, gang leaderboards and virtual-token wagering for the E-Football Competition Bet." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/0gjeUv09k8V6NsmPR2x9nR6Yzuo1/social-images/social-1784049993438-481821.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/0gjeUv09k8V6NsmPR2x9nR6Yzuo1/social-images/social-1784049993438-481821.webp" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon-512.png?v=ecb2", type: "image/png", sizes: "512x512" },
      { rel: "icon", href: "/icon-192.png?v=ecb2", type: "image/png", sizes: "192x192" },
      { rel: "shortcut icon", href: "/favicon.ico?v=ecb2" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=ecb2", sizes: "180x180" },
    ],
    scripts: [
      {
        children: `(function(){try{var t=localStorage.getItem('ecb-theme');if(t!=='light'&&t!=='dark')t='dark';var r=document.documentElement;r.classList.toggle('light',t==='light');r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;}catch(e){}})();`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://lslonlinebetting.lovable.app/#organization",
              name: "E-Football Competition Bet",
              alternateName: "ECB",
              url: "https://lslonlinebetting.lovable.app/",
              logo: "https://lslonlinebetting.lovable.app/icon.svg",
            },
            {
              "@type": "WebSite",
              "@id": "https://lslonlinebetting.lovable.app/#website",
              url: "https://lslonlinebetting.lovable.app/",
              name: "E-Football Competition Bet",
              description: "Live virtual shooting matches, gang leaderboards, and token-only wagering.",
              publisher: { "@id": "https://lslonlinebetting.lovable.app/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { AuthProvider } from "@/contexts/AuthContext";
import { BetSlipProvider } from "@/contexts/BetSlipContext";
import { Toaster } from "@/components/ui/sonner";

import { MaintenanceGate } from "@/components/MaintenanceGate";
import { BanGate } from "@/components/BanGate";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { PopupAd } from "@/components/PopupAd";
import { CookieConsent } from "@/components/CookieConsent";
import { BetSlipFab } from "@/components/BetSlip";
import { RouteProgress } from "@/components/RouteProgress";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { useBranding } from "@/lib/branding";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useRouterState } from "@tanstack/react-router";

const PUBLIC_ROUTE_PREFIXES = [
  "/login", "/register", "/forgot-password", "/reset-password",
  "/about", "/faq", "/guides", "/mcp-docs", "/api/", "/sitemap.xml",
];

function AuthGate() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Admin-controlled: when require_login is off the site is public to visitors.
  const [requireLogin, setRequireLogin] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase
      .from("app_settings")
      .select("require_login")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }: any) => { if (alive) setRequireLogin((data as any)?.require_login ?? true); });
    const ch = supabase
      .channel("site-access")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, (p: any) => {
        setRequireLogin(p.new?.require_login ?? true);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);
  useEffect(() => {
    if (loading || session || requireLogin === null || requireLogin === false) return;
    const isPublic = PUBLIC_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
    if (!isPublic) navigate({ to: "/login", search: { redirect: pathname } as any, replace: true });
  }, [session, loading, pathname, navigate, requireLogin]);
  return null;
}

function AdaptiveViewport() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) return;
    const canvas = "width=1280, viewport-fit=cover";
    const wide = "width=device-width, initial-scale=1, viewport-fit=cover";
    const apply = () => {
      if (isAdmin) {
        // Lock the admin console to the 1280 canvas, pre-scaled so the whole
        // width fits the screen, and freeze the scale so pinch-zoom is a no-op.
        const sw = window.screen?.width ?? window.innerWidth;
        const sh = window.screen?.height ?? window.innerHeight;
        const avail = Math.min(sw, sh) > 0 ? Math.min(sw, sh) : sw; // portrait width
        const s = Math.min(1, Math.max(0.2, Math.round((avail / 1280) * 1000) / 1000));
        const locked = `width=1280, initial-scale=${s}, minimum-scale=${s}, maximum-scale=${s}, user-scalable=no, viewport-fit=cover`;
        if (meta.getAttribute("content") !== locked) meta.setAttribute("content", locked);
        return;
      }
      const w = window.screen?.width ?? window.innerWidth;
      const target = w >= 1400 ? wide : canvas;
      if (meta.getAttribute("content") !== target) meta.setAttribute("content", target);
    };
    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, [isAdmin]);

  // Block pinch-zoom gestures on the admin console (iOS Safari ignores user-scalable=no)
  useEffect(() => {
    if (typeof window === "undefined" || !isAdmin) return;
    const stop = (e: Event) => e.preventDefault();
    const onTouch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    const onDblClick = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop as EventListener, { passive: false });
    document.addEventListener("gesturechange", stop as EventListener, { passive: false });
    document.addEventListener("gestureend", stop as EventListener, { passive: false });
    document.addEventListener("touchmove", onTouch, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("dblclick", onDblClick, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", stop as EventListener);
      document.removeEventListener("gesturechange", stop as EventListener);
      document.removeEventListener("gestureend", stop as EventListener);
      document.removeEventListener("touchmove", onTouch);
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("dblclick", onDblClick);
    };
  }, [isAdmin]);
  return null;
}

function AnalyticsTracker() {
  const router = useRouter();
  useEffect(() => {
    trackPageView();
    const unsub = router.subscribe("onResolved", () => trackPageView());
    return () => { unsub(); };
  }, [router]);
  return null;
}

function BrandingSync() {
  const b = useBranding();
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (b.name && b.tagline) {
      const t = `${b.tagline} — ${b.name}`;
      if (document.title !== t) document.title = t;
    }
    const setMeta = (sel: string, attr: string, val: string) => {
      const el = document.head.querySelector(sel) as HTMLMetaElement | null;
      if (el) el.setAttribute(attr, val);
    };
    if (b.description) {
      setMeta('meta[name="description"]', "content", b.description);
      setMeta('meta[property="og:description"]', "content", b.description);
      setMeta('meta[name="twitter:description"]', "content", b.description);
    }
    if (b.tagline) {
      setMeta('meta[property="og:title"]', "content", b.tagline);
      setMeta('meta[name="twitter:title"]', "content", b.tagline);
      setMeta('meta[property="og:site_name"]', "content", b.tagline);
    }
    if (b.ogImageUrl) {
      setMeta('meta[property="og:image"]', "content", b.ogImageUrl);
      setMeta('meta[name="twitter:image"]', "content", b.ogImageUrl);
    }
  }, [b.name, b.tagline, b.description, b.ogImageUrl]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BetSlipProvider>
          <ConfirmProvider>
            <BrandingSync />
            <AnalyticsTracker />
            <AuthGate />
            <AdaptiveViewport />
            <MaintenanceGate>
              <Outlet />
            </MaintenanceGate>
            <BanGate />
            <PopupAd />
            <BetSlipFab />
            <RouteProgress />
            <CookieConsent />
            <PushPermissionPrompt />
            <PWAInstallPrompt />
            <Toaster />
          </ConfirmProvider>
        </BetSlipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
