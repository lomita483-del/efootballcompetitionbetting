import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Mail, Phone, KeyRound } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recover your account — E-Football Competition Bet" },
      { name: "description", content: "Reset your password with a one-time code sent to your linked email or phone number." },
      { property: "og:title", content: "Recover your account — E-Football Competition Bet" },
      { property: "og:description", content: "Request a one-time code to your linked email or phone and set a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

type Channel = "email" | "phone";

function ForgotPasswordPage() {
  const nav = useNavigate();
  const [channel, setChannel] = useState<Channel>("email");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"request" | "verify">("request");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    const value = contact.trim();
    if (!value) return toast.error("Enter your details", { description: `Type the ${channel} linked to your account.` });
    if (channel === "phone" && !/^\+[1-9]\d{7,14}$/.test(value)) return toast.error("Use international phone format", { description: "Example: +2348012345678" });
    setLoading(true);
    const { error } =
      channel === "email"
        ? await supabase.auth.signInWithOtp({ email: value, options: { shouldCreateUser: false } })
        : await supabase.auth.signInWithOtp({ phone: value, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) return toast.error("Could not send code", { description: error.message });
    setStage("verify");
    setCooldown(45);
    toast.success("One-time code sent", {
      description: channel === "email" ? `Check ${value} for a 6-digit code.` : `We texted a 6-digit code to ${value}.`,
    });
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return toast.error("Enter the full 6-digit code");
    setLoading(true);
    const value = contact.trim();
    const { error } =
      channel === "email"
        ? await supabase.auth.verifyOtp({ email: value, token: code, type: "email" })
        : await supabase.auth.verifyOtp({ phone: value, token: code, type: "sms" });
    setLoading(false);
    if (error) return toast.error("Invalid or expired code", { description: error.message });
    toast.success("Verified", { description: "Set a new password to secure your account." });
    nav({ to: "/reset-password" });
  };

  const sendResetLink = async () => {
    const value = contact.trim();
    if (!value) return toast.error("Enter your email address first");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error("Could not send link", { description: error.message });
    toast.success("Reset link sent", { description: `Check ${value} for the recovery link.` });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="p-8 backdrop-blur-xl bg-card/60 border-primary/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-gradient-gold grid place-items-center shadow-gold">
              <KeyRound className="h-5 w-5 text-background" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black gradient-gold-text">Recover access</h1>
              <p className="text-xs text-muted-foreground">Get a one-time code on your linked email or phone.</p>
            </div>
          </div>

          {stage === "request" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-background/60 border border-primary/20">
                {(["email", "phone"] as Channel[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setChannel(c); setContact(""); }}
                    className={`flex items-center justify-center gap-2 h-9 rounded-md text-sm font-bold capitalize transition ${
                      channel === c ? "bg-gradient-gold text-background shadow-gold" : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {c === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                    {c}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>{channel === "email" ? "Linked email" : "Linked phone number"}</Label>
                <Input
                  type={channel === "email" ? "email" : "tel"}
                  placeholder={channel === "email" ? "you@example.com" : "+2348012345678"}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="bg-card/60 backdrop-blur-xl border-primary/30"
                />
                {channel === "phone" && (
                  <p className="text-[11px] text-muted-foreground">Use the full international format, including the country code.</p>
                )}
              </div>

              <Button onClick={sendCode} disabled={loading} className="btn-luxury w-full h-11 font-black">
                {loading ? "Sending..." : "Send one-time code"}
              </Button>

              {channel === "email" && (
                <button type="button" onClick={sendResetLink} disabled={loading} className="w-full text-xs text-muted-foreground hover:text-primary hover:underline">
                  Prefer a reset link instead? Send it to my email
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={verify} className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="text-primary font-semibold">{contact}</span>.
              </p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={code} onChange={setCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="border-primary/30" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" disabled={loading} className="btn-luxury w-full h-11 font-black">
                {loading ? "Verifying..." : "Verify code"}
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={() => { setStage("request"); setCode(""); }} className="text-muted-foreground hover:text-primary hover:underline">
                  Change {channel}
                </button>
                <button type="button" disabled={cooldown > 0 || loading} onClick={sendCode} className="text-primary font-semibold disabled:opacity-50 hover:underline">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-sm">
            <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </Layout>
  );
}
