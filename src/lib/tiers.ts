export type TierMeta = {
  label: string;
  /** tailwind gradient stops */
  color: string;
  /** solid accent colour (hex) used for borders/glow */
  accent: string;
  min: number;
  next?: number;
};

export const TIER_META: Record<string, TierMeta> = {
  bronze:   { label: "Bronze",   color: "from-amber-700 to-amber-900",   accent: "#b45309", min: 0,      next: 500 },
  silver:   { label: "Silver",   color: "from-slate-300 to-slate-500",   accent: "#cbd5e1", min: 500,    next: 3000 },
  gold:     { label: "Gold",     color: "from-amber-400 to-yellow-600",  accent: "#facc15", min: 3000,   next: 10000 },
  platinum: { label: "Platinum", color: "from-cyan-300 to-blue-600",     accent: "#38bdf8", min: 10000,  next: 25000 },
  legend:   { label: "Legend",   color: "from-fuchsia-500 to-pink-600",  accent: "#e879f9", min: 25000,  next: 50000 },
  mythic:   { label: "Mythic",   color: "from-violet-500 to-indigo-700", accent: "#8b5cf6", min: 50000,  next: 100000 },
  titan:    { label: "Titan",    color: "from-emerald-400 to-teal-600",  accent: "#34d399", min: 100000, next: 250000 },
  immortal: { label: "Immortal", color: "from-rose-400 via-amber-300 to-yellow-500", accent: "#fb7185", min: 250000 },
};

export const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "legend", "mythic", "titan", "immortal"];

export function getTierProgress(tierKey: string | null | undefined, xp: number) {
  const key = (tierKey ?? "bronze").toLowerCase();
  const meta = TIER_META[key] ?? TIER_META.bronze;
  const nextKey = TIER_ORDER[TIER_ORDER.indexOf(key) + 1];
  const nextMeta = nextKey ? TIER_META[nextKey] : undefined;
  const span = meta.next ? meta.next - meta.min : 0;
  const gained = Math.max(0, xp - meta.min);
  const percent = meta.next ? Math.min(100, Math.round((gained / span) * 100)) : 100;
  return { key, meta, nextMeta, gained, span, percent, toNext: meta.next ? Math.max(0, meta.next - xp) : 0 };
}
