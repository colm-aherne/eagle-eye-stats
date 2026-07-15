import { Link } from "@tanstack/react-router";
import { Home, Flag, BarChart3, User, Settings } from "lucide-react";

type NavPath = "/" | "/rounds" | "/stats" | "/profile" | "/settings";

const ITEMS: { to: NavPath; label: string; Icon: typeof Home }[] = [
  { to: "/stats", label: "Stats", Icon: BarChart3 },
  { to: "/rounds", label: "Rounds", Icon: Flag },
  { to: "/", label: "Home", Icon: Home },
  { to: "/profile", label: "Profile", Icon: User },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export function BottomNav() {
  return (
    <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/85 backdrop-blur-lg supports-[backdrop-filter]:bg-card/70"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-between gap-1 px-2 py-2">
          {ITEMS.map(({ to, label, Icon }) => {
            const isHome = to === "/";
            return (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: true }}
                activeProps={{ className: "active" }}
                className={
                  "group flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground [&.active]:text-primary " +
                  (isHome ? "relative" : "")
                }
                aria-label={label}
              >
                <span
                  className={
                    "flex items-center justify-center rounded-full transition-colors " +
                    (isHome
                      ? "-mt-6 h-12 w-12 border-4 border-background bg-primary text-primary-foreground shadow-lg shadow-primary/30 group-hover:bg-primary/90 group-[.active]:bg-primary"
                      : "h-8 w-8 group-[.active]:bg-primary/10")
                  }
                >
                  <Icon className={isHome ? "h-5 w-5" : "h-4 w-4"} />
                </span>
                <span className={isHome ? "mt-0" : ""}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
  );
}
