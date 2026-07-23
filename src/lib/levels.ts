export interface Level {
  level: number;
  title: string;
  minXp: number;
}

export const LEVELS: Level[] = [
  { level: 1, title: "Rookie", minXp: 0 },
  { level: 2, title: "Contender", minXp: 250 },
  { level: 3, title: "Challenger", minXp: 750 },
  { level: 4, title: "Veteran", minXp: 1800 },
  { level: 5, title: "Elite", minXp: 4000 },
  { level: 6, title: "Champion", minXp: 8000 },
  { level: 7, title: "Legend", minXp: 15000 },
];

export function getLevelInfo(xp: number) {
  let current = LEVELS[0];
  let next: Level | null = null;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) current = LEVELS[i];
    else { next = LEVELS[i]; break; }
  }
  const progress = next ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100) : 100;
  return { ...current, next, progress, xp };
}
