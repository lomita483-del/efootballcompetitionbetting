import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      closeButton
      expand
      duration={5000}
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto w-full gap-3 rounded-2xl border border-primary/30 bg-card/95 px-4 py-3.5 text-foreground shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl",
          title: "text-sm font-bold tracking-wide",
          description: "text-xs leading-relaxed text-muted-foreground break-words",
          icon: "shrink-0",
          closeButton:
            "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground",
          actionButton: "rounded-lg bg-primary px-3 text-primary-foreground font-semibold",
          cancelButton: "rounded-lg bg-muted px-3 text-muted-foreground",
          error:
            "border-destructive/50 bg-gradient-to-br from-destructive/20 via-card/95 to-card/95 text-foreground",
          success:
            "border-emerald-400/40 bg-gradient-to-br from-emerald-500/15 via-card/95 to-card/95",
          warning: "border-amber-400/50 bg-gradient-to-br from-amber-400/15 via-card/95 to-card/95",
          info: "border-primary/40 bg-gradient-to-br from-primary/10 via-card/95 to-card/95",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
