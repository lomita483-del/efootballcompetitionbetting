import { getLevelInfo } from "@/lib/levels";
import { Progress } from "@/components/ui/progress";

export function LevelBadge({ xp }: { xp: number }) {
  const { level, title, next, progress } = getLevelInfo(xp);
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-black text-sm text-primary-foreground shrink-0">
        {level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{title}</div>
        {next ? (
          <>
            <Progress value={progress} className="h-1.5 mt-1" />
            <div className="text-[10px] text-muted-foreground mt-0.5">{xp} XP · {next.minXp - xp} to {next.title}</div>
          </>
        ) : (
          <div className="text-[10px] text-muted-foreground mt-0.5">{xp} XP · Max level</div>
        )}
      </div>
    </div>
  );
}
