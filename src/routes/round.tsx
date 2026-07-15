import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandHeader } from "@/components/BrandHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Camera, Upload, Loader2, Save, ScanLine, Flag, Pencil } from "lucide-react";
import { STORAGE_KEY, TEE_META, type Round, type TeeColor } from "@/lib/round-types";
import { useSavedRounds } from "@/lib/use-saved-rounds";
import { useSettings, convertDistance, unitLabel, THEME_KEY } from "@/lib/settings";
import { scanScorecard } from "@/lib/scan-scorecard.functions";
import { useIsSignedIn } from "@/lib/use-session";

const PLAYER_NAME_KEY = "fairway.playerName";
export const PENDING_SCAN_KEY = "eagleeye.pendingScan.v1";

export const Route = createFileRoute("/round")({
  head: () => ({
    meta: [
      { title: "Round — Eagle Eye Stats" },
      { name: "description", content: "Enter and track your current round." },
    ],
  }),
  component: RoundPage,
});

function migrate(r: any): Round {
  return {
    id: r.id ?? crypto.randomUUID(),
    holes: r.holes === 9 ? 9 : 18,
    courseName: r.courseName ?? "",
    tee: (r.tee as TeeColor) ?? "white",
    startedAt: r.startedAt ?? Date.now(),
    savedAt: r.savedAt,
    pars: Array.isArray(r.pars) ? r.pars : Array(r.holes ?? 18).fill(null),
    scores: Array.isArray(r.scores) ? r.scores : Array(r.holes ?? 18).fill(null),
    distances: Array.isArray(r.distances) ? r.distances : Array(r.holes ?? 18).fill(null),
  };
}

function RoundPage() {
  const navigate = useNavigate();
  const { upsert } = useSavedRounds();
  const { unit } = useSettings();
  const signedIn = useIsSignedIn();
  const [round, setRound] = useState<Round | null>(null);
  const [entryStarted, setEntryStarted] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const autoRanRef = useRef(false);

  // Theme persistence
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const enable = stored ? stored === "dark" : !!prefers;
    document.documentElement.classList.toggle("dark", enable);
  }, []);

  useEffect(() => {
    setPlayerName(localStorage.getItem(PLAYER_NAME_KEY) ?? "");
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const r = migrate(JSON.parse(raw));
        setRound(r);
        setEntryStarted(r.scores.some((s) => s != null));
      }
    } catch (e) {
      console.error("Failed to load saved round from localStorage", e);
    }
  }, []);

  useEffect(() => {
    if (round) localStorage.setItem(STORAGE_KEY, JSON.stringify(round));
  }, [round]);

  async function runScan(dataUrl: string, r: Round) {
    if (!signedIn) {
      toast.message("Sign in to scan scorecards");
      navigate({ to: "/auth" });
      return;
    }
    setScanning(true);
    try {
      const result = await scanScorecard({
        data: {
          imageDataUrl: dataUrl,
          holes: r.holes,
          playerName: (localStorage.getItem(PLAYER_NAME_KEY) ?? "") || undefined,
        },
      });
      setRound({
        ...r,
        courseName: result.courseName || r.courseName,
        pars: result.pars?.map((p, i) => p ?? r.pars[i]) ?? r.pars,
        scores: result.scores.map((s, i) => s ?? r.scores[i]),
      });
      setEntryStarted(true);
      if (result.matchedPlayer) toast.success(`Scanned — matched: ${result.matchedPlayer}`);
      else toast.success("Scorecard scanned");
    } catch (e: any) {
      toast.error(e?.message || "Scan failed");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  // Auto-run pending scan if home queued one
  useEffect(() => {
    if (!round || autoRanRef.current) return;
    const pending = sessionStorage.getItem(PENDING_SCAN_KEY);
    if (pending) {
      autoRanRef.current = true;
      sessionStorage.removeItem(PENDING_SCAN_KEY);
      if (signedIn) {
        runScan(pending, round);
      } else {
        toast.message("Sign in to scan the uploaded card");
        navigate({ to: "/auth" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, signedIn]);

  async function handleFile(file: File) {
    if (!round) return;
    if (!signedIn) {
      toast.message("Sign in to scan scorecards");
      navigate({ to: "/auth" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image too large (max 8MB)");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    });
    await runScan(dataUrl, round);
  }

  function updateScore(i: number, v: string) {
    if (!round) return;
    const n = v === "" ? null : Math.max(1, Math.min(20, parseInt(v, 10) || 0));
    const next = [...round.scores];
    next[i] = n;
    setRound({ ...round, scores: next });
  }
  function updatePar(i: number, v: string) {
    if (!round) return;
    const n = v === "" ? null : Math.max(3, Math.min(6, parseInt(v, 10) || 0));
    const next = [...round.pars];
    next[i] = n;
    setRound({ ...round, pars: next });
  }

  async function saveRound() {
    if (!round) return;
    const toSave: Round = { ...round, savedAt: Date.now() };
    try {
      await upsert(toSave);
    } catch (e) {
      console.error("Failed to save round", e);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    setRound(null);
    setEntryStarted(false);
    toast.success("Round saved");
    navigate({ to: "/" });
  }

  const totals = useMemo(() => {
    if (!round) return { score: 0, par: 0, diff: 0, played: 0, yards: 0 };
    const score = round.scores.reduce<number>((a, b) => a + (b ?? 0), 0);
    const par = round.pars.reduce<number>((a, b) => a + (b ?? 0), 0);
    const yards = round.distances.reduce<number>((a, b) => a + (b ?? 0), 0);
    const played = round.scores.filter((s) => s != null).length;
    return { score, par, diff: score - par, played, yards };
  }, [round]);

  if (!round) {
    return (
      <div className="min-h-screen bg-background">
        <Toaster richColors position="top-center" />
        <BrandHeader />
        <main className="mx-auto max-w-3xl px-4 py-6">
          <Card className="flex flex-col items-center justify-center gap-4 p-10 text-center">
            <Flag className="h-12 w-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">No round in progress</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start a new round from your home screen.
              </p>
            </div>
            <Button asChild>
              <Link to="/">Go home</Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-center" />
      <BrandHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {!entryStarted ? (
          <Card className="p-6">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {round.courseName || "New round"} · {round.holes} holes ·{" "}
                <span className="capitalize">{round.tee} tees</span>
              </div>
              <h2 className="mt-1 text-xl font-semibold">How do you want to enter scores?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick one — you can fix anything after.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={() => {
                  if (!signedIn) {
                    navigate({ to: "/auth" });
                    return;
                  }
                  cameraRef.current?.click();
                }}
                disabled={scanning}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-5 text-center transition-colors hover:border-primary/60 hover:bg-accent/40 disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                </span>
                <span className="text-sm font-semibold">Take photo</span>
                <span className="text-[11px] text-muted-foreground">
                  {signedIn ? "Use your camera" : "Sign in required"}
                </span>
              </button>
              <button
                onClick={() => {
                  if (!signedIn) {
                    navigate({ to: "/auth" });
                    return;
                  }
                  fileRef.current?.click();
                }}
                disabled={scanning}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-5 text-center transition-colors hover:border-primary/60 hover:bg-accent/40 disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {scanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                </span>
                <span className="text-sm font-semibold">Upload image</span>
                <span className="text-[11px] text-muted-foreground">
                  {signedIn ? "Pick from library" : "Sign in required"}
                </span>
              </button>
              <button
                onClick={() => setEntryStarted(true)}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-border bg-card p-5 text-center transition-colors hover:border-primary/60 hover:bg-accent/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Pencil className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold">Enter manually</span>
                <span className="text-[11px] text-muted-foreground">Type hole by hole</span>
              </button>
            </div>

            {playerName && (
              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Scans will match against <span className="font-medium text-foreground">{playerName}</span>
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-[180px] flex-1">
                  <label className="text-xs font-medium text-muted-foreground">Course</label>
                  <Input
                    value={round.courseName}
                    onChange={(e) => setRound({ ...round, courseName: e.target.value })}
                    placeholder="Course name"
                    className="mt-1"
                  />
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`inline-block h-3 w-3 rounded-full ${TEE_META[round.tee].swatch}`} />
                    <span className="font-medium capitalize text-foreground">{round.tee} tees</span>
                    {totals.yards > 0 && (
                      <span>· {convertDistance(totals.yards, unit)} {unitLabel(unit)} total</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="Holes" value={`${totals.played}/${round.holes}`} />
                  <Stat label="Score" value={totals.score || "—"} />
                  <Stat
                    label="vs Par"
                    value={totals.par ? (totals.diff > 0 ? `+${totals.diff}` : `${totals.diff}`) : "—"}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col gap-1 h-auto py-2 px-1 sm:flex-row sm:h-9 sm:py-2 sm:px-3"
                  onClick={() => {
                    if (!signedIn) {
                      navigate({ to: "/auth" });
                      return;
                    }
                    cameraRef.current?.click();
                  }}
                  disabled={scanning}
                >
                  {scanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="h-4 w-4" />
                  )}
                  <span className="text-[11px] sm:text-sm sm:ml-2">
                    {signedIn ? "Rescan" : "Sign in to rescan"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col gap-1 h-auto py-2 px-1 sm:flex-row sm:h-9 sm:py-2 sm:px-3"
                  onClick={() => {
                    if (!signedIn) {
                      navigate({ to: "/auth" });
                      return;
                    }
                    fileRef.current?.click();
                  }}
                  disabled={scanning}
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-[11px] sm:text-sm sm:ml-2">
                    {signedIn ? "Upload image" : "Sign in to upload"}
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-col gap-1 h-auto py-2 px-1 sm:flex-row sm:h-9 sm:py-2 sm:px-3"
                  onClick={saveRound}
                >
                  <Save className="h-4 w-4" />
                  <span className="text-[11px] sm:text-sm sm:ml-2">Save round</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-col gap-1 h-auto py-2 px-1 sm:flex-row sm:h-9 sm:py-2 sm:px-3"
                  onClick={() => {
                    if (confirm("Clear all scores for this round?")) {
                      setRound({ ...round, scores: Array(round.holes).fill(null) });
                    }
                  }}
                >
                  <span className="text-[11px] sm:text-sm">Clear scores</span>
                </Button>
              </div>
            </Card>

            <ScorecardTable round={round} updateScore={updateScore} updatePar={updatePar} unit={unit} />
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-[64px] rounded-md bg-muted px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ScorecardTable({
  round,
  updateScore,
  updatePar,
  unit,
}: {
  round: Round;
  updateScore: (i: number, v: string) => void;
  updatePar: (i: number, v: string) => void;
  unit: "yards" | "meters";
}) {
  const groups: number[][] =
    round.holes === 9
      ? [[...Array(9).keys()]]
      : [[...Array(9).keys()], [...Array(9).keys()].map((i) => i + 9)];

  return (
    <div className="space-y-4">
      {groups.map((idxs, gi) => {
        const parSum = idxs.reduce((a, i) => a + (round.pars[i] ?? 0), 0);
        const scoreSum = idxs.reduce((a, i) => a + (round.scores[i] ?? 0), 0);
        const ydsSum = idxs.reduce((a, i) => a + (round.distances[i] ?? 0), 0);
        const label = round.holes === 9 ? "Holes" : gi === 0 ? "Front 9" : "Back 9";
        return (
          <Card key={gi} className="overflow-hidden">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2">
              <h3 className="text-sm font-semibold">{label}</h3>
              <div className="text-xs text-muted-foreground">
                Par {parSum || "—"} · Score {scoreSum || "—"}
                {ydsSum > 0 && ` · ${convertDistance(ydsSum, unit)} ${unitLabel(unit)}`}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="px-3 py-2 text-left text-xs font-medium">Hole</th>
                    {idxs.map((i) => (
                      <th key={i} className="w-12 px-1 py-2 text-center text-xs font-medium">
                        {i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {round.distances.some((d) => d != null) && (
                    <tr className="border-t">
                      <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        {unit === "meters" ? "Meters" : "Yards"}
                      </td>
                      {idxs.map((i) => (
                        <td key={i} className="p-1 text-center text-xs tabular-nums text-muted-foreground">
                          {round.distances[i] != null ? convertDistance(round.distances[i]!, unit) : "—"}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs font-medium text-muted-foreground">Par</td>
                    {idxs.map((i) => (
                      <td key={i} className="p-1">
                        <input
                          inputMode="numeric"
                          value={round.pars[i] ?? ""}
                          onChange={(e) => updatePar(i, e.target.value)}
                          className="h-9 w-full rounded-sm border border-input bg-background text-center text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs font-medium">Score</td>
                    {idxs.map((i) => {
                      const s = round.scores[i];
                      const p = round.pars[i];
                      const diff = s != null && p != null ? s - p : null;
                      const tone =
                        diff == null
                          ? ""
                          : diff < 0
                            ? "ring-2 ring-emerald-500/60"
                            : diff === 0
                              ? ""
                              : diff === 1
                                ? "ring-1 ring-amber-500/50"
                                : "ring-2 ring-rose-500/50";
                      return (
                        <td key={i} className="p-1">
                          <input
                            inputMode="numeric"
                            value={s ?? ""}
                            onChange={(e) => updateScore(i, e.target.value)}
                            className={`h-10 w-full rounded-sm border border-input bg-background text-center text-base font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-ring ${tone}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
