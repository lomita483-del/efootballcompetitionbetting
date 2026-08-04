import type { Database } from "@/integrations/supabase/types";

type AuthContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient<Database>;
  userId: string;
};

async function assertSuperAdmin(context: AuthContext) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Super Admin access required");
}

export async function listChatFlags(context: AuthContext) {
  await assertSuperAdmin(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("chat_message_flags")
    .select("id,message_id,reporter_id,reason,details,status,resolution,created_at,reviewed_at,chat_messages(id,user_id,room,content,image_url,created_at,deleted_at)")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const userIds = Array.from(new Set((data ?? []).flatMap((flag: any) => [flag.reporter_id, flag.chat_messages?.user_id]).filter(Boolean)));
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id,full_name,email,is_muted,is_banned").in("id", userIds)
    : { data: [] };
  return { flags: data ?? [], profiles: profiles ?? [] };
}

export async function moderateFlag(context: AuthContext, input: { flagId: string; action: "dismiss" | "delete" | "mute" | "ban" }) {
  await assertSuperAdmin(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: flag, error: flagError } = await supabaseAdmin
    .from("chat_message_flags")
    .select("id,message_id,chat_messages(user_id)")
    .eq("id", input.flagId)
    .single();
  if (flagError || !flag) throw new Error(flagError?.message ?? "Flag not found");
  const message = Array.isArray((flag as any).chat_messages) ? (flag as any).chat_messages[0] : (flag as any).chat_messages;
  const targetUserId = message?.user_id as string | undefined;
  if (input.action === "delete") {
    await supabaseAdmin.from("chat_messages").update({ content: null, image_url: null, deleted_at: new Date().toISOString(), deleted_by: context.userId }).eq("id", flag.message_id);
  }
  if ((input.action === "mute" || input.action === "ban") && !targetUserId) throw new Error("Message owner not found");
  if (input.action === "mute") await supabaseAdmin.from("profiles").update({ is_muted: true, mute_reason: "Chat moderation action" }).eq("id", targetUserId as string);
  if (input.action === "ban") await supabaseAdmin.from("profiles").update({ is_banned: true, ban_reason: "Chat moderation action" }).eq("id", targetUserId as string);
  const status = input.action === "dismiss" ? "dismissed" : "actioned";
  const { error } = await supabaseAdmin.from("chat_message_flags").update({ status, resolution: input.action, reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("id", input.flagId);
  if (error) throw new Error(error.message);
  return { ok: true };
}