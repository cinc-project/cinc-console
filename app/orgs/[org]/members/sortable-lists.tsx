"use client";

import Link from "next/link";
import { RemoveUserButton } from "./remove-user-button";
import { SortableTh } from "@/components/ui/sortable";
import { useSort } from "@/components/ui/use-sort";
import { applyDir, byString, type SortState } from "@/lib/sort";
import type { ActionResult } from "@/lib/cinc/action";

// Both lists sort by name only; each takes its own URL param so the Users and
// Groups sorts on this one page don't collide.
const KEYS = ["name"] as const;
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" };

/**
 * A user row plus its pre-bound remove action (created on the server). `admin`
 * is null when the admins group couldn't be read, so the role is unknown.
 */
export type UserItem = {
  name: string;
  admin: boolean | null;
  onRemove: () => Promise<ActionResult>;
};

export function UsersList({ items }: { items: UserItem[] }) {
  const { sort, setSort } = useSort("users", DEFAULT_SORT, KEYS);
  const sorted = [...items].sort((a, b) =>
    applyDir(byString(a.name, b.name), sort.dir),
  );
  // Plain members can't read admins; show no role column rather than a guess.
  const showRole = items.some((u) => u.admin !== null);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Users, sortable by username</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <SortableTh
              label="Username"
              sortKey="name"
              sort={sort}
              onSort={setSort}
            />
            {showRole && (
              <th scope="col" className="px-4 py-2 font-medium">
                Role
              </th>
            )}
            <th scope="col" className="px-4 py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((u) => (
            <tr key={u.name} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-text">{u.name}</td>
              {showRole && (
                <td className="px-4 py-2 text-muted">{u.admin ? "Admin" : "Member"}</td>
              )}
              <td className="px-4 py-2">
                <div className="flex justify-end">
                  <RemoveUserButton
                    username={u.name}
                    admin={u.admin === true}
                    onRemove={u.onRemove}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GroupsList({
  basePath,
  names,
}: {
  basePath: string;
  names: string[];
}) {
  const { sort, setSort } = useSort("groups", DEFAULT_SORT, KEYS);
  const sorted = [...names].sort((a, b) => applyDir(byString(a, b), sort.dir));
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <caption className="sr-only">Groups, sortable by name</caption>
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <SortableTh
              label="Name"
              sortKey="name"
              sort={sort}
              onSort={setSort}
            />
          </tr>
        </thead>
        <tbody>
          {sorted.map((name) => (
            <tr
              key={name}
              className="border-b border-border last:border-0 hover:bg-surface-2"
            >
              <td className="p-0">
                <Link
                  href={`${basePath}/groups/${encodeURIComponent(name)}`}
                  className="block px-4 py-2 font-mono text-sm text-text transition-colors hover:text-link"
                >
                  {name}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
