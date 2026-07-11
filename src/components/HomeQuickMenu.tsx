import { Link } from "@tanstack/react-router";
import {
  Crosshair as MatchIcon, Dice5, Clover, Gamepad2, ShoppingBag, Trophy, Swords,
  LayoutDashboard, ListChecks, Coins, Wallet, LifeBuoy, Settings as SettingsIcon,
  Shield, Compass,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Item = { to: string; icon: any; label: string; danger?: boolean };

/**
 * Compact, scrollable menu panel shown at the top-right of the home page,
 * next to the promo banner. Mirrors the left-rail navigation so the home
 * page can drop the rail entirely while keeping quick access to every section.
 */
export function HomeQuickMenu() {
  const { user, isAdmin, isMod } = useAuth();

  const items: Item[] = [
    { to: "/matches", icon: MatchIcon, label: "Matches" },
    { to: "/virtual", icon: Dice5, label: "Virtual" },
    { to: "/lottery", icon: Clover, label: "Lottery" },
    { to: "/arcade", icon: Gamepad2, label: "Arcade" },
    { to: "/shop", icon: ShoppingBag, label: "Shop" },
    { to: "/leaderboard", icon: Trophy, label: "Leaderboard" },
    { to: "/tournament", icon: Swords, label: "Tournament" },
    ...(user ? [
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
    <aside className="glass rounded-2xl border border-primary/25 overflow-hidden flex flex-col w-[124px] sm:w-[150px] md:w-[180px] shrink-0 self-stretch">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <Compass className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] gradient-gold-text">Menu</span>
      </div>
      <nav className="flex-1 overflow-y-auto max-h-32 sm:max-h-40 md:max-h-48 divide-y divide-border/40">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            activeProps={{ className: "active" }}
            className={`group flex items-center gap-2 px-3 py-2 text-[11px] font-semibold transition-colors
              text-muted-foreground hover:text-foreground hover:bg-primary/5
              [&.active]:text-primary [&.active]:bg-primary/10
              ${it.danger ? "hover:text-destructive [&.active]:!text-destructive" : ""}`}
          >
            <it.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{it.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
