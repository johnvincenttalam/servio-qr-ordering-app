import { Search, X } from "lucide-react";

interface MenuSearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function MenuSearchBar({ value, onChange }: MenuSearchBarProps) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={2.2}
      />
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search menu..."
        aria-label="Search menu"
        className="h-11 w-full rounded-xl border border-border bg-muted pl-10 pr-10 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-colors focus:border-foreground/40 focus:bg-card focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
