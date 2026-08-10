import React from "react";
import { Card } from "@/components/ui/card";

/**
 * AdminDashboardLayout - Responsive grid system for admin dashboard
 * 
 * Layout structure (matches reference image):
 * DESKTOP (>1400px):
 * - Left column (1fr): Main content area
 *   - Broadcast Center (full width)
 *   - Live Game Stats (full width)
 *   - Top Platform + League Arena (full width)
 *   - 6-tile module grid (full width, 2x3)
 *   - Platform Police (full width)
 * - Right column (auto, ~300-400px): Sidebar widgets
 *   - Volatile statistics
 *   - Additional info cards
 *
 * MOBILE (<1024px):
 * - Single column (100% width)
 * - All sections stack vertically
 * - Tiles adapt to 1x6 or 2x3 depending on screen
 *
 * TABLET (1024px - 1399px):
 * - Single column with adjusted widths
 */

interface AdminDashboardLayoutProps {
  broadcastCenter?: React.ReactNode;
  liveGameStats?: React.ReactNode;
  topPlatform?: React.ReactNode;
  leagueArena?: React.ReactNode;
  moduleTiles?: React.ReactNode;
  platformPolice?: React.ReactNode;
  sidebar?: React.ReactNode;
  quickActions?: React.ReactNode;
}

export function AdminDashboardLayout({
  broadcastCenter,
  liveGameStats,
  topPlatform,
  leagueArena,
  moduleTiles,
  platformPolice,
  sidebar,
  quickActions,
}: AdminDashboardLayoutProps) {
  return (
    <div className="admin-dashboard-layout">
      {/* Main content wrapper */}
      <div className="admin-dashboard-main">
        {/* Broadcast Center */}
        {broadcastCenter && (
          <section className="admin-section broadcast-center-section">
            {broadcastCenter}
          </section>
        )}

        {/* Live Game Stats */}
        {liveGameStats && (
          <section className="admin-section live-stats-section">
            {liveGameStats}
          </section>
        )}

        {/* Top Platform + League Arena (2-column on desktop, stacked on mobile) */}
        <div className="admin-top-platform-arena-wrapper">
          {topPlatform && (
            <section className="admin-section top-platform-section">
              {topPlatform}
            </section>
          )}
          {leagueArena && (
            <section className="admin-section league-arena-section">
              {leagueArena}
            </section>
          )}
        </div>

        {/* 6-Tile Module Grid (2x3 or responsive) */}
        {moduleTiles && (
          <section className="admin-section module-tiles-section">
            <div className="admin-tiles-grid">
              {moduleTiles}
            </div>
          </section>
        )}

        {/* Platform Police */}
        {platformPolice && (
          <section className="admin-section platform-police-section">
            {platformPolice}
          </section>
        )}
      </div>

      {/* Right Sidebar (visible on desktop only) */}
      {sidebar && (
        <aside className="admin-dashboard-sidebar">
          {sidebar}
        </aside>
      )}

      {/* Quick Actions Grid (full width, below main content on mobile) */}
      {quickActions && (
        <section className="admin-section quick-actions-section">
          <div className="admin-quick-actions-grid">
            {quickActions}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Helper component for 6-tile grid (2 columns on desktop, auto on mobile)
 */
export function AdminTilesGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-tiles-grid">{children}</div>;
}

/**
 * Helper component for quick actions grid (dynamic columns)
 */
export function AdminQuickActionsGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-quick-actions-grid">{children}</div>;
}

/**
 * Individual tile/card component
 */
export function AdminTile({
  icon: Icon,
  label,
  children,
  className = "",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`admin-tile ${className}`}>
      {Icon && <Icon className="admin-tile-icon" />}
      {label && <h3 className="admin-tile-label">{label}</h3>}
      {children}
    </Card>
  );
}
