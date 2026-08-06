import { useRouterState } from "@tanstack/react-router";
import { TourGuide } from "@/components/TourGuide";
import { resolveTour } from "@/lib/tour-registry";

/**
 * Mounts the guided tour that belongs to the current page. Rendered once from
 * the shared Layout so every player and admin page is covered automatically.
 */
export function PageTour() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tour = resolveTour(pathname);
  if (!tour) return null;
  return <TourGuide key={tour.key} tourKey={tour.key} pageName={tour.name} steps={tour.steps} />;
}
