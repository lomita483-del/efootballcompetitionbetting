import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Crosshair as MatchIcon, Dice5, Clover, Gamepad2, ShoppingBag, Trophy, Swords,
  LayoutDashboard, ListChecks, Coins, Wallet, LifeBuoy, Settings as SettingsIcon,
  Shield, Menu as MenuIcon, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Item = { to: string; icon: any; label: string; danger?: boolean };

/**
 * Compact menu trigger shown next to the home banner. It matches the banner
 * height and opens a scrollable dropdown panel of every section on click.
 * A subtle pulse ring makes it easy for new users to spot.
 */
export function HomeQuickMenu() {
  const { user, isAdmin, isMod } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const items: Item[] = [
    { to: "/matches", icon: MatchIcon, label: "Matches" },
    { to: "/virtual", icon: Dice5, label: "Virtual" },
    { to: "/lottery", icon: Clover, label: "Lottery" },
    { to: "/arcade", icon: Gamepad2, label: "Arcade" },
    { to: "/shop", icon: ShoppingBag, label: "Shop" },
    { to: "/leaderboard", icon: Trophy, label: "Leaderboard" },
    { to: "/tournament", icon: Swords, label: "Tournament" },
    ...(user ? [
      { to: "/wagers", icon: Swords, label: "P2P Wagers" },
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/tasks", icon: ListChecks, label: "Tasks" },
      { to: "/checkout", icon: Coins, label: "Buy Tokens" },
      { to: "/withdraw", icon: Wallet, label: "Withdraw" },
      { to: "/support", icon: LifeBuoy, label: "Support" },
      { to: "/settings", icon: SettingsIcon, label: "Settings" },
    ] : []),
    ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin", danger: true }] : []),
    ...(!isAdmin && isMod ? [{ to: "/mod", icon: Shield, label: "Mod", danger: true }] : []),
  ];

  return (
    <div ref={ref} className="relative z-40 shrink-0 self-stretch">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open menu"
        className="group relative h-full min-w-[82px] w-[82px] sm:min-w-[98px] sm:w-[98px] md:min-w-[112px] md:w-[112px] flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-primary/70 bg-[linear-gradient(145deg,rgba(5,14,28,0.98),rgba(14,35,57,0.97))] backdrop-blur-xl text-primary shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.16)] transition-all hover:border-primary/80 hover:shadow-[0_14px_36px_-12px_rgba(212,175,55,0.55)] active:scale-95"
      >
        <span className="pointer-events-none absolute inset-[1px] rounded-[15px] border border-primary/20 bg-[radial-gradient(circle_at_50%_0%,rgba(255,220,120,0.18),transparent_55%)]" />
        {!open && <span className="pointer-events-none absolute -inset-1 rounded-2xl ring-2 ring-primary/35 animate-pulse" />}
        <span className="relative grid place-items-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl border-2 border-primary/75 bg-primary/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_18px_-7px_rgba(212,175,55,0.9)]">
          <MenuIcon className="h-5 w-5 sm:h-5.5 sm:w-5.5 drop-shadow-[0_0_8px_rgba(255,220,120,0.55)]" />
        </span>
        <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em] flex items-center gap-0.5">
          MENU <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 max-h-[60vh] overflow-y-auto rounded-2xl border border-primary/45 bg-[linear-gradient(160deg,rgba(7,18,32,0.98),rgba(10,27,43,0.97))] shadow-[0_24px_70px_-18px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl animate-in fade-in slide-in-from-top-2">
          <div className="sticky top-0 flex items-center gap-1.5 px-3 py-2 border-b border-border/60 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent backdrop-blur">
            <MenuIcon className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] gradient-gold-text">Quick Menu</span>
          </div>
          <nav className="divide-y divide-border/40">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                activeProps={{ className: "active" }}
                className={`group flex items-center gap-2.5 px-3 py-2.5 text-xs font-semibold transition-colors
                  text-muted-foreground hover:text-foreground hover:bg-primary/5
                  [&.active]:text-primary [&.active]:bg-primary/10
                  ${it.danger ? "hover:text-destructive [&.active]:!text-destructive" : ""}`}
              >
                <it.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{it.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
