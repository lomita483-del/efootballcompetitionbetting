CREATE TABLE public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doc_type text NOT NULL DEFAULT 'id_card',
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc own select" ON public.kyc_documents FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "kyc own insert" ON public.kyc_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_mod_or_admin(auth.uid()));
CREATE POLICY "kyc staff update" ON public.kyc_documents FOR UPDATE TO authenticated USING (public.is_mod_or_admin(auth.uid())) WITH CHECK (public.is_mod_or_admin(auth.uid()));
CREATE POLICY "kyc staff delete" ON public.kyc_documents FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.admin_user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  author_id uuid,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_user_notes TO authenticated;
GRANT ALL ON public.admin_user_notes TO service_role;
ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes staff select" ON public.admin_user_notes FOR SELECT TO authenticated USING (public.is_mod_or_admin(auth.uid()));
CREATE POLICY "notes staff insert" ON public.admin_user_notes FOR INSERT TO authenticated WITH CHECK (public.is_mod_or_admin(auth.uid()) AND auth.uid() = author_id);
CREATE POLICY "notes staff delete" ON public.admin_user_notes FOR DELETE TO authenticated USING (public.is_mod_or_admin(auth.uid()));

CREATE TRIGGER kyc_documents_updated_at BEFORE UPDATE ON public.kyc_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER admin_user_notes_updated_at BEFORE UPDATE ON public.admin_user_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX kyc_documents_user_idx ON public.kyc_documents(user_id);
CREATE INDEX admin_user_notes_user_idx ON public.admin_user_notes(user_id);