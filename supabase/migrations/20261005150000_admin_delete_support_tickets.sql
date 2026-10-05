-- Allow administrators to remove support conversations from the admin console.
-- Users can still create and manage their own tickets; only admins can permanently delete them.

DROP POLICY IF EXISTS "support tickets admin delete" ON public.support_tickets;
CREATE POLICY "support tickets admin delete"
  ON public.support_tickets
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "ticket messages admin delete" ON public.ticket_messages;
CREATE POLICY "ticket messages admin delete"
  ON public.ticket_messages
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Keep deletion safe even if the UI deletes messages first.
-- Existing foreign-key behaviour is left unchanged.
