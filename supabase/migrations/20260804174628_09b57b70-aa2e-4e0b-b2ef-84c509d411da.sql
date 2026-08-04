CREATE TABLE public.mcp_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  actor_role text NOT NULL CHECK (actor_role IN ('user', 'moderator', 'admin')),
  tool_name text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  target_type text,
  target_id text,
  input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mcp_audit_logs TO authenticated;
GRANT ALL ON public.mcp_audit_logs TO service_role;

ALTER TABLE public.mcp_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own MCP audit entries"
ON public.mcp_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super Admins review MCP audit entries"
ON public.mcp_audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX mcp_audit_logs_created_at_idx ON public.mcp_audit_logs (created_at DESC);
CREATE INDEX mcp_audit_logs_user_id_idx ON public.mcp_audit_logs (user_id, created_at DESC);
CREATE INDEX mcp_audit_logs_tool_name_idx ON public.mcp_audit_logs (tool_name, created_at DESC);
CREATE INDEX mcp_audit_logs_success_idx ON public.mcp_audit_logs (success, created_at DESC);

NOTIFY pgrst, 'reload schema';