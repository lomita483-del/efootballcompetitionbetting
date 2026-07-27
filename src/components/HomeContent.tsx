import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Megaphone, Film, ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";

export function AnnouncementSlider() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(10).then(({ data }) => setItems(data ?? []));
  }, []);
  if (items.length === 0) return null;
  return (
    <section className="container mt-6">
      <Carousel opts={{ loop: true }} plugins={[Autoplay({ delay: 5000 })]}>
        <CarouselContent>
          {items.map((a) => (
            <CarouselItem key={a.id}>
              <Card className="glass-strong overflow-hidden border-accent/30">
                <div className="grid md:grid-cols-[200px_1fr]">
                  {a.image_url ? <img src={a.image_url} alt="" className="h-32 md:h-full w-full object-cover" /> : <div className="h-32 md:h-full bg-gradient-emerald grid place-items-center"><Megaphone className="h-10 w-10 text-primary-foreground" /></div>}
                  <div className="p-4">
                    <div className="text-xs uppercase tracking-widest text-accent">Announcement</div>
                    <div className="font-bold text-lg">{a.title}</div>
                    <div className="text-sm text-muted-foreground line-clamp-2">{a.body}</div>
                  </div>
                </div>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

/**
 * The "Top Highlights" carousel (renamed from "Highlights").
 * Pass `embedded` to render it without its own full-width <section>/container
 * wrapper, so it can sit inside a grid column next to Top Players on the
 * homepage. Used standalone (no `embedded` prop) it still works full-width
 * wherever else it might be used.
 */
export function HighlightsRow({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const { user } = useAuth();
  const [myReactions, setMyReactions] = useState<Record<string, "like" | "dislike">>({});

  function load() {
    supabase.from("highlights").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(12).then(({ data }) => setItems(data ?? []));
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!user) { setMyReactions({}); return; }
    supabase.from("highlight_reactions").select("highlight_id,reaction").eq("user_id", user.id).then(({ data }) => {
      const map: Record<string, "like" | "dislike"> = {};
      (data ?? []).forEach((r: any) => { map[r.highlight_id] = r.reaction; });
      setMyReactions(map);
    });
  }, [user?.id]);

  async function react(highlightId: string, reaction: "like" | "dislike") {
    if (!user) { toast.error("Sign in to react"); return; }
    const current = myReactions[highlightId];
    // optimistic count update
    setItems((prev) => prev.map((h) => {
      if (h.id !== highlightId) return h;
      let likes = h.likes ?? 0, dislikes = h.dislikes ?? 0;
      if (current === "like") likes--; if (current === "dislike") dislikes--;
      if (current !== reaction) { if (reaction === "like") likes++; else dislikes++; }
      return { ...h, likes: Math.max(0, likes), dislikes: Math.max(0, dislikes) };
    }));
    if (current === reaction) {
      setMyReactions((m) => { const n = { ...m }; delete n[highlightId]; return n; });
      await supabase.from("highlight_reactions").delete().eq("highlight_id", highlightId).eq("user_id", user.id);
    } else {
      setMyReactions((m) => ({ ...m, [highlightId]: reaction }));
      await supabase.from("highlight_reactions").upsert({ highlight_id: highlightId, user_id: user.id, reaction }, { onConflict: "highlight_id,user_id" });
    }
    load();
  }

  if (items.length === 0) return null;

  const body = (
    <Card className="glass-strong border-primary/25 overflow-hidden h-full">
      <div className="flex items-center gap-2 border-b border-primary/20 px-4 py-3">
        <Film className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black uppercase tracking-[0.18em]">Top Highlights</h2>
      </div>
      <div className="p-3">
        <Carousel opts={{ align: "start", dragFree: true }}>
          <CarouselContent>
            {items.map((h) => (
              <CarouselItem key={h.id} className={embedded ? "basis-[85%] sm:basis-1/2" : "basis-[80%] sm:basis-1/2 md:basis-1/3 lg:basis-1/4"}>
                <Card className="glass overflow-hidden">
                  {h.media_type === "video"
                    ? <video src={h.media_url} controls className="w-full h-36 object-cover" />
                    : <img src={h.media_url} alt={h.title} className="w-full h-36 object-cover" />}
                  <div className="p-2 font-bold text-sm truncate">{h.title}</div>
                  <div className="px-2 pb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => react(h.id, "like")}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${myReactions[h.id] === "like" ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" : "border-border text-muted-foreground hover:text-emerald-300 hover:border-emerald-500/40"}`}
                      aria-label="Like highlight"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" /> {h.likes ?? 0}
                    </button>
                    <button
                      type="button"
                      onClick={() => react(h.id, "dislike")}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${myReactions[h.id] === "dislike" ? "border-destructive/60 bg-destructive/15 text-destructive" : "border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"}`}
                      aria-label="Dislike highlight"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" /> {h.dislikes ?? 0}
                    </button>
                  </div>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
          {!embedded && (<><CarouselPrevious /><CarouselNext /></>)}
        </Carousel>
      </div>
    </Card>
  );

  if (embedded) return body;
  return <section className="container mt-6">{body}</section>;
}

export function AdsRow() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("advertisements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(8).then(({ data }) => setItems(data ?? []));
  }, []);
  if (items.length === 0) return null;
  return (
    <section className="container mt-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((a) => {
          const inner = (
            <Card className="glass overflow-hidden hover:border-primary/40 transition-colors">
              <img src={a.image_url} alt={a.title} className="w-full h-32 object-cover" />
              {a.title && <div className="p-2 font-bold text-sm truncate">{a.title}</div>}
            </Card>
          );
          return a.link_url ? <a key={a.id} href={a.link_url} target="_blank" rel="noreferrer">{inner}</a> : <div key={a.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}
