import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggleCard() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <Card className="p-4 backdrop-blur-xl bg-card/60 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className={`h-9 w-9 rounded-lg grid place-items-center border ${isDark ? "border-primary/40 bg-primary/10 text-primary" : "border-primary/40 bg-primary/10 text-primary"}`}>
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </span>
        <div>
          <div className="font-semibold text-sm">Dark mode</div>
          <div className="text-xs text-muted-foreground">{isDark ? "Dark theme is on" : "Light theme is on"} — applies across the whole app</div>
        </div>
      </div>
      <Switch checked={isDark} onCheckedChange={toggle} aria-label="Toggle dark mode" />
    </Card>
  );
}

export function ThemeToggleInline({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex items-center gap-2 rounded-md border border-primary/40 bg-background/70 px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-primary/10 transition ${className}`}
    >
      {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      {isDark ? "Dark" : "Light"}
    </button>
  );
}