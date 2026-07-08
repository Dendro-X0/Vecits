"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { SORT_OPTIONS, type SortOption } from "@/lib/marketplace/lanes";

type MarketplaceFiltersProps = {
  pathname: string;
  initialQuery: string;
  initialSort: SortOption;
  signedIn?: boolean;
  baseUrl?: string;
  asOf?: string;
};

export function MarketplaceFilters({
  pathname,
  initialQuery,
  initialSort,
  signedIn = false,
  baseUrl,
  asOf
}: MarketplaceFiltersProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortOption>(initialSort);

  const sortOptions = SORT_OPTIONS.filter((option) => signedIn || option.guestAllowed);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (sort !== "newest") {
      params.set("sort", sort);
    }
    if (baseUrl) {
      params.set("base_url", baseUrl);
    }
    if (asOf) {
      params.set("as_of", asOf);
    }
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search listings…"
        className="h-10 sm:w-64"
        aria-label="Search listings"
      />

      <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
        <SelectTrigger className="h-10 w-full min-w-[11rem] sm:w-[12rem]" aria-label="Sort listings">
          <SelectValue placeholder="Sort listings" />
        </SelectTrigger>
        <SelectContent align="end">
          {sortOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" className="h-10 px-4">
        Apply
      </Button>
    </form>
  );
}
