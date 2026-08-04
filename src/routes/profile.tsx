import { LevelBadge } from "@/components/LevelBadge";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — ECB" },
      { name: "description", content: "Manage your ECB profile, contact details, avatar, and gang affiliation." },
      { property: "og:title", content: "Your Profile — ECB" },
      { property: "og:description", content: "Manage your ECB profile, contact details, avatar, and gang affiliation." },
      { property: "og:url", content: "/profile" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/profile" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const [f, setF] = useState({ full_name: "", phone: "", discord_username: "", country: "", gang_name: "" });
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [busy, setBusy] = useState<"email" | "pw" | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (profile) setF({ full_name: profile.full_name, phone: profile.phone ?? "", discord_username: profile.discord_username ?? "", country: profile.country ?? "", gang_name: profile.gang_name ?? "" }); }, [profile?.id]);
  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);
  if (!user || !profile) return <Layout><div className="container mx-auto p-10">Sign in</div></Layout>;
  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    const path = `${user.id}/avatar-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setUploading(false);
    if (error) return toast.error(error.message);
    toast.success("Profile photo updated");
    await refresh();
  };
  const save = async () => {
    const phone = f.phone.trim();
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
      return toast.error("Use international phone format", { description: "Example: +2348012345678" });
    }
    if (phone && phone !== user.phone) {
      const { error: phoneError } = await supabase.auth.updateUser({ phone });
      if (phoneError) return toast.error("Could not link phone", { description: phoneError.message });
      toast.success("Phone verification sent", { description: "Enter the SMS code when prompted to verify this number." });
    }
    const { error } = await supabase.from("profiles").update(f).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); await refresh();
  };
  const saveEmail = async () => {
    if (!email.trim() || email.trim() === user.email) return toast.error("Enter a new email address");
    setBusy("email");
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Confirmation sent", { description: "Check both your old and new inbox to confirm the change." });
  };
  const savePassword = async () => {
    if (pw.next.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw.next !== pw.confirm) return toast.error("Passwords do not match");
    setBusy("pw");
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setBusy(null);
    if (error) return toast.error(error.message);
    setPw({ next: "", confirm: "" });
    toast.success("Password updated");
  };
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="text-3xl font-bold text-primary mb-6">Your Profile</h1>
        <Card className="p-5 mb-6">
          <LevelBadge xp={(profile as any).xp ?? 0} />
        </Card>
        <Card className="p-6 mb-6 flex items-center gap-5 flex-wrap">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-primary/50 bg-primary/10 grid place-items-center shadow-gold">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.full_name} className="h-full w-full object-contain" />
              : <span className="text-2xl font-black text-primary">{(profile.full_name ?? "?").slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Profile photo</Label>
            <Input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAvatar(file); e.target.value = ""; }} />
            <p className="text-xs text-muted-foreground">{uploading ? "Uploading…" : "JPG or PNG, up to 5MB. Shown on your profile and leaderboards."}</p>
            {profile.avatar_url && (
              <Button variant="ghost" size="sm" className="text-destructive h-7 px-2"
                onClick={async () => { await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id); await refresh(); toast.success("Photo removed"); }}>
                Remove photo
              </Button>
            )}
          </div>
        </Card>
        <Card className="p-5 mb-6 border-primary/30 bg-gradient-to-r from-primary/10 to-accent/5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Your Special ID</div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <span className="font-mono text-2xl font-black tracking-[0.2em] text-primary">{(profile as any).special_id ?? "—"}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard?.writeText((profile as any).special_id ?? ""); toast.success("Special ID copied"); }}
            >Copy</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Share this ID so others can transfer tokens to you.</p>
        </Card>
        <Card className="p-6 space-y-4">
          {(["full_name","phone","discord_username","country","gang_name"] as const).map((k) => (
            <div key={k}><Label className="capitalize">{k.replace("_"," ")}</Label><Input type={k === "phone" ? "tel" : "text"} placeholder={k === "phone" ? "+2348012345678" : undefined} value={(f as any)[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />{k === "phone" && <p className="mt-1 text-xs text-muted-foreground">Use international format. Changing it sends a verification SMS.</p>}</div>
          ))}
          <Button onClick={save} className="w-full">Save</Button>
        </Card>

        <Card className="p-6 space-y-4 mt-6">
          <h2 className="text-lg font-bold text-primary">Email address</h2>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <p className="text-xs text-muted-foreground mt-1">Changing your email requires confirming via a link sent to the new address.</p>
          </div>
          <Button onClick={saveEmail} disabled={busy === "email"} className="w-full" variant="outline">{busy === "email" ? "Sending…" : "Update email"}</Button>
        </Card>

        <Card className="p-6 space-y-4 mt-6">
          <h2 className="text-lg font-bold text-primary">Reset password</h2>
          <div><Label>New password</Label><Input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} placeholder="At least 6 characters" /></div>
          <div><Label>Confirm new password</Label><Input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} placeholder="Re-enter new password" /></div>
          <Button onClick={savePassword} disabled={busy === "pw"} className="w-full" variant="outline">{busy === "pw" ? "Updating…" : "Update password"}</Button>
        </Card>
      </div>
    </Layout>
  );
}
