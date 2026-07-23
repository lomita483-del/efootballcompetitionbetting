import { Link, useNavigate } from "@tanstack/react-router";
import {
  LogOut,
  User as UserIcon,
  Shield,
  MessageSquare,
  Home,
  Trophy,
  Ticket,
  LifeBuoy,
  Wallet,
  Crosshair as MatchIcon,
  Settings as SettingsIcon,
  Coins,
  LayoutDashboard,
  Dice5,
  Swords,
  Clover,
  ListChecks,
  Gamepad2,
  ShoppingBag,
} from "lucide-react";
import { GangLogo } from "@/components/GangLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, ROLE_COLORS, ROLE_LABELS } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { LevelUpModal } from "@/components/Spotlight";
import { GlobalWinAnimation } from "@/components/GlobalWinAnimation";
import { GlobalLossAnimation } from "@/components/GlobalLossAnimation";
import { WagerMilestone } from "@/components/WagerMilestone";
import { BetSuccessPopout } from "@/components/BetSuccessPopout";
import { SurveyPopout } from "@/components/SurveyPopout";
import { PollPopout } from "@/components/PollPopout";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "@tanstack/react-router";
import lslPlatformBg from "@/assets/ecb-nebula-bg.jpg.asset.json";
import { useBranding } from "@/lib/branding";

// Site-wide background ticker so virtual rounds keep advancing even when
// no one is on /virtual. Any authenticated client pings every 15s.
function useVirtualHeartbeat() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const ping = () => {
      supabase.rpc("virtual_tick").then(
        () => {},
        () => {},
      );
    };
    ping();
    const t = setInterval(() => {
      if (alive) ping();
    }, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [user]);
}

// Admin "Broadcast reload" — every active browser refreshes when force_reload_at bumps.
function useForceReloadBroadcast() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "lsl-last-force-reload";
    let seen = localStorage.getItem(KEY) ?? "";
    supabase
      .from("app_settings")
      .select("force_reload_at")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as any)?.force_reload_at as string | null;
        if (v && !seen) {
          localStorage.setItem(KEY, v);
          seen = v;
        }
      });
    const ch = supabase
      .channel("force-reload")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, (p: any) => {
        const v = p.new?.force_reload_at as string | null;
        if (v && v !== seen) {
          localStorage.setItem(KEY, v);
          window.location.reload();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);
}

export const Layout = ({ children }: { children: ReactNode }) => {
  const { user, profile, roles, isAdmin, isMod, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  useVirtualHeartbeat();
  useForceReloadBroadcast();
  const [railOpen, setRailOpen] = useState(false);
  const branding = useBranding();
  // Admin-configurable site-wide background + branding (fall back to bundled art).
  const [siteBg, setSiteBg] = useState<string | null>(null);
  const [bgFit, setBgFit] = useState<string>("cover");
  const [bgPos, setBgPos] = useState<string>("center");
  const [siteName, setSiteName] = useState<string | null>(null);
  const [navBg, setNavBg] = useState<string | null>(null);
  const [navBgFit, setNavBgFit] = useState<string>("cover");
  const [navBgPos, setNavBgPos] = useState<string>("center");
  useEffect(() => {
    const apply = (d: any) => {
      setSiteBg(d?.site_bg_url ?? null);
      setBgFit(d?.site_bg_fit ?? "cover");
      setBgPos(d?.site_bg_position ?? "center");
      setSiteName(d?.site_name ?? null);
      setNavBg(d?.nav_bg_url ?? null);
      setNavBgFit(d?.nav_bg_fit ?? "cover");
      setNavBgPos(d?.nav_bg_position ?? "center");
    };
    supabase
      .from("app_settings")
      .select("site_bg_url,site_bg_fit,site_bg_position,site_name,nav_bg_url,nav_bg_fit,nav_bg_position")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => apply(data));
    const ch = supabase
      .channel("site-bg")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_settings" }, (p: any) => apply(p.new))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img
          src={siteBg || lslPlatformBg.url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: (bgFit as any) || "cover", objectPosition: bgPos || "center" }}
        />
        <div className="absolute inset-0 bg-background/40" />
      </div>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-b from-card/80 to-card/50 border-b border-primary/20 shadow-[0_2px_30px_-12px_rgba(0,0,0,0.6)]">
        {navBg && (
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <img
              src={navBg}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full"
              style={{ objectFit: (navBgFit as any) || "cover", objectPosition: navBgPos || "center" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-background/45 to-background/65" />
          </div>
        )}
        <div className="container mx-auto px-4 flex h-16 items-center gap-3 lg:gap-4 relative">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="h-[38px] w-[38px] object-contain rounded transition-transform group-hover:scale-105 group-hover:rotate-3 duration-300"
              />
            ) : (
              <GangLogo
                size={38}
                className="transition-transform group-hover:scale-105 group-hover:rotate-3 duration-300"
              />
            )}
            <div className="leading-tight">
              {branding.name && branding.name !== "ECB" ? (
                <>
                  <div className="text-sm font-extrabold tracking-[0.18em] gradient-gold-text uppercase max-w-[160px] truncate">
                    {branding.name}
                  </div>
                  {branding.tagline && (
                    <div className="text-[9px] text-muted-foreground tracking-[0.25em] uppercase max-w-[160px] truncate">
                      {branding.tagline}
                    </div>
                  )}
                </>
              ) : siteName ? (
                <div className="text-sm font-extrabold tracking-[0.18em] gradient-gold-text uppercase max-w-[160px] truncate">
                  {siteName}
                </div>
              ) : (
                <>
                  <div className="text-sm font-extrabold tracking-[0.25em] gradient-gold-text">EFOOTBALL</div>
                  <div className="text-[9px] text-muted-foreground tracking-[0.35em]">COMPETITION BETTING</div>
                </>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0 ml-auto sticky right-0 bg-gradient-to-l from-card/95 via-card/80 to-transparent pl-3">
            {branding.logoCornerUrl && (
              <img
                src={branding.logoCornerUrl}
                alt={branding.name}
                className="h-8 w-8 rounded-full object-cover border border-primary/30 shadow-gold hidden sm:block"
                title={`${branding.name} — corner logo`}
              />
            )}
            <Link to="/shop" title="Rewards Shop" aria-label="Rewards Shop">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 shadow-[0_0_12px_-4px_rgba(212,175,55,0.6)]"
              >
                <ShoppingBag className="h-5 w-5 text-primary" />
              </Button>
            </Link>
            {user && profile ? (
              <>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-primary/50 bg-gradient-to-r from-primary/20 to-accent/10 shadow-[0_0_18px_-4px_rgba(212,175,55,0.7)]">
                  <Coins className="h-4 w-4 text-primary" />
                  <span className="text-sm font-black text-primary leading-none tabular-nums">
                    {profile.token_balance.toLocaleString()}
                  </span>
                </div>
                <NotificationBell />
                <Link to="/profile">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-2 rounded-full border border-primary/40 bg-primary/10 hover:bg-primary/20 shadow-[0_0_12px_-4px_rgba(212,175,55,0.5)]"
                  >
                    <span className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-background">
                      <UserIcon className="h-4 w-4" />
                    </span>
                    <span className="hidden xl:inline text-xs font-semibold max-w-[100px] truncate">
                      {profile.full_name}
                    </span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-[0_0_12px_-4px_rgba(239,68,68,0.5)]"
                  onClick={async () => {
                    await signOut();
                    nav({ to: "/" });
                  }}
                  title="Sign out"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" className="btn-luxury">
                    Join League
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
        {!isHome && (
          <div className="border-t border-primary/15 bg-background/20">
            <div className="container mx-auto px-4 relative">
              <nav className="flex items-center gap-1 flex-nowrap overflow-x-auto no-scrollbar py-2">
                <NavLink to="/" icon={Home} label="Home" />
                <NavLink to="/matches" icon={MatchIcon} label="Matches" />
                <NavLink to="/virtual" icon={Dice5} label="Virtual" />
                <NavLink to="/lottery" icon={Clover} label="Lottery" />
                <NavLink to="/arcade" icon={Gamepad2} label="Arcade" />
                <NavLink to="/shop" icon={ShoppingBag} label="Shop" />
                <NavLink to="/leaderboard" icon={Trophy} label="Leaderboard" />
                <NavLink to="/tournament" icon={Swords} label="Tournament" />
                {user && <NavLink to="/wagers" icon={Swords} label="Wagers" />}
                {user && <NavLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />}
                {user && <NavLink to="/tasks" icon={ListChecks} label="Tasks" />}
                {user && <NavLink to="/checkout" icon={Coins} label="Buy" />}
                {user && <NavLink to="/withdraw" icon={Wallet} label="Withdraw" />}
                {user && <NavLink to="/support" icon={LifeBuoy} label="Support" />}
                {user && <NavLink to="/settings" icon={SettingsIcon} label="Settings" />}
                {isAdmin && <NavLink to="/admin" icon={Shield} label="Admin" danger />}
                {!isAdmin && isMod && <NavLink to="/mod" icon={Shield} label="Mod" danger />}
              </nav>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 top-0 w-10 bg-gradient-to-l from-background/70 to-transparent"
              />
            </div>
          </div>
        )}
        {user && roles.length > 0 && (
          <div className="container mx-auto px-4 pb-2 flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r} variant="outline" className={ROLE_COLORS[r]}>
                {ROLE_LABELS[r]}
              </Badge>
            ))}
          </div>
        )}
      </header>
      <main className="relative overflow-x-hidden">{children}</main>
      <LevelUpModal />
      <GlobalWinAnimation />
      <GlobalLossAnimation />
      <WagerMilestone />
      <BetSuccessPopout />
      <SurveyPopout />
      <PollPopout />
      <PushPermissionPrompt />
      <SiteFooter isHome={isHome} />
    </div>
  );
};

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function SiteFooter({ isHome = false }: { isHome?: boolean }) {
  const [s, setS] = useState<any>(null);
  const [open, setOpen] = useState<"terms" | "about" | null>(null);
  useEffect(() => {
    supabase
      .from("app_settings")
      .select("site_name,about_us,why_trust_us,terms_content,contact_email,contact_phone,contact_whatsapp")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setS(data));
  }, []);
  return (
    <footer className="border-t border-border mt-20 backdrop-blur-xl bg-card/40">
      <div className="container mx-auto px-4 py-10 grid md:grid-cols-3 gap-6 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GangLogo size={28} withGlow={false} />
            <span className="font-bold tracking-widest gradient-gold-text uppercase">
              {s?.site_name || "E-FOOTBALL COMPETITION BET"}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">Virtual token-only platform · No real money gambling.</p>
        </div>
        <div>
          <div className="font-bold mb-2">About</div>
          <p className="text-muted-foreground text-xs line-clamp-3">
            {s?.about_us ?? "The premier virtual shooting circuit."}
          </p>
          <div className="flex gap-3 mt-2 text-xs">
            <button className="text-primary hover:underline" onClick={() => setOpen("about")}>
              Read about the league
            </button>
            <button className="text-primary hover:underline" onClick={() => setOpen("terms")}>
              Terms & Conditions
            </button>
            <Link to="/faq" className="text-primary hover:underline">
              Help & FAQ
            </Link>
          </div>
        </div>
        <div>
          <div className="font-bold mb-2">Contact</div>
          <ul className="text-muted-foreground text-xs space-y-1">
            {s?.contact_email && (
              <li>
                Email:{" "}
                <a href={`mailto:${s.contact_email}`} className="text-primary">
                  {s.contact_email}
                </a>
              </li>
            )}
            {s?.contact_phone && <li>Phone: {s.contact_phone}</li>}
            {s?.contact_whatsapp && <li>WhatsApp: {s.contact_whatsapp}</li>}
          </ul>
        </div>
      </div>
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open === "terms" ? "Terms & Conditions" : "About Us"}</DialogTitle>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap text-muted-foreground">
            {open === "terms" ? (s?.terms_content ?? "Terms not set.") : (s?.about_us ?? "About not set.")}
            {open === "about" && s?.why_trust_us && (
              <>
                <div className="font-bold mt-4 text-foreground">Why trust us</div>
                {s.why_trust_us}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </footer>
  );
}

function MobLink({
  to,
  icon: Icon,
  label,
  badge,
  danger,
}: {
  to: string;
  icon: any;
  label: string;
  badge?: number;
  danger?: boolean;
}) {
  return (
    <Link
      to={to}
      activeProps={{ className: "active" }}
      className={`group relative flex flex-col items-center justify-center gap-1.5 px-0 py-1 rounded-xl text-[10px] font-semibold tracking-wide transition-all duration-300 active:scale-95
        ${danger ? "text-destructive/85 hover:text-destructive [&.active]:text-destructive" : "text-foreground/55 hover:text-primary [&.active]:text-primary"}`}
      title={label}
    >
      {/* left rail active indicator — thin gold line */}
      <span className="pointer-events-none absolute -left-1.5 inset-y-3 w-[2px] rounded-full bg-gradient-to-b from-transparent via-primary to-transparent opacity-0 group-[.active]:opacity-100 transition-opacity duration-500 shadow-[0_0_8px_hsl(var(--primary))]" />
      <span
        className="relative grid place-items-center h-[50px] w-[50px] rounded-[14px] transition-all duration-300
          border border-white/[0.06] group-hover:border-primary/40 group-[.active]:border-primary/70
          bg-[linear-gradient(155deg,rgba(30,26,22,0.9)_0%,rgba(14,12,10,0.95)_50%,rgba(8,7,6,1)_100%)]
          shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.6),0_2px_10px_-2px_rgba(0,0,0,0.8)]
          group-hover:shadow-[inset_0_1px_0_rgba(212,175,55,0.25),inset_0_-1px_0_rgba(0,0,0,0.6),0_4px_18px_-4px_rgba(212,175,55,0.35)]
          group-[.active]:shadow-[inset_0_1px_0_rgba(212,175,55,0.4),inset_0_-1px_0_rgba(0,0,0,0.6),0_6px_22px_-4px_rgba(212,175,55,0.55)]"
      >
        {/* engraved bevel */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[1px] rounded-[13px] opacity-60"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.35) 100%)",
          }}
        />
        {/* top gloss highlight */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-2 top-[2px] h-[10px] rounded-full opacity-60"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(255,255,255,0.18), transparent 70%)" }}
        />
        {/* gold ring on hover/active */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 group-[.active]:opacity-100 transition-opacity duration-500"
          style={{
            background:
              "radial-gradient(85% 70% at 50% 50%, transparent 55%, rgba(212,175,55,0.12) 78%, transparent 100%)",
          }}
        />
        <Icon
          className="relative h-[22px] w-[22px] transition-all duration-300 group-hover:scale-110 group-[.active]:scale-110"
          strokeWidth={1.6}
        />
        {badge && badge > 0 ? (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-gradient-to-b from-destructive to-destructive/70 text-destructive-foreground text-[9px] font-black grid place-items-center ring-2 ring-background shadow-[0_2px_8px_rgba(220,38,38,0.5)] animate-pulse">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="leading-none text-[8.5px] truncate max-w-[56px] uppercase tracking-[0.18em] font-bold text-foreground/60 group-hover:text-foreground/90 group-[.active]:text-primary transition-colors">
        {label}
      </span>
    </Link>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  badge,
  danger,
}: {
  to: string;
  icon: any;
  label: string;
  badge?: number; 
  danger?: boolean;
}) {
  return (
    <Link
      to={to}
      activeProps={{ className: "active" }}
      className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold tracking-wide transition-all border
        text-foreground/80 border-primary/20 bg-primary/[0.06] hover:text-foreground hover:bg-primary/15 hover:border-primary/40
        [&.active]:text-primary [&.active]:bg-gradient-to-b [&.active]:from-primary/25 [&.active]:to-primary/10 [&.active]:border-primary/60 [&.active]:shadow-[0_0_14px_-4px_rgba(212,175,55,0.6)]
        ${danger ? "hover:text-destructive [&.active]:!text-destructive [&.active]:!from-destructive/15 [&.active]:!to-destructive/5" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-black grid place-items-center animate-pulse">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
      <span className="pointer-events-none absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-[.active]:opacity-100 transition-opacity" />
    </Link>
  );
}
