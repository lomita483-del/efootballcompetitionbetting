import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AdvertisementRow({ placement }: { placement: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    const normalizedPlacement = placement === "/" ? "/" : placement.replace(/\/$/, "");
    const load = () => (supabase as any).from("advertisements").select("*").eq("is_active", true).in("placement", [normalizedPlacement, "all"]).order("display_order", { ascending: true }).limit(8).then(({ data, error }: any) => {
      if (error) { console.error("Advertisement load failed", error); return; }
      setItems(data ?? []);
    });
    void load();
    const channel = supabase.channel(`advertisements-${placement}`).on("postgres_changes", { event: "*", schema: "public", table: "advertisements" }, load).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [placement]);
  if (!items.length) return null;
  return <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Featured offers">{items.map((ad) => {
    const content = <article className="group relative aspect-[2/1] overflow-hidden rounded-md border border-primary/30 bg-card shadow-luxury"><img src={ad.image_url} alt={ad.title || "Promotion"} className="h-full w-full transition duration-500 group-hover:scale-105" style={{ objectFit: ad.image_fit || "cover", objectPosition: ad.image_position || "center" }} loading="lazy" />{(ad.title || ad.description) && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent p-3 pt-8"><h3 className="text-sm font-black text-primary">{ad.title}</h3>{ad.description && <p className="line-clamp-1 text-[10px] text-muted-foreground">{ad.description}</p>}</div>}</article>;
    return ad.link_url ? <a key={ad.id} href={ad.link_url} target="_blank" rel="noreferrer">{content}</a> : <div key={ad.id}>{content}</div>;
  })}</section>;
}