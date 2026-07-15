import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { suggestCourses, type CourseSuggestion } from "@/lib/suggest-courses.functions";
import { useIsSignedIn } from "@/lib/use-session";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick?: (s: CourseSuggestion) => void;
  placeholder?: string;
  holes?: 9 | 18;
  autoFocus?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * Text input for entering / searching a golf course name with async AI
 * suggestions based on what the user has typed so far.
 */
export function CourseSearchInput({
  value,
  onChange,
  onPick,
  placeholder = "Start typing a course name…",
  holes = 18,
  autoFocus,
  className,
  onKeyDown,
}: Props) {
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const pickedRef = useRef<string | null>(null);
  const signedIn = useIsSignedIn();

  useEffect(() => {
    if (!signedIn) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    // If the user just picked a suggestion whose exact name matches, don't fetch again
    if (pickedRef.current && pickedRef.current === value) return;
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
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
  }, [value, holes, signedIn]);

  function handlePick(s: CourseSuggestion) {
    pickedRef.current = s.name;
    onChange(s.name);
    setSuggestions([]);
    onPick?.(s);
  }

  const showSignInHint = focused && !signedIn && value.trim().length >= 2;
  const showList = focused && signedIn && (loading || suggestions.length > 0);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Input
        value={value}
        onChange={(e) => {
          pickedRef.current = null;
          onChange(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {showSignInHint && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-popover p-3 text-xs shadow-md">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>
              <Link to="/auth" className="font-medium text-foreground underline underline-offset-2">
                Sign in
              </Link>{" "}
              to search courses. You can still type a name manually.
            </span>
          </div>
        </div>
      )}
      {showList && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
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
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(s)}
                className="flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  {s.location && (
                    <div className="truncate text-xs text-muted-foreground">{s.location}</div>
                  )}
                </div>
                {parSum > 0 && (
                  <div className="text-xs tabular-nums text-muted-foreground">Par {parSum}</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
