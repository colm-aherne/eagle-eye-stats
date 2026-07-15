import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { MapPin, Flag } from "lucide-react";
import type { Round } from "@/lib/round-types";
import { useCourseLocations } from "@/lib/course-locations";
import { useHomeCourse } from "@/lib/home-course";

// Deterministic pseudo-random position for a course name so pins are
// stable but spread across the panel.
function hashPos(name: string): { x: number; y: number } {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 1000) / 1000;
  const b = ((Math.imul(h, 2246822519) >>> 0) % 1000) / 1000;
  // Keep pins inside the middle 80% of the panel
  return { x: 8 + a * 84, y: 12 + b * 72 };
}

export function CoursesPlayedMap({ rounds }: { rounds: Round[] }) {
  const locations = useCourseLocations();
  const { homeCourse } = useHomeCourse();

  const played = useMemo(() => {
    const map = new Map<string, { name: string; count: number; location?: string }>();
    for (const r of rounds) {
      const n = r.courseName?.trim();
      if (!n) continue;
      const prev = map.get(n);
      if (prev) prev.count += 1;
      else
        map.set(n, {
          name: n,
          count: 1,
          location:
            locations[n] ||
            (homeCourse?.name === n ? homeCourse.suggestion?.location ?? undefined : undefined),
        });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rounds, locations, homeCourse]);

  const totalCourses = played.length;
  const totalRounds = rounds.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Courses played</h3>
          <p className="text-[11px] text-muted-foreground">
            Based on the scorecards you've handed in
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold leading-none tabular-nums text-primary">
            {totalCourses}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {totalCourses === 1 ? "course" : "courses"}
          </div>
        </div>
      </div>

      {/* Stylized map panel */}
      <div className="relative h-56 w-full overflow-hidden bg-gradient-to-br from-emerald-100 via-emerald-50 to-sky-100 dark:from-emerald-950 dark:via-emerald-900/50 dark:to-sky-950">
        {/* Faux terrain grid */}
        <svg
          className="absolute inset-0 h-full w-full text-emerald-600/15 dark:text-emerald-300/10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        {/* Blobs to imply landmass */}
        <div className="absolute -left-10 top-10 h-32 w-40 rounded-full bg-emerald-400/30 blur-2xl dark:bg-emerald-500/20" />
        <div className="absolute right-4 top-20 h-40 w-52 rounded-full bg-sky-300/40 blur-2xl dark:bg-sky-500/15" />
        <div className="absolute bottom-4 left-1/3 h-24 w-40 rounded-full bg-emerald-500/25 blur-2xl dark:bg-emerald-400/15" />

        {played.length === 0 ? (
          <div className="relative flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Flag className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Save a round to drop your first pin on the map.
            </p>
          </div>
        ) : (
          played.slice(0, 20).map((c) => {
            const { x, y } = hashPos(c.name);
            return (
              <div
                key={c.name}
                className="group absolute -translate-x-1/2 -translate-y-full"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="flex flex-col items-center">
                  <div className="rounded-full bg-primary p-1.5 shadow-md shadow-primary/30 ring-2 ring-background">
                    <Flag className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <div className="mt-1 max-w-[140px] truncate rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium shadow-sm">
                    {c.name}
                    {c.count > 1 && (
                      <span className="ml-1 text-muted-foreground">×{c.count}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {played.length > 0 && (
        <ul className="divide-y">
          {played.slice(0, 8).map((c) => (
            <li key={c.name} className="flex items-center gap-3 px-4 py-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                {c.location && (
                  <div className="truncate text-xs text-muted-foreground">{c.location}</div>
                )}
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                {c.count} {c.count === 1 ? "round" : "rounds"}
              </div>
            </li>
          ))}
        </ul>
      )}
      {played.length > 0 && (
        <div className="border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          {totalRounds} {totalRounds === 1 ? "round" : "rounds"} across {totalCourses}{" "}
          {totalCourses === 1 ? "course" : "courses"}
        </div>
      )}
    </Card>
  );
}
