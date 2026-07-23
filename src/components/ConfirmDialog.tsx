import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle } from "lucide-react";

type ConfirmResult = boolean | { confirmed: true; value: string; checked: boolean };
type Opts = { title: string; description?: string; confirmText?: string; cancelText?: string; tone?: "default" | "danger"; inputLabel?: string; inputPlaceholder?: string; inputRequired?: boolean; checkboxLabel?: string };
type Resolver = (v: ConfirmResult) => void;

const Ctx = createContext<(o: Opts) => Promise<ConfirmResult>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Opts | null>(null);
  const [resolver, setResolver] = useState<Resolver | null>(null);
  const [value, setValue] = useState("");
  const [checked, setChecked] = useState(false);

  const confirm = useCallback((o: Opts) => {
    setOpts(o);
    setValue("");
    setChecked(false);
    return new Promise<ConfirmResult>((res) => setResolver(() => res));
  }, []);

  const close = (v: boolean) => { resolver?.(v); setResolver(null); setOpts(null); setValue(""); setChecked(false); };
  const submit = () => {
    if (opts?.inputRequired && !value.trim()) return;
    if (opts?.inputLabel || opts?.checkboxLabel) resolver?.({ confirmed: true, value: value.trim(), checked });
    else resolver?.(true);
    setResolver(null); setOpts(null); setValue(""); setChecked(false);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <DialogContent className="relative border-amber-400/30 max-w-md overflow-hidden bg-gradient-to-b from-black/70 via-background/95 to-black/80 backdrop-blur-2xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.8),0_0_60px_-20px_rgba(212,175,55,0.35)] rounded-2xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
          <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-amber-400/5 blur-3xl" />
          <DialogHeader className="relative">
            <div className={`h-14 w-14 rounded-full grid place-items-center mb-3 border ${opts?.tone === "danger" ? "bg-destructive/10 border-destructive/40 shadow-[0_0_25px_-5px_rgba(239,68,68,0.5)]" : "bg-amber-400/10 border-amber-400/40 shadow-[0_0_25px_-5px_rgba(212,175,55,0.5)]"}`}>
              <AlertTriangle className={`h-7 w-7 ${opts?.tone === "danger" ? "text-destructive" : "text-amber-300"}`} />
            </div>
            <DialogTitle className="text-xl font-display font-bold tracking-wide">{opts?.title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">{opts?.description}</DialogDescription>
          </DialogHeader>
          {(opts?.inputLabel || opts?.checkboxLabel) && (
            <div className="relative space-y-3">
              {opts?.inputLabel && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-amber-300/80 font-bold">{opts.inputLabel}</label>
                  <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={opts.inputPlaceholder} className="mt-1.5 min-h-24 border-amber-400/20 bg-black/30 focus-visible:ring-amber-400/40" />
                  {opts.inputRequired && !value.trim() && <p className="text-[10px] text-destructive mt-1">Required</p>}
                </div>
              )}
              {opts?.checkboxLabel && (
                <label className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-black/20 p-3 text-sm">
                  <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} />
                  {opts.checkboxLabel}
                </label>
              )}
            </div>
          )}
          <DialogFooter className="relative gap-2">
            <Button variant="outline" className="border-white/15" onClick={() => close(false)}>{opts?.cancelText ?? "Cancel"}</Button>
            <Button
              variant={opts?.tone === "danger" ? "destructive" : "default"}
              className={opts?.tone !== "danger" ? "bg-gradient-to-b from-amber-300 to-amber-600 hover:from-amber-200 hover:to-amber-500 text-black font-bold shadow-[0_8px_25px_-6px_rgba(212,175,55,0.6)] border border-amber-200/40" : "shadow-[0_8px_25px_-6px_rgba(239,68,68,0.5)]"}
              onClick={submit}
              disabled={!!opts?.inputRequired && !value.trim()}
            >
              {opts?.confirmText ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
