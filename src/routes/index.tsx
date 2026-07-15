import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { suggestCourses, type CourseSuggestion } from "@/lib/suggest-courses.functions";
import {
  emptyRound,
  STORAGE_KEY,
  TEE_META,
  type Round,
  type TeeColor,
} from "@/lib/round-types";
import { useSavedRounds } from "@/lib/use-saved-rounds";
import { useSettings, THEME_KEY } from "@/lib/settings";
import { useHomeCourse, useWidgetPrefs, type HomeCourse } from "@/lib/home-course";
import { rememberCourseLocation } from "@/lib/course-locations";
import { BrandHeader } from "@/components/BrandHeader";

import { CourseSearchInput } from "@/components/CourseSearchInput";
import { useIsSignedIn } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Plus, Loader2, Moon, Sun, Flag, Pencil, ScanLine, Home } from "lucide-react";
import { PENDING_SCAN_KEY } from "@/routes/round";

export const Route = createFileRoute("/")({
  component: Index,
});

const PLAYER_NAME_KEY = "fairway.playerName";
const HANDICAP_KEY = "fairway.handicap";
const HANDICAP_GOAL_KEY = "fairway.handicapGoal";

function Index() {
  const navigate = useNavigate();
  const { rounds: saved } = useSavedRounds();
  useSettings();
  const signedIn = useIsSignedIn();
  const { homeCourse, setHomeCourse } = useHomeCourse();
  const { prefs: widgets } = useWidgetPrefs();
  const [showNew, setShowNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const pickedHomeSuggestionRef = useRef<CourseSuggestion | null>(null);
  const [dark, setDark] = useState(false);

  const [playerName, setPlayerName] = useState<string>("");
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [homeCourseDraft, setHomeCourseDraft] = useState("");
  const [handicapDraft, setHandicapDraft] = useState("");
  const [handicapGoalDraft, setHandicapGoalDraft] = useState("");
  const [isFirstRun, setIsFirstRun] = useState(false);

  // If an upload came in before we knew the round setup, keep it queued
  const pendingUploadRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const enable = stored ? stored === "dark" : !!prefers;
    setDark(enable);
    document.documentElement.classList.toggle("dark", enable);
  }, []);

  useEffect(() => {
    const n = localStorage.getItem(PLAYER_NAME_KEY) ?? "";
    setPlayerName(n);
    if (!n) {
      setNameDraft("");
      setHomeCourseDraft("");
      setIsFirstRun(true);
      setShowNameDialog(true);
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  function startRound(
    holes: 9 | 18,
    tee: TeeColor,
    courseName = "",
    pars?: (number | null)[],
    distances?: (number | null)[],
  ) {
    const r = emptyRound(holes, tee);
    r.courseName = courseName;
    if (pars && pars.length === holes) r.pars = pars.slice();
    if (distances && distances.length === holes) r.distances = distances.slice();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r));

    // If an image was uploaded first, queue it for the round page to auto-scan
    if (pendingUploadRef.current) {
      sessionStorage.setItem(PENDING_SCAN_KEY, pendingUploadRef.current);
      pendingUploadRef.current = null;
    }
    setShowNew(false);
    navigate({ to: "/round" });
  }

  function saveName() {
    const n = nameDraft.trim();
    if (!n) {
      toast.error("Please enter your name");
      return;
    }
    localStorage.setItem(PLAYER_NAME_KEY, n);
    setPlayerName(n);
    const hc = homeCourseDraft.trim();
    if (isFirstRun && hc) {
      const s = pickedHomeSuggestionRef.current;
      setHomeCourse({ name: hc, suggestion: s && s.name === hc ? s : undefined });
      if (s && s.name === hc) rememberCourseLocation(hc, s.location);
      pickedHomeSuggestionRef.current = null;
    }
    if (isFirstRun) {
      const h = handicapDraft.trim();
      const g = handicapGoalDraft.trim();
      if (h !== "") localStorage.setItem(HANDICAP_KEY, h);
      if (g !== "") localStorage.setItem(HANDICAP_GOAL_KEY, g);
    }
    setShowNameDialog(false);
    setIsFirstRun(false);
    toast.success("Saved");
  }

  function openLastRound() {
    if (!saved[0]) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved[0]));
    navigate({ to: "/round" });
  }

  function startHomeCourseRound() {
    if (!homeCourse) return;
    const s = homeCourse.suggestion;
    const tee: TeeColor = "white";
    const teeData = s?.tees?.[tee];
    startRound(18, tee, homeCourse.name, teeData?.pars ?? s?.pars, teeData?.distances);
  }

  async function handleUploadFile(file: File) {
    if (!signedIn) {
      toast.message("Sign in to scan scorecards");
      navigate({ to: "/auth" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      pendingUploadRef.current = dataUrl;
      toast.message("Card ready — fill in the round details");
      setShowNew(true);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't read image");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <BrandHeader
        right={
          <>
            <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle dark mode">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <button
              onClick={() => {
                setNameDraft(playerName);
                setIsFirstRun(false);
                setShowNameDialog(true);
              }}
              className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
              aria-label="Edit your name"
            >
              <span className="max-w-[120px] truncate">{playerName || "Set name"}</span>
              <Pencil className="h-3 w-3" />
            </button>
          </>
        }
      />

      {/* Hero background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden"
      >
        <img
          src="/__l5e/assets-v1/5e691f9d-dc30-4b57-886d-5fd6203c3622/golf-green.png"
          alt=""
          className="h-full w-full object-cover opacity-40 dark:opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background" />
      </div>

      <main className="relative mx-auto max-w-3xl px-4 py-6">
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUploadFile(f);
          }}
        />

        {(widgets.upload || widgets.homeCourse || widgets.lastRound) && (
          <section className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dashboard
              </h2>
              <Link
                to="/settings"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Customize
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {widgets.upload && (
                <WidgetTile
                  icon={<ScanLine className="h-5 w-5" />}
                  label="Upload card"
                  hint={signedIn ? "Add the photo first, then round info" : "Sign in to scan cards"}
                  onClick={() => {
                    if (!signedIn) {
                      navigate({ to: "/auth" });
                      return;
                    }
                    uploadRef.current?.click();
                  }}
                  loading={uploading}
                />
              )}
              {widgets.homeCourse && homeCourse && (
                <WidgetTile
                  icon={<Home className="h-5 w-5" />}
                  label={homeCourse.name}
                  hint="Start 18 · white tees"
                  onClick={startHomeCourseRound}
                />
              )}
              {widgets.homeCourse && !homeCourse && (
                <WidgetTile
                  icon={<Home className="h-5 w-5" />}
                  label="Set home course"
                  hint="Prefill new rounds & scans"
                  onClick={() => {
                    setNameDraft(playerName);
                    setHomeCourseDraft("");
                    setIsFirstRun(true);
                    setShowNameDialog(true);
                  }}
                />
              )}
              {widgets.lastRound && saved[0] && (
                <WidgetTile
                  icon={<Flag className="h-5 w-5" />}
                  label={`Last: ${saved[0].courseName || "Round"}`}
                  hint={(() => {
                    const s = saved[0].scores.reduce<number>((a, b) => a + (b ?? 0), 0);
                    const p = saved[0].pars.reduce<number>((a, b) => a + (b ?? 0), 0);
                    const d = s - p;
                    return `${s || "—"} · ${p ? (d > 0 ? `+${d}` : d === 0 ? "E" : `${d}`) : "—"}`;
                  })()}
                  onClick={openLastRound}
                />
              )}
            </div>
          </section>
        )}

        <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
          <Flag className="h-12 w-12 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Start a new round</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick your course & tees, then choose how you'd like to enter scores.
            </p>
          </div>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="mr-1 h-4 w-4" /> New round
          </Button>
        </Card>


        {saved.length > 0 && (
          <div className="mt-6 text-center">
            <Link
              to="/rounds"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              View all {saved.length} saved rounds →
            </Link>
          </div>
        )}
      </main>

      <NewRoundDialog
        open={showNew}
        onOpenChange={(v) => {
          if (!v) pendingUploadRef.current = null;
          setShowNew(v);
        }}
        onStart={startRound}
        defaultCourse={homeCourse}
        pendingUpload={!!pendingUploadRef.current}
        signedIn={signedIn}
      />

      <Dialog
        open={showNameDialog}
        onOpenChange={(v) => {
          if (!v && !playerName) return;
          setShowNameDialog(v);
        }}
      >
        <DialogContent hideClose={isFirstRun}>
          <DialogHeader>
            <DialogTitle>{isFirstRun ? "Welcome to Eagle Eye Stats" : "Edit your name"}</DialogTitle>
            <DialogDescription>
              We use your name to pick the right column when scanning multi-player scorecards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Full name</label>
              <Input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="e.g. Colm Fanning"
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isFirstRun) saveName();
                }}
              />
            </div>
            {isFirstRun && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Home course</label>
                <CourseSearchInput
                  value={homeCourseDraft}
                  onChange={setHomeCourseDraft}
                  onPick={(s) => {
                    setHomeCourseDraft(s.name);
                    pickedHomeSuggestionRef.current = s;
                  }}
                  placeholder="e.g. Royal Portrush"
                  className="mt-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                  }}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  We'll prefill this when you start a new round or scan a card. You can still
                  search for other courses too, and change this later in Settings.
                </p>
              </div>
            )}
            {isFirstRun && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Handicap</label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={handicapDraft}
                    onChange={(e) => setHandicapDraft(e.target.value)}
                    placeholder="e.g. 14.2"
                    className="mt-1 h-14 text-lg"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Handicap goal in 30 days
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={handicapGoalDraft}
                    onChange={(e) => setHandicapGoalDraft(e.target.value)}
                    placeholder="e.g. 12.0"
                    className="mt-1 h-14 text-lg"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveName}>{isFirstRun ? "Get started" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewRoundDialog({
  open,
  onOpenChange,
  onStart,
  defaultCourse,
  pendingUpload,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStart: (
    holes: 9 | 18,
    tee: TeeColor,
    courseName?: string,
    pars?: (number | null)[],
    distances?: (number | null)[],
  ) => void;
  defaultCourse?: HomeCourse | null;
  pendingUpload?: boolean;
}) {
  const [holes, setHoles] = useState<9 | 18>(18);
  const [tee, setTee] = useState<TeeColor>("white");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CourseSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery(defaultCourse?.name ?? "");
      setPicked(defaultCourse?.suggestion ?? null);
      setSuggestions([]);
      setHoles(18);
      setTee("white");
    }
  }, [open, defaultCourse]);

  useEffect(() => {
    if (picked && picked.name === query) return;
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await suggestCourses({ data: { query: q, holes } });
        if (!cancelled) setSuggestions(res.suggestions);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, holes, picked]);

  function pick(s: CourseSuggestion) {
    setPicked(s);
    setQuery(s.name);
    setSuggestions([]);
    rememberCourseLocation(s.name, s.location);
  }

  function handleStart() {
    let pars = picked?.pars;
    let distances: (number | null)[] | undefined;
    if (picked) {
      const teeData = picked.tees?.[tee];
      if (teeData) {
        pars = teeData.pars ?? pars;
        distances = teeData.distances;
      }
    }
    onStart(holes, tee, picked?.name || query.trim(), pars, distances);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pendingUpload ? "Card uploaded — round details" : "Start new round"}</DialogTitle>
          <DialogDescription>
            {pendingUpload
              ? "Tell us the course & tees so we can scan the card correctly."
              : "Pick your course, how many holes, and which tees you're playing."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Course</label>
            <div className="relative mt-1">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPicked(null);
                }}
                placeholder="Start typing a course name…"
                autoFocus
              />
              {(loading || suggestions.length > 0) && !picked && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
                  {loading && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Searching courses…
                    </div>
                  )}
                  {suggestions.map((s, i) => {
                    const parSum = s.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
                    return (
                      <button
                        key={i}
                        onClick={() => pick(s)}
                        className="flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{s.name}</div>
                          {s.location && (
                            <div className="truncate text-xs text-muted-foreground">
                              {s.location}
                            </div>
                          )}
                        </div>
                        {parSum > 0 && (
                          <div className="text-xs tabular-nums text-muted-foreground">
                            Par {parSum}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Holes</label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              {[9, 18].map((h) => (
                <button
                  key={h}
                  onClick={() => setHoles(h as 9 | 18)}
                  className={`rounded-lg border-2 p-4 text-center transition-colors ${
                    holes === h
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="text-2xl font-bold">{h}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">holes</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Tees</label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {(["red", "yellow", "white", "blue"] as TeeColor[]).map((c) => {
                const active = tee === c;
                const meta = TEE_META[c];
                const hasData = !!picked?.tees?.[c];
                const yards = picked?.tees?.[c]?.distances?.reduce<number>(
                  (a, b) => a + (b ?? 0),
                  0,
                );
                return (
                  <button
                    key={c}
                    onClick={() => setTee(c)}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors ${
                      active
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <span className={`h-5 w-5 rounded-full ${meta.swatch}`} />
                    <span className="text-xs font-semibold">{meta.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {picked ? (hasData && yards ? `${yards} yds` : "—") : "tees"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {TEE_META[tee].description}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleStart}>{pendingUpload ? "Scan card" : "Start round"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WidgetTile({
  icon,
  label,
  hint,
  onClick,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 disabled:opacity-60"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{label}</div>
        {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </button>
  );
}
