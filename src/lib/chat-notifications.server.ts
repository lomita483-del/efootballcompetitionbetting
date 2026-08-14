import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { configureWebPush, sendToSubscriptions } from "@/lib/push-send.server";

type ChatNotificationInput = {
  messageId: string;
  senderId: string;
};

export async function deliverChatNotification({ messageId, senderId }: ChatNotificationInput) {
  const [{ data: message }, { data: sender }, { data: settings }] = await Promise.all([
    supabaseAdmin
      .from("chat_messages")
      .select("id,user_id,room,content,image_url")
      .eq("id", messageId)
      .eq("user_id", senderId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("full_name,ingame_name")
      .eq("id", senderId)
      .maybeSingle(),
    supabaseAdmin
      .from("app_settings")
      .select("chat_notifications_enabled,chat_push_enabled,chat_in_app_enabled,chat_notification_rooms")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (!message) throw new Error("Chat message not found");
  if (settings?.chat_notifications_enabled === false) return { sent: 0, recipients: 0 };
  const enabledRooms = Array.isArray(settings?.chat_notification_rooms) ? settings.chat_notification_rooms : ["general", "gang", "moderator"];
  if (!enabledRooms.includes(message.room)) return { sent: 0, recipients: 0 };

  const senderName = sender?.ingame_name || sender?.full_name || "A player";
  const content = message.content?.trim() || (message.image_url ? "Sent an image" : "Sent a message");
  let title = `${senderName} in ${message.room} chat`;
  const body = content.slice(0, 240);

  // Parse @mentions so tagged members are actually targeted.
  const rawMentions = Array.from(
    (message.content ?? "").matchAll(/@([A-Za-z0-9_][A-Za-z0-9_ .'-]{0,40})/g),
  ).map((m) => m[1].trim()).filter(Boolean);
  const mentionsEveryone = rawMentions.some((m) => /^(all|everyone)\b/i.test(m));
  let mentionedIds: string[] = [];
  if (!mentionsEveryone && rawMentions.length > 0) {
    const firstWords = Array.from(new Set(rawMentions.map((m) => m.split(/\s+/)[0]).filter((w) => w.length >= 2)));
    if (firstWords.length > 0) {
      const orFilter = firstWords
        .map((w) => `full_name.ilike.${w}%,ingame_name.ilike.${w}%`)
        .join(",");
      const { data: candidates } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name,ingame_name")
        .or(orFilter)
        .limit(200);
      mentionedIds = (candidates ?? [])
        .filter((p: any) =>
          [p.full_name, p.ingame_name]
            .filter(Boolean)
            .some((name: string) =>
              rawMentions.some((m) => m.toLowerCase().startsWith(String(name).toLowerCase())),
            ),
        )
        .map((p: any) => p.id)
        .filter((id: string) => id !== senderId);
    }
  }

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth_key")
    .eq("enabled", true)
    .not("user_id", "is", null)
    .neq("user_id", senderId);
  if (subscriptionsError) throw subscriptionsError;

  let recipients = Array.from(new Set((subscriptions ?? []).map((subscription) => subscription.user_id).filter(Boolean)));
  if (mentionedIds.length > 0) {
    const mentionSet = new Set(mentionedIds);
    recipients = recipients.filter((id) => mentionSet.has(id as string));
    title = `${senderName} mentioned you in ${message.room} chat`;
  } else if (mentionsEveryone) {
    title = `${senderName} tagged everyone in ${message.room} chat`;
  }
  if (message.room === "moderator" && recipients.length > 0) {
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("user_id", recipients)
      .in("role", ["moderator", "admin"]);
    const allowed = new Set((roleRows ?? []).map((row) => row.user_id));
    recipients = recipients.filter((id) => allowed.has(id));
  }

  if (recipients.length === 0) return { sent: 0, recipients: 0 };

  // Respect each user's notification preferences: skip anyone who turned push
  // off or opted out of chat pings. Missing rows keep the default (opted in).
  const { data: prefRows } = await supabaseAdmin
    .from("notification_prefs")
    .select("user_id,push_enabled,chat_mentions")
    .in("user_id", recipients);
  const optedOut = new Set(
    (prefRows ?? [])
      .filter((p: any) => p.push_enabled === false || p.chat_mentions === false)
      .map((p: any) => p.user_id),
  );
  recipients = recipients.filter((id) => !optedOut.has(id));
  if (recipients.length === 0) return { sent: 0, recipients: 0 };

  const notificationRows = recipients.map((userId) => ({
    user_id: userId,
    title,
    body,
    link: "/chat",
    image_url: message.image_url || null,
    skip_push: true,
  }));
  if (settings?.chat_in_app_enabled !== false) {
    const { error: notificationError } = await supabaseAdmin.from("notifications").insert(notificationRows);
    if (notificationError) throw notificationError;
  }

  if (settings?.chat_push_enabled === false) return { sent: 0, recipients: recipients.length };

  const recipientSet = new Set(recipients);
  const recipientSubscriptions = (subscriptions ?? []).filter((subscription) => subscription.user_id && recipientSet.has(subscription.user_id));
  const webpush = (await import("web-push")).default;
  const configured = await configureWebPush(webpush, supabaseAdmin);
  if (!configured) return { sent: 0, recipients: recipients.length };

  const result = await sendToSubscriptions(webpush, supabaseAdmin, recipientSubscriptions, {
    title,
    body,
    link: "/chat",
    image: message.image_url || undefined,
    tag: `chat-${message.id}`,
  });
  return { sent: result.sent, recipients: recipients.length };
}