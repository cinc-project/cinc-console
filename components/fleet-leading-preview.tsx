import { cn } from "@/lib/utils";
import { IconCheck, IconWarning, IconQuestion } from "@/components/ui/icons";
import {
  HistogramSkeleton,
  ListSkeleton,
  TILE_BOX,
  TILE_GRID,
  TileSkeleton,
} from "@/components/fleet-skeleton";
import type { FleetCounts } from "@/lib/cinc/fleet-counts";

/**
 * The fast first-paint of the dashboard, shown inside the Suspense fallback
 * while the heavy fleet sweep loads. The Recent, Missing and Unconfigured
 * counts come from cheap `rows=0` searches (resolved by `countsPromise`), so
 * they appear well before the full snapshot. The Outdated tile, the histogram
 * and the node list still need the sweep — they stay skeletons here and the interactive `FleetDashboard`
 * replaces this whole preview once the snapshot lands.
 *
 * These tiles are intentionally non-interactive: there's no node list yet for a
 * tile filter to act on, so they render as plain cards, not filter buttons.
 */
export async function LeadingPreview({
  countsPromise,
}: {
  countsPromise: Promise<FleetCounts>;
}) {
  const counts = await countsPromise;
  return (
    <div className="space-y-6">
      <p role="status" className="sr-only">
        Loaded the fleet summary; loading the node list…
      </p>
      <div className={TILE_GRID}>
        <PreviewTile
          label="Checked in · last hour"
          help="Reported within the hour"
          count={counts.recent}
          tone="success"
          icon={<IconCheck />}
        />
        <PreviewTile
          label="Missing"
          help="No check-in in 12 hours"
          count={counts.missing}
          tone="danger"
          icon={<IconWarning />}
        />
        <PreviewTile
          label="Unconfigured"
          help="Empty run list or left in _default"
          count={counts.unconfigured}
          tone="warn"
          icon={<IconQuestion />}
        />
        {/* Outdated classification needs the full sweep + lifecycle data. */}
        <TileSkeleton label="Outdated clients" />
      </div>
      <HistogramSkeleton />
      <ListSkeleton />
    </div>
  );
}

function PreviewTile({
  label,
  help,
  count,
  tone,
  icon,
}: {
  label: string;
  help: string;
  count: number | null;
  tone: "success" | "danger" | "warn";
  icon: React.ReactNode;
}) {
  const toneText = {
    success: "text-success",
    danger: "text-danger",
    warn: "text-warn",
  }[tone];
  return (
    <div className={TILE_BOX}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-text">{label}</span>
        <span className={cn("mt-0.5 shrink-0", toneText)} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums sm:mt-2 sm:text-3xl", toneText)}>
        {count === null ? "—" : count}
      </div>
      <div className="mt-1 text-xs text-muted">{help}</div>
    </div>
  );
}
