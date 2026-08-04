import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deliverChatNotification } from "@/lib/chat-notifications.server";

export const notifyChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ messageId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => deliverChatNotification({ messageId: data.messageId, senderId: context.userId }));