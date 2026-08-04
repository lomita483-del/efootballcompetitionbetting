import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listChatFlags, moderateFlag } from "@/lib/chat-moderation.server";

export const getChatModerationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => listChatFlags(context));

export const applyChatModerationAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ flagId: z.string().uuid(), action: z.enum(["dismiss", "delete", "mute", "ban"]) }).parse(data))
  .handler(async ({ context, data }) => moderateFlag(context, data));