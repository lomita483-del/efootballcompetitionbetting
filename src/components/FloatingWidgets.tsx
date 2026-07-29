import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DraggableFab } from "@/components/DraggableFab";
import { WIDGET_ICONS } from "@/lib/floating-widgets";

type Widget = {
  id: string;
  name: string;
  icon_name: string | null;
  image_url: string | null;
  destination_type: string;
  destination_value: string;
  position: string;
};

/** Admin-configurable floating icons rendered on every page. */
export function FloatingWidgets() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const load = () =>
      supabase
        .from("floating_widgets")
        .select("id,name,icon_name,image_url,destination_type,destination_value,position")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .then(({ data }) => { if (alive) setWidgets((data as Widget[]) ?? []); });
    load();
    const ch = supabase
      .channel("floating-widgets")
      .on("postgres_changes", { event: "*", schema: "public", table: "floating_widgets" }, () => load())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  return (
    <>
      {widgets.map((w, i) => {
        const Icon = WIDGET_ICONS[w.icon_name ?? ""] ?? WIDGET_ICONS.Sparkles;
        const go = () => {
          const to = w.destination_type === "tasks" ? "/tasks" : w.destination_value || "/";
          if (w.destination_type === "external" || /^https?:\/\//.test(to)) { window.open(to, "_blank", "noopener"); return; }
          navigate({ to });
        };
        return (
          <DraggableFab
            key={w.id}
            storageKey={`fab-widget-${w.id}`}
            defaultSide={w.position === "left" ? "left" : "right"}
            ariaLabel={w.name}
            onClick={go}
            className={i > 0 ? "mt-2" : ""}
          >
            <span className="flex items-center gap-2 rounded-full border border-primary/50 bg-card/90 py-2 pl-2 pr-3 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-gold text-background">
                {w.image_url
                  ? <img src={w.image_url} alt="" className="h-full w-full object-cover" />
                  : <Icon className="h-4.5 w-4.5" />}
              </span>
              <span className="max-w-[110px] truncate text-[11px] font-black uppercase tracking-wider text-primary">{w.name}</span>
            </span>
          </DraggableFab>
        );
      })}
    </>
  );
}
