import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { CHECKIN_BUCKETS } from "@/lib/cinc/fleet";

/** Bar area height in px; bar heights scale to the tallest bucket. */
const CHART_PX = 64;

/**
 * Last-check-in histogram: node counts per CHECKIN_BUCKETS entry, split into a
 * "checked in" group and a "missing" group at the 12h threshold. Meaning is
 * carried by the visible group captions and labels, not just bar color, and
 * each bucket has an SR-only sentence so the chart reads as a list.
 */
export function CheckInHistogram({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const buckets = CHECKIN_BUCKETS.map((b, i) => ({ ...b, count: counts[i] ?? 0 }));
  const present = buckets.filter((b) => !b.missing);
  const missing = buckets.filter((b) => b.missing);

  return (
    <Card>
      <h2 id="checkin-histogram" className="text-sm font-medium text-text">
        Last check-in
      </h2>
      <div className="mt-3 flex gap-3" role="group" aria-labelledby="checkin-histogram">
        <BucketGroup caption="Checked in" buckets={present} max={max} />
        <BucketGroup
          caption="Missing · over 12h"
          buckets={missing}
          max={max}
          className="border-l-2 border-dashed border-danger pl-3"
          captionClass="text-danger"
        />
      </div>
    </Card>
  );
}

type Bucket = (typeof CHECKIN_BUCKETS)[number] & { count: number };

function BucketGroup({
  caption,
  buckets,
  max,
  className,
  captionClass,
}: {
  caption: string;
  buckets: Bucket[];
  max: number;
  className?: string;
  captionClass?: string;
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-col", className)}
      style={{ flexGrow: buckets.length, flexBasis: 0 }}
    >
      <p className={cn("mb-1 text-xs font-medium text-muted", captionClass)}>
        {caption}
      </p>
      <ul className="flex flex-1 items-end gap-1.5">
        {buckets.map((b) => (
          <li key={b.label} className="flex min-w-0 flex-1 flex-col items-center">
            <span className="sr-only">
              {b.count} {b.count === 1 ? "node" : "nodes"}{" "}
              {b.maxMs === null ? "never checked in" : `last checked in ${b.description}`}
            </span>
            <span aria-hidden="true" className="text-xs tabular-nums text-muted">
              {b.count}
            </span>
            <span
              aria-hidden="true"
              className="flex w-full items-end"
              style={{ height: CHART_PX }}
            >
              <span
                className={cn(
                  "w-full rounded-t-sm",
                  b.maxMs === null ? "bg-muted" : b.missing ? "bg-danger" : "bg-success",
                )}
                // A zero bucket keeps a hairline so the axis stays readable.
                style={{
                  height:
                    b.count === 0 ? 1 : Math.max(3, (b.count / max) * CHART_PX),
                  opacity: b.count === 0 ? 0.4 : 1,
                }}
              />
            </span>
            <span
              aria-hidden="true"
              className="mt-1 truncate text-[11px] text-muted"
            >
              {b.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
