import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type AuditOptions = {
  targetType?: string;
  targetId?: string;
};

function safeInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const copy = { ...(input as Record<string, unknown>) };
  for (const key of Object.keys(copy)) {
    if (/token|password|secret|authorization/i.test(key)) copy[key] = "[redacted]";
  }
  return copy;
}

export async function actorRole(ctx: ToolContext): Promise<"admin" | "moderator" | "user"> {
  const userId = ctx.getUserId();
  if (!userId) return "user";
  const { data } = await supabaseForUser(ctx)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((row) => String(row.role));
  if (roles.includes("admin")) return "admin";
  if (roles.includes("moderator")) return "moderator";
  return "user";
}

export async function requireAdmin(ctx: ToolContext): Promise<ToolResult | null> {
  if (!ctx.isAuthenticated() || !ctx.getUserId()) {
    return { content: [{ type: "text", text: "Not authenticated. Sign in with an administrator account." }], isError: true };
  }
  if ((await actorRole(ctx)) !== "admin") {
    return { content: [{ type: "text", text: "Forbidden. This MCP tool requires the admin role." }], isError: true };
  }
  return null;
}

export async function auditedToolCall(
  toolName: string,
  input: unknown,
  ctx: ToolContext,
  run: () => Promise<ToolResult>,
  options: AuditOptions = {},
): Promise<ToolResult> {
  let result: ToolResult;
  let errorMessage: string | null = null;
  try {
    result = await run();
    if (result.isError) errorMessage = result.content[0]?.text ?? "Tool call failed";
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Tool call failed";
    result = { content: [{ type: "text", text: errorMessage }], isError: true };
  }

  const userId = ctx.getUserId();
  if (!userId) return result;
  try {
    const role = await actorRole(ctx);
    const { error } = await (supabaseForUser(ctx) as any).from("mcp_audit_logs").insert({
      user_id: userId,
      user_email: ctx.getUserEmail() ?? null,
      actor_role: role,
      tool_name: toolName,
      success: !result.isError,
      target_type: options.targetType ?? null,
      target_id: options.targetId ?? null,
      input_summary: safeInput(input),
      result_summary: { content_type: "text", has_structured_content: !!result.structuredContent },
      error_message: errorMessage,
      client_id: ctx.getClientId() ?? null,
    });
    if (error) console.error("MCP audit write failed", error.message);
  } catch (auditError) {
    console.error("MCP audit write failed", auditError instanceof Error ? auditError.message : "unknown error");
  }
  return result;
}