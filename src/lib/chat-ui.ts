import { supabase } from "@/integrations/supabase/client";
import { getLevelInfo } from "@/lib/levels";

export type AttachmentType = "image" | "video" | "audio" | "file" | "sticker" | "gif";

export interface ChatAttachment {
  url: string;
  type: AttachmentType;
  name?: string;
  mime?: string;
  size?: number;
}

export const MAX_ATTACHMENTS = 5;
const YEAR = 60 * 60 * 24 * 365;

/** Rank palette keyed by level (1-7) from src/lib/levels.ts */
export const RANK_STYLES: Record<number, { from: string; to: string; ring: string; text: string }> = {
  1: { from: "rgba(148,163,184,0.30)", to: "rgba(71,85,105,0.20)", ring: "rgba(148,163,184,0.55)", text: "#cbd5e1" },
  2: { from: "rgba(16,185,129,0.32)", to: "rgba(6,95,70,0.20)", ring: "rgba(16,185,129,0.60)", text: "#6ee7b7" },
  3: { from: "rgba(56,189,248,0.32)", to: "rgba(2,132,199,0.20)", ring: "rgba(56,189,248,0.60)", text: "#7dd3fc" },
  4: { from: "rgba(167,139,250,0.32)", to: "rgba(91,33,182,0.20)", ring: "rgba(167,139,250,0.60)", text: "#c4b5fd" },
  5: { from: "rgba(251,191,36,0.32)", to: "rgba(180,83,9,0.20)", ring: "rgba(251,191,36,0.62)", text: "#fcd34d" },
  6: { from: "rgba(244,63,94,0.32)", to: "rgba(159,18,57,0.20)", ring: "rgba(244,63,94,0.60)", text: "#fda4af" },
  7: { from: "rgba(232,121,249,0.34)", to: "rgba(251,191,36,0.24)", ring: "rgba(232,121,249,0.65)", text: "#f0abfc" },
};

export function rankFor(xp: number | null | undefined) {
  const info = getLevelInfo(Number(xp ?? 0));
  return { ...info, style: RANK_STYLES[info.level] ?? RANK_STYLES[1] };
}

export function bubbleStyle(xp: number | null | undefined, mine: boolean) {
  const { style } = rankFor(xp);
  return {
    background: `linear-gradient(135deg, ${style.from}, ${style.to})`,
    borderColor: mine ? style.ring : "rgba(255,255,255,0.10)",
    boxShadow: mine ? `0 8px 30px -14px ${style.ring}` : "0 8px 24px -18px rgba(0,0,0,0.9)",
  } as React.CSSProperties;
}

export function attachmentTypeFor(file: File): AttachmentType {
  if (file.type.startsWith("image/")) return file.type === "image/gif" ? "gif" : "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

/** chat-images is a private bucket — store long-lived signed URLs. */
export async function uploadChatFile(userId: string, file: File | Blob, filename: string) {
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabase.storage.from("chat-images").upload(path, file, {
    contentType: (file as File).type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { data, error: se } = await supabase.storage.from("chat-images").createSignedUrl(path, YEAR);
  if (se || !data?.signedUrl) throw se ?? new Error("Could not create a link for the upload");
  return { url: data.signedUrl, path };
}

export function normalizeAttachments(row: any): ChatAttachment[] {
  const list = Array.isArray(row?.attachments) ? (row.attachments as ChatAttachment[]) : [];
  if (list.length > 0) return list;
  if (row?.image_url) return [{ url: row.image_url, type: "image" }];
  return [];
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}