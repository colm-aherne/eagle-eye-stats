import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { Search, X, Trash2, Flag, Plus } from "lucide-react";
import { STORAGE_KEY, TEE_META, type Round, type TeeColor } from "@/lib/round-types";
import { useSavedRounds } from "@/lib/use-saved-rounds";
import { THEME_KEY } from "@/lib/settings";

export const Route = createFileRoute("/rounds")({
  head: () => ({
    meta: [
      { title: "Saved rounds — Eagle Eye Stats" },
      { name: "description", content: "Browse and search every round you've saved." },
    ],
  }),
  component: RoundsPage,
});

function RoundsPage() {
  const { rounds: saved, remove } = useSavedRounds();
  const [filterQuery, setFilterQuery] = useState("");
  const [filterTee, setFilterTee] = useState<"all" | TeeColor>("all");
  const [filterHoles, setFilterHoles] = useState<"all" | 9 | 18>("all");

  // Preserve dark-mode preference set on the home screen
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const enable = stored ? stored === "dark" : !!prefers;
    document.documentElement.classList.toggle("dark", enable);
  }, []);

  function openRound(r: Round) {
    // Load this round into the in-progress slot and jump to home
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  }

  const filtered = saved.filter((r) => {
    if (filterTee !== "all" && r.tee !== filterTee) return false;
    if (filterHoles !== "all" && r.holes !== filterHoles) return false;
    if (
      filterQuery.trim() &&
      !r.courseName.toLowerCase().includes(filterQuery.trim().toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <BrandHeader />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Saved rounds
            </h2>
            <span className="text-xs text-muted-foreground">
              {filtered.length} / {saved.length}
            </span>
          </div>

          <Card className="mb-3 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Search saved courses…"
                  className="h-8 pl-7 pr-7 text-sm"
                />
                {filterQuery && (
                  <button
                    onClick={() => setFilterQuery("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex gap-1">
                {(["all", 9, 18] as const).map((h) => (
                  <button
                    key={String(h)}
                    onClick={() => setFilterHoles(h)}
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      filterHoles === h
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {h === "all" ? "All" : `${h}`}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setFilterTee("all")}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                    filterTee === "all"
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  All
                </button>
                {(["red", "yellow", "white", "blue"] as TeeColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setFilterTee(c)}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                      filterTee === c
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                    }`}
                    aria-label={`Filter ${c} tees`}
                  >
                    <span className={`h-3 w-3 rounded-full ${TEE_META[c].swatch}`} />
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {saved.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <Flag className="h-10 w-10 text-muted-foreground" />
              <div>
                <h3 className="text-base font-semibold">No rounds saved yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start a round from your home screen and it'll show up here.
                </p>
              </div>
              <Button asChild size="sm">
                <Link to="/">
                  <Plus className="mr-1 h-4 w-4" /> Go home
                </Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const score = r.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
                const par = r.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
                const diff = score - par;
                const date = new Date(r.savedAt ?? r.startedAt);
                const dateStr = date.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                return (
                  <Card
                    key={r.id}
                    className="flex items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/40"
                  >
                    <Link
                      to="/round"
                      onClick={() => openRound(r)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {r.holes}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">
                          {r.courseName || "Unnamed course"}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${TEE_META[r.tee].swatch}`}
                          />
                          <span className="capitalize">{r.tee} tees</span>
                          <span>·</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold tabular-nums">
                          {score || "—"}
                        </div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {par ? (diff > 0 ? `+${diff}` : diff === 0 ? "E" : `${diff}`) : "—"}
                        </div>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this saved round?")) remove(r.id);
                      }}
                      aria-label="Delete round"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
