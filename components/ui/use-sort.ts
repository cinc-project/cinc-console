"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flip,
  parseSort,
  serializeSort,
  type SortDir,
  type SortState,
} from "@/lib/sort";

/**
 * Read and write a list's sort from a URL query param, so a sort survives
 * reload and is shareable. `param` namespaces the list (two lists on one page —
 * e.g. members' Users and Groups — pass different params so they don't
 * collide). `def` is the sort used when the param is absent or invalid; `keys`
 * whitelists the sortable keys.
 *
 * `setSort(key)` flips the direction when `key` is already the active column,
 * otherwise switches to `key` ascending. The param is dropped from the URL when
 * it equals the default, keeping default links clean.
 */
export function useSort(
  param: string,
  def: SortState,
  keys: readonly string[],
): {
  sort: SortState;
  setSort: (key: string) => void;
  replaceSort: (next: SortState) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sort = parseSort(params.get(param), def, keys);

  /** Set an exact key + direction (the mobile sort picker chooses both at once). */
  const replaceSort = useCallback(
    (next: SortState) => {
      const qs = new URLSearchParams(params.toString());
      if (serializeSort(next) === serializeSort(def)) qs.delete(param);
      else qs.set(param, serializeSort(next));

      const query = qs.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, params, param, def],
  );

  const setSort = useCallback(
    (key: string) =>
      replaceSort(
        key === sort.key
          ? { key, dir: flip(sort.dir) }
          : { key, dir: "asc" as SortDir },
      ),
    [replaceSort, sort.key, sort.dir],
  );

  return { sort, setSort, replaceSort };
}
