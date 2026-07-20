import { supabase } from "@/integrations/supabase/client";

export type WagerStatus =
  | "pending_approval" | "awaiting_payment" | "awaiting_funding"
  | "funded" | "active" | "live" | "awaiting_settlement"
  | "settled" | "cancelled" | "refunded" | "disputed" | "terminated" | "rejected";

export type Wager = {
  id: string; public_id: string;
  challenger_id: string; opponent_id: string;
  match_id: string | null; event_label: string | null;
  category: string; bet_type: string;
  stake: number; total_pot: number; platform_fee_pct: number;
  agreement: string | null; status: WagerStatus;
  match_starts_at: string | null; expires_at: string | null;
  funded_at: string | null; activated_at: string | null; live_at: string | null; settled_at: string | null;
  winner_id: string | null; loser_id: string | null; is_draw: boolean;
  final_score_home: number | null; final_score_away: number | null;
  prize_paid: number | null; settlement_notes: string | null; admin_notes: string | null;
  is_locked: boolean; created_at: string; updated_at: string;
};

export type WagerWallet = { id: string; user_id: string; balance: number; locked_balance: number };
export type WagerPayment = {
  id: string; wager_id: string; user_id: string; amount: number;
  method: string | null; reference: string | null; receipt_url: string | null;
  status: "pending" | "verified" | "rejected"; verified_by: string | null; verified_at: string | null;
  notes: string | null; created_at: string;
};

export async function ensureWagerWallet(uid: string) {
  await supabase.rpc("ensure_wager_wallet", { _uid: uid });
}

export async function getMyWagerWallet(uid: string): Promise<WagerWallet | null> {
  await ensureWagerWallet(uid);
  const { data } = await supabase.from("wager_wallets").select("*").eq("user_id", uid).maybeSingle();
  return (data as any) ?? null;
}

export async function listMyWagers(uid: string): Promise<Wager[]> {
  const { data } = await supabase.from("wagers").select("*")
    .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
    .order("created_at", { ascending: false });
  return (data as any) ?? [];
}

export async function findOpponent(query: string): Promise<{ id: string; username: string | null; email?: string }[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await supabase.from("profiles")
    .select("id, username, email")
    .or(`username.ilike.%\( {q}%,discord_username.ilike.% \){q}%,id.ilike.%\( {q}%,email.ilike.% \){q}%`)
    .limit(8);
  return (data as any) ?? [];
}

export async function createChallenge(input: {
  opponent_id: string; stake: number; match_id?: string | null;
  event_label?: string; category?: string; bet_type?: string; agreement?: string;
  match_starts_at?: string | null; expires_at?: string | null;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Sign in required");
  const payload = {
    challenger_id: user.user.id,
    opponent_id: input.opponent_id,
    stake: input.stake,
    match_id: input.match_id ?? null,
    event_label: input.event_label ?? null,
    category: input.category ?? "match",
    bet_type: input.bet_type ?? "winner",
    agreement: input.agreement ?? null,
    match_starts_at: input.match_starts_at ?? null,
    expires_at: input.expires_at ?? null,
    status: "pending_approval" as const,
    total_pot: input.stake * 2,
  };
  const { data, error } = await supabase.from("wagers").insert(payload).select("*").single();
  if (error) throw error;
  return data as Wager;
}

export async function acceptWager(id: string) {
  const { data, error } = await supabase.rpc("p2p_accept_wager", { _wager_id: id });
  if (error) throw error; return data as Wager;
}
export async function rejectWager(id: string, reason?: string) {
  const { data, error } = await supabase.rpc("p2p_reject_wager", { _wager_id: id, _reason: reason ?? undefined } as any);
  if (error) throw error; return data as Wager;
}
export async function requestTermination(id: string, reason: string) {
  const { error } = await supabase.rpc("p2p_request_termination", { _wager_id: id, _reason: reason });
  if (error) throw error;
}
export async function submitPayment(input: {
  wager_id: string; amount: number; method?: string; reference?: string; file?: File | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sign in required");
  let receipt_url: string | null = null;
  if (input.file) {
    const path = `${u.user.id}/${Date.now()}-${input.file.name}`;
    const bucket = "token-proofs";
    const { error: ue } = await supabase.storage.from(bucket).upload(path, input.file);
    if (ue) throw ue;
    receipt_url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  const { error } = await supabase.from("wager_payments").insert({
    wager_id: input.wager_id, user_id: u.user.id, amount: input.amount,
    method: input.method ?? null, reference: input.reference ?? null,
    receipt_url, status: "pending",
  });
  if (error) throw error;
}

// Admin
export async function adminVerifyPayment(payment_id: string) {
  const { data, error } = await supabase.rpc("p2p_verify_payment", { _payment_id: payment_id });
  if (error) throw error; return data as Wager;
}
export async function adminSettleWager(input: {
  wager_id: string; winner_id: string | null; is_draw?: boolean;
  final_home?: number | null; final_away?: number | null; notes?: string;
}) {
  const { data, error } = await supabase.rpc("p2p_settle_wager", {
    _wager_id: input.wager_id, _winner_id: input.winner_id ?? undefined,
    _is_draw: input.is_draw ?? false,
    _final_home: input.final_home ?? undefined, _final_away: input.final_away ?? undefined,
    _notes: input.notes ?? undefined,
  } as any);
  if (error) throw error; return data as Wager;
}
export async function adminRefundWager(wager_id: string, reason?: string) {
  const { data, error } = await supabase.rpc("p2p_refund_wager", { _wager_id: wager_id, _reason: reason ?? undefined } as any);
  if (error) throw error; return data as Wager;
}
export async function adminTerminateWager(wager_id: string, reason: string, refund = true) {
  const { data, error } = await supabase.rpc("p2p_admin_terminate", { _wager_id: wager_id, _reason: reason, _refund: refund });
  if (error) throw error; return data as Wager;
}
export async function adminPostLiveEvent(wager_id: string, kind: string, payload: any) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from("wager_live_events").insert({
    wager_id, kind, payload, created_by: u.user?.id ?? null,
  });
  if (error) throw error;
}
