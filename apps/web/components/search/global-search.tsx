"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  filterGlobalSearchItems,
  groupGlobalSearchItems,
  type GlobalSearchItem
} from "@/lib/search/global-search-items";
import { cn } from "@/lib/utils";

type GlobalSearchContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

export function useGlobalSearch(): GlobalSearchContextValue {
  const value = useContext(GlobalSearchContext);
  if (!value) {
    throw new Error("useGlobalSearch must be used within GlobalSearchProvider");
  }
  return value;
}

/** Safe for chrome that may render outside the provider during SSR edge cases. */
export function useOptionalGlobalSearch(): GlobalSearchContextValue | null {
  return useContext(GlobalSearchContext);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isBackShortcut(event: KeyboardEvent): boolean {
  const mod = event.metaKey || event.ctrlKey;
  return (
    (event.altKey && event.key === "ArrowLeft") ||
    (mod && !event.altKey && event.key === "[")
  );
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const toggle = useCallback(() => setOpen((previous) => !previous), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      if (mod && key === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
        return;
      }
      if (isBackShortcut(event) && !isTypingTarget(event.target)) {
        event.preventDefault();
        if (open) {
          setOpen(false);
          return;
        }
        router.back();
        return;
      }
      if (event.key === "/" && !mod && !event.altKey && !isTypingTarget(event.target)) {
        // Help page owns "/" for in-sidebar search; skip there.
        if (window.location.pathname.startsWith("/help")) {
          return;
        }
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, router]);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  return (
    <GlobalSearchContext.Provider value={value}>
      {children}
      <GlobalSearchDialog />
    </GlobalSearchContext.Provider>
  );
}

export function GlobalSearchTrigger({
  className,
  compact = false
}: {
  className?: string;
  compact?: boolean;
}) {
  const search = useOptionalGlobalSearch();
  if (!search) {
    return null;
  }

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      type="button"
      onClick={() => search.setOpen(true)}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground",
        compact && "size-8 justify-center px-0",
        className
      )}
      aria-label="Open global search"
    >
      <Search className="size-4 shrink-0" aria-hidden="true" />
      {compact ? null : (
        <>
          <span className="hidden sm:inline">Search</span>
          <kbd className="pointer-events-none hidden rounded border border-border/70 bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            {isMac ? "⌘K" : "Ctrl+K"}
          </kbd>
        </>
      )}
    </button>
  );
}

function GlobalSearchDialog() {
  const { open, setOpen } = useGlobalSearch();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const titleId = useId();

  const filtered = useMemo(() => filterGlobalSearchItems(query), [query]);
  const grouped = useMemo(() => groupGlobalSearchItems(filtered), [filtered]);
  const flat = filtered;

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const selectItem = useCallback(
    (item: GlobalSearchItem) => {
      setOpen(false);
      router.push(item.href);
    },
    [router, setOpen]
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh] sm:pt-[15vh]">
      <button
        type="button"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        aria-label="Close search"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[81] flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        <h2 id={titleId} className="sr-only">
          Global search
        </h2>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, settings, help…"
            aria-label="Search Vectis"
            aria-controls={listId}
            aria-autocomplete="list"
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(flat.length - 1, 0)));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const item = flat[activeIndex];
                if (item) {
                  selectItem(item);
                }
              }
            }}
          />
          <kbd className="hidden rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div id={listId} role="listbox" className="max-h-[min(24rem,50vh)] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            grouped.map((group) => (
              <div key={group.group} className="mb-2 last:mb-0">
                <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const index = flat.findIndex((entry) => entry.id === item.id);
                    const active = index === activeIndex;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={cn(
                            "flex w-full flex-col rounded-lg px-3 py-2 text-left transition",
                            active
                              ? "bg-primary/10 text-foreground ring-1 ring-primary/25"
                              : "text-foreground hover:bg-muted/60"
                          )}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectItem(item)}
                        >
                          <span className="text-sm font-medium">{item.title}</span>
                          {item.description ? (
                            <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ navigate · Enter open · Esc close</span>
          <span className="hidden sm:inline">Ctrl/⌘K search · Alt+← back</span>
        </div>
      </div>
    </div>
  );
}
