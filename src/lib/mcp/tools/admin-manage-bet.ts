import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { auditedToolCall, requireAdmin } from "../audit";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "admin_manage_bet",
  title: "Admin manage bet",
  description: "Suspend, reactivate, refund, void or delete a bet ticket using audited administrator-only operations.",
  inputSchema: {
    bet_id: z.string().describe("Bet ticket UUID."),
    action: z.enum(["suspend", "unsuspend", "refund", "void", "delete"]).describe("Administrative ticket action."),
    reason: z.string().optional().describe("Reason stored with the administrative action."),
    refund_stake: z.boolean().optional().describe("For void or delete, whether to refund the stake."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => auditedToolCall("admin_manage_bet", input, ctx, async () => {
    const denied = await requireAdmin(ctx);
    if (denied) return denied;
    const db = supabaseForUser(ctx);
    let response;
    if (input.action === "suspend") response = await db.rpc("admin_suspend_bet", { _bet_id: input.bet_id, _reason: input.reason });
    else if (input.action === "unsuspend") response = await db.rpc("admin_unsuspend_bet", { _bet_id: input.bet_id });
    else if (input.action === "refund") response = await db.rpc("admin_refund_bet", { _bet_id: input.bet_id, _reason: input.reason });
    else if (input.action === "void") response = await db.rpc("admin_void_bet", { _bet_id: input.bet_id, _refund: input.refund_stake ?? false, _reason: input.reason });
    else response = await db.rpc("admin_delete_bet", { _bet_id: input.bet_id, _refund: input.refund_stake ?? false, _reason: input.reason });
    if (response.error) return { content: [{ type: "text", text: response.error.message }], isError: true };
    const summary = { bet_id: input.bet_id, action: input.action, refunded: input.refund_stake ?? input.action === "refund", success: true };
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }], structuredContent: summary };
  }, { targetType: "bet", targetId: input.bet_id }),
});