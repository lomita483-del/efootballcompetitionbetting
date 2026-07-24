import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert, RotateCw, Sliders } from "lucide-react";
import { toast } from "sonner";
import {
  listAdminFlags, updateAdminFlagStatus, listFlagRules, upsertFlagRule, tuneFlagRule, deleteFlagRule, runFlagScanNow,
} from "@/lib/admin-flags.functions";

const STATUS_OPTS = ["all", "new", "reviewing", "dismissed", "actioned"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  match_fixing: "Match-fixing",
  financial_fraud: "Financial fraud",
  account_abuse: "Account abuse",
  custom: "Custom",
};
const SEVERITY_CLS: Record<string, string> = {
  high: "text-destructive border-destructive/40 bg-destructive/10",
  medium: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  low: "text-muted-foreground border-border bg-muted/20",
};

export function SuspiciousActivityPanel() {
  const runList = useServerFn(listAdminFlags);
  const runUpdate = useServerFn(updateAdminFlagStatus);
  const runRules = useServerFn(listFlagRules);
  const runUpsertRule = useServerFn(upsertFlagRule);
  const runTuneRule = useServerFn(tuneFlagRule);
  const runDeleteRule = useServerFn(deleteFlagRule);
  const runScanNow = useServerFn(runFlagScanNow);

  const [flags, setFlags] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_OPTS)[number]>("new");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [newRule, setNewRule] = useState({ rule_key: "", name: "", metric: "withdrawal_count", value: 5, window_minutes: 1440 });

  async function load() {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([runList({ data: { status, category: "all" } }), runRules()]);
      setFlags((f as any).items ?? []);
      setRules((r as any).items ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [status]);

  async function setFlagStatus(id: string, next: string) {
    const res: any = await runUpdate({ data: { id, status: next as any } });
    if (!res.ok) { toast.error(res.error); return; }
    load();
  }

  async function scanNow() {
    setScanning(true);
    try {
      const res: any = await runScanNow();
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Scan complete");
      load();
    } finally { setScanning(false); }
  }

  async function toggleRule(rule: any, enabled: boolean) {
    await runTuneRule({ data: { id: rule.id, enabled } });
    load();
  }
  async function saveRuleThreshold(rule: any, value: number, window_minutes: number) {
    await runTuneRule({ data: { id: rule.id, value, window_minutes } });
    toast.success("Rule updated");
    load();
  }
  async function addCustomRule() {
    if (!newRule.rule_key || !newRule.name) { toast.error("Key and name required"); return; }
    const res: any = await runUpsertRule({
      data: {
        rule_key: newRule.rule_key, name: newRule.name, category: "custom",
        metric: newRule.metric as any, operator: ">=", value: newRule.value, window_minutes: newRule.window_minutes, enabled: true,
      },
    });
    if (!res.ok) { toast.error(res.error); return; }
    toast.success("Custom rule added");
    setNewRule({ rule_key: "", name: "", metric: "withdrawal_count", value: 5, window_minutes: 1440 });
    load();
  }
  async function removeCustomRule(id: string) {
    await runDeleteRule({ data: { id } });
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="glass-strong p-4 flex items-center gap-3 flex-wrap">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <div>
          <div className="font-bold">Suspicious Activity</div>
          <div className="text-xs text-muted-foreground">Auto-flagged betting, financial, and account-abuse patterns. Runs every 10 minutes, or trigger a scan now.</div>
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={scanNow} disabled={scanning}>
          <RotateCw className={`h-3 w-3 mr-1 ${scanning ? "animate-spin" : ""}`} />Scan now
        </Button>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTS.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)} className="capitalize">
            {s}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {!loading && flags.length === 0 && <p className="text-sm text-muted-foreground">No flags in this view.</p>}
        {flags.map((f: any) => (
          <Card key={f.id} className="glass p-3 flex items-start gap-3 flex-wrap">
            <AlertTriangle className="h-4 w-4 text-primary mt-1 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">{f.rule_label}</span>
                <Badge variant="outline" className={`text-[10px] ${SEVERITY_CLS[f.severity] ?? ""}`}>{f.severity}</Badge>
                <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[f.category] ?? f.category}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {f.profiles?.full_name ?? f.user_id ?? "—"} {f.profiles?.email ? `· ${f.profiles.email}` : ""} · {new Date(f.created_at).toLocaleString()}
              </div>
              {f.details && Object.keys(f.details).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(f.details).map(([k, v]) => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/60">
                      <span className="text-muted-foreground">{k}:</span> <span className="font-mono">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Select value={f.status} onValueChange={(v) => setFlagStatus(f.id, v)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["new", "reviewing", "dismissed", "actioned"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Card>
        ))}
      </div>

      <Card className="glass-strong p-4 space-y-3">
        <div className="font-bold flex items-center gap-2"><Sliders className="h-4 w-4 text-primary" />Detection rules</div>
        <div className="space-y-2">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} onToggle={(v) => toggleRule(r, v)} onSave={(val, win) => saveRuleThreshold(r, val, win)} onDelete={!r.is_builtin ? () => removeCustomRule(r.id) : undefined} />
          ))}
        </div>
        <div className="h-px bg-border" />
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Add a custom rule</div>
        <div className="grid sm:grid-cols-5 gap-2">
          <Input placeholder="unique_key" value={newRule.rule_key} onChange={(e) => setNewRule({ ...newRule, rule_key: e.target.value.trim().toLowerCase().replace(/\s+/g, "_") })} />
          <Input placeholder="Display name" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} className="sm:col-span-2" />
          <Select value={newRule.metric} onValueChange={(v) => setNewRule({ ...newRule, metric: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="withdrawal_count">Withdrawal count</SelectItem>
              <SelectItem value="wager_count">Wager count</SelectItem>
              <SelectItem value="token_request_count">Token request count</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1">
            <Input type="number" title="Threshold (>=)" value={newRule.value} onChange={(e) => setNewRule({ ...newRule, value: Number(e.target.value) })} />
            <Input type="number" title="Window (minutes)" value={newRule.window_minutes} onChange={(e) => setNewRule({ ...newRule, window_minutes: Number(e.target.value) })} />
          </div>
        </div>
        <Button size="sm" className="btn-luxury" onClick={addCustomRule}>Add rule</Button>
      </Card>
    </div>
  );
}

function RuleRow({ rule, onToggle, onSave, onDelete }: { rule: any; onToggle: (v: boolean) => void; onSave: (value: number, window_minutes: number) => void; onDelete?: () => void }) {
  const [value, setValue] = useState<number>(Number(rule.value));
  const [win, setWin] = useState<number>(Number(rule.window_minutes ?? 1440));
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border bg-background/40 p-2">
      <Switch checked={rule.enabled} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{rule.name}</div>
        <div className="text-[10px] text-muted-foreground">{CATEGORY_LABEL[rule.category] ?? rule.category} · {rule.metric}{rule.is_builtin ? " · built-in" : ""}</div>
      </div>
      <Input type="number" className="h-8 w-20" value={value} onChange={(e) => setValue(Number(e.target.value))} />
      <Input type="number" className="h-8 w-24" value={win} onChange={(e) => setWin(Number(e.target.value))} title="Window (minutes)" />
      <Button size="sm" variant="outline" onClick={() => onSave(value, win)}>Save</Button>
      {onDelete && <Button size="sm" variant="destructive" onClick={onDelete}>Delete</Button>}
    </div>
  );
}
