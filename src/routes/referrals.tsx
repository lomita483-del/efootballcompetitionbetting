import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Gift, ShieldCheck, Users } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ReferralCard } from "@/components/UserHubSections";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/referrals")({
  head: () => ({ meta: [{ title: "Refer & Earn — ECB" }, { name: "description", content: "Invite friends to ECB and earn referral rewards when they join with your unique link." }, { property: "og:title", content: "Refer & Earn — ECB" }, { property: "og:description", content: "Share your unique ECB referral link and earn rewards." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ReferralsPage,
});
function ReferralsPage() {
  return <Layout><main className="container max-w-5xl py-8"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Rewards program</p><h1 className="text-4xl font-black">Refer &amp; Earn</h1></div><Button asChild variant="outline"><Link to="/matches"><ArrowLeft /> Matches</Link></Button></div><section className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-md border border-primary/25 bg-card/60 p-4"><Users className="mb-2 text-primary" /><b>Invite a friend</b><p className="text-xs text-muted-foreground">Send your unique referral link.</p></div><div className="rounded-md border border-primary/25 bg-card/60 p-4"><ShieldCheck className="mb-2 text-accent" /><b>They join securely</b><p className="text-xs text-muted-foreground">The referee must register through your link or apply your code.</p></div><div className="rounded-md border border-primary/25 bg-card/60 p-4"><Gift className="mb-2 text-primary" /><b>Both earn</b><p className="text-xs text-muted-foreground">Rewards are credited after the referral is accepted.</p></div></section><ReferralCard /></main></Layout>;
}