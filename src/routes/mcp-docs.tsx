import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, CheckCircle2, Copy, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/mcp-docs")({
  head: () => ({ meta: [
    { title: "MCP Agent Tools — E-Football Competition Bet" },
    { name: "description", content: "Connect an AI assistant securely to ECB player and administrator tools with OAuth, role permissions, and audit logs." },
    { property: "og:title", content: "ECB MCP Agent Tools" },
    { property: "og:description", content: "Documentation and example prompts for ECB player and administrator AI tools." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: McpDocsPage,
});

const playerTools = [
  ["get_my_account", "Reads your token balance, XP, tier, gang, region and streak."],
  ["list_my_bets", "Lists only your bet vouchers and supports status filtering."],
  ["list_my_wagers", "Lists P2P wagers you created or received."],
  ["list_matches", "Lists fixtures, live scores and completed competition matches."],
] as const;
const adminTools = [
  ["admin_platform_overview", "Summarizes users, matches, bets, open stakes, exposure and token balances."],
  ["admin_list_matches", "Searches scheduled, live, ended, archived and voided matches."],
  ["admin_manage_match", "Starts, reschedules, scores, settles, voids, unvoids or archives a match."],
  ["admin_list_bets", "Searches player tickets with selections and settlement details."],
  ["admin_manage_bet", "Suspends, reactivates, refunds, voids or deletes a ticket."],
  ["admin_list_mcp_audit", "Reviews the MCP call trail by tool, actor role, outcome and time."],
] as const;
const userPrompts = ["What is my current token balance and streak?", "Show my open bet tickets and their possible payouts.", "Which matches are live or scheduled today?", "List my latest P2P wagers and their status."];
const adminPrompts = ["Give me a platform overview and calculate current open bet exposure.", "Find all live matches and flag any with missing scores.", "Void match MATCH_ID because the fixture was cancelled.", "Find ticket TRACKING_ID and suspend it pending review.", "Show failed MCP calls made by administrators today."];

function Prompt({ children }: { children: string }) {
  return <div className="flex min-h-12 items-center gap-3 rounded-md border border-primary/20 bg-background/50 px-4 py-3"><span className="flex-1 text-sm text-foreground">“{children}”</span><Button type="button" size="icon" variant="ghost" title="Copy prompt" onClick={() => navigator.clipboard.writeText(children).then(() => toast.success("Prompt copied"))}><Copy className="h-4 w-4" /></Button></div>;
}

function McpDocsPage() {
  const { isAdmin } = useAuth();
  return <Layout><main className="mx-auto w-full max-w-6xl px-6 py-10">
    <section className="border-b border-primary/20 pb-8"><div className="mb-4 flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-md border border-primary/40 bg-primary/10"><Bot className="h-7 w-7 text-primary" /></div><div><Badge variant="outline" className="border-primary/40 text-primary">OAuth protected</Badge><h1 className="mt-2 text-4xl font-black text-foreground">MCP Agent Tools</h1></div></div><p className="max-w-3xl text-muted-foreground">Connect a compatible AI assistant to the platform. The assistant acts as the signed-in account, database permissions still apply, admin tools require the admin role, and every call is recorded for traceability.</p>{isAdmin && <Button asChild className="mt-5 btn-luxury"><Link to="/admin/mcp-audit"><ShieldCheck className="mr-2 h-4 w-4" />Open MCP audit log</Link></Button>}</section>
    <section className="grid gap-6 py-8 lg:grid-cols-2"><Card className="border-primary/20 bg-card/70 p-6"><div className="mb-5 flex items-center gap-3"><Sparkles className="h-5 w-5 text-primary" /><h2 className="text-2xl font-bold">Player tools</h2></div><div className="space-y-4">{playerTools.map(([name, description]) => <div key={name} className="border-b border-border/60 pb-4 last:border-0"><code className="text-sm font-bold text-primary">{name}</code><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>)}</div></Card><Card className="border-accent/25 bg-card/70 p-6"><div className="mb-5 flex items-center gap-3"><LockKeyhole className="h-5 w-5 text-accent" /><h2 className="text-2xl font-bold">Administrator tools</h2></div><div className="space-y-4">{adminTools.map(([name, description]) => <div key={name} className="border-b border-border/60 pb-4 last:border-0"><code className="text-sm font-bold text-accent">{name}</code><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>)}</div></Card></section>
    <section className="grid gap-6 pb-8 lg:grid-cols-2"><div><h2 className="mb-4 text-xl font-bold">Example player prompts</h2><div className="space-y-3">{userPrompts.map((prompt) => <Prompt key={prompt}>{prompt}</Prompt>)}</div></div><div><h2 className="mb-4 text-xl font-bold">Example admin prompts</h2><div className="space-y-3">{adminPrompts.map((prompt) => <Prompt key={prompt}>{prompt}</Prompt>)}</div></div></section>
    <section className="grid gap-4 border-t border-primary/20 pt-8 md:grid-cols-3">{["OAuth sign-in binds the assistant to a real account.", "Role checks happen again inside every admin tool.", "Calls record timestamp, actor, role, target and outcome."].map((text) => <div key={text} className="flex gap-3 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{text}</div>)}</section>
  </main></Layout>;
}