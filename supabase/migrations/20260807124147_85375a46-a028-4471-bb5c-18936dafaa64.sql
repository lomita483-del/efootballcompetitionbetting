CREATE TABLE public.popup_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  title text,
  headline text,
  body_text text,
  image_url text,
  link_url text,
  cta_label text,
  cta_title text,
  cta_subtitle text,
  promo_badge text,
  size text NOT NULL DEFAULT 'large',
  pages text[] NOT NULL DEFAULT ARRAY['all'],
  starts_at timestamptz,
  ends_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.popup_ads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.popup_ads TO authenticated;
GRANT ALL ON public.popup_ads TO service_role;

ALTER TABLE public.popup_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view popup ads" ON public.popup_ads FOR SELECT USING (true);
CREATE POLICY "Admins manage popup ads" ON public.popup_ads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER popup_ads_updated_at BEFORE UPDATE ON public.popup_ads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();