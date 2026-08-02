import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "viewer" | "shooter" | "gang_leader" | "registered" | "sponsor" | "moderator" | "admin";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  discord_username: string | null;
  country: string | null;
  server: string | null;
  gang_name: string | null;
  gang_type: "G" | "F" | null;
  avatar_url: string | null;
  token_balance: number;
  is_banned: boolean;
  ban_reason: string | null;
  is_muted: boolean;
  mute_reason: string | null;
  is_restricted: boolean;
  restrict_reason: string | null;
  accepted_terms: boolean;
  streak_days?: number;
  longest_streak?: number;
  last_login_date?: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  xp?: number;
  vip_tier?: string;
  gang_emblem_url?: string | null;
  emblem_status?: string;
  chat_color?: string | null;
  profile_banner_url?: string | null;
  profile_title?: string | null;
  showcase_achievement_ids?: string[];
  force_logout_at?: string | null;
}

interface AuthCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isMod: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Enforce admin actions (ban / kick / session revoke) the moment we see them,
  // even if the user has been offline since the action was taken.
  const enforceAccount = (p: Profile | null) => {
    if (!p || typeof window === "undefined") return false;
    const key = `ecb_force_logout_${p.id}`;
    const seen = window.localStorage.getItem(key);
    const current = p.force_logout_at ?? "";
    const kicked = !!current && seen !== null && seen !== current;
    if (!current) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, current);
    if (p.is_banned || kicked) {
      if (kicked) window.localStorage.setItem(key, current);
      supabase.auth.signOut().then(() => {
        window.location.href = p.is_banned ? "/login?banned=1" : "/login?kicked=1";
      });
      return true;
    }
    return false;
  };

  const loadUserData = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p as Profile | null);
    setRoles((r ?? []).map((x: any) => x.role));
    enforceAccount(p as Profile | null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) setTimeout(() => loadUserData(s.user.id), 0);
      else { setProfile(null); setRoles([]); }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadUserData(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`me-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as Profile;
          setProfile((prev) => ({ ...(prev as Profile), ...next }));
          enforceAccount(next);
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "token_transactions", filter: `user_id=eq.${user.id}` },
        () => loadUserData(user.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => loadUserData(user.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Safety net: realtime can drop (sleeping tab, flaky network, PWA resume).
  // Poll the account state so bans, kicks and balance changes land quickly.
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const uid = user.id;
    let stopped = false;
    const sync = async () => {
      if (stopped) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (stopped || !data) return;
      const p = data as Profile;
      setProfile((prev) => ({ ...(prev as Profile), ...p }));
      enforceAccount(p);
    };
    const iv = window.setInterval(sync, 15_000);
    const onVis = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", sync);
    window.addEventListener("online", sync);
    return () => {
      stopped = true;
      window.clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", sync);
      window.removeEventListener("online", sync);
    };
  }, [user?.id]);

  // Heartbeat: keep user_sessions fresh so the admin "Online Users" panel works.
  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    let stopped = false;
    const ping = async () => {
      if (stopped) return;
      try {
        await supabase.from("user_sessions").upsert({
          user_id: user.id,
          last_seen: new Date().toISOString(),
          route: window.location.pathname,
          user_agent: navigator.userAgent.slice(0, 255),
        }, { onConflict: "user_id" });
      } catch {}
    };
    ping();
    const iv = window.setInterval(ping, 60_000);
    const onVis = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; window.clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null); setRoles([]);
  };
  const refresh = async () => { if (user) await loadUserData(user.id); };

  return (
    <Ctx.Provider value={{ session, user, profile, roles, loading,
      isAdmin: roles.includes("admin"),
      isMod: roles.includes("admin") || roles.includes("moderator"),
      signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};

export const ROLE_COLORS: Record<AppRole, string> = {
  viewer: "bg-muted text-muted-foreground border-border",
  shooter: "bg-emerald/20 text-emerald border-emerald/40",
  gang_leader: "bg-gold/20 text-gold border-gold/40",
  registered: "bg-primary/20 text-primary border-primary/40",
  sponsor: "bg-accent/20 text-accent border-accent/40",
  moderator: "bg-accent/20 text-accent border-accent/40",
  admin: "bg-destructive/20 text-destructive border-destructive/40",
};
export const ROLE_LABELS: Record<AppRole, string> = {
  viewer: "Viewer", shooter: "Shooter", gang_leader: "Gang Leader",
  registered: "Registered", sponsor: "Sponsor", moderator: "Admin", admin: "Super Admin",
};
