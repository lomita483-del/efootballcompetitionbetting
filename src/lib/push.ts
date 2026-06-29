import { supabase } from "@/integrations/supabase/client";

export type PushState = "unsupported" | "default" | "granted" | "denied" | "subscribed";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function getVapidPublicKey(): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("vapid_public_key")
    .eq("id", 1)
    .maybeSingle();
  return (data as any)?.vapid_public_key || null;
}

/** Current permission/subscription state for the UI. */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "default") return "default";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "subscribed" : "granted";
  } catch {
    return "granted";
  }
}

/**
 * Registers the service worker, requests permission, subscribes to push and
 * stores the subscription token in the database for the given user.
 */
export async function subscribeToPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: "Notifications are not supported on this device/browser." };

  const vapid = await getVapidPublicKey();
  if (!vapid) return { ok: false, error: "Push is not configured yet. Please try again later." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Permission was not granted." };

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
    });
  }

  const json: any = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = json?.keys?.p256dh ?? bufToBase64(sub.getKey("p256dh"));
  const auth_key = json?.keys?.auth ?? bufToBase64(sub.getKey("auth"));
  if (!endpoint || !p256dh || !auth_key) return { ok: false, error: "Could not read subscription keys." };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth_key,
        user_agent: navigator.userAgent.slice(0, 300),
        enabled: true,
      },
      { onConflict: "endpoint" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Removes the local subscription and disables it in the database. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await supabase.from("push_subscriptions").update({ enabled: false }).eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* ignore */
  }
}