"use client";

import { useRouter, useParams } from "next/navigation";
import type { Org } from "@/lib/cinc/orgs";

export function OrgSwitcher({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const params = useParams<{ org?: string }>();
  const current = params?.org ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    // Client-side navigation to an internal route; the org name is one of the
    // server-provided <option> values and is URL-encoded into the path — it is
    // never written into an HTML response. js-express-xss assumes an Express
    // req/res model that doesn't exist in this "use client" component.
    router.push(`/orgs/${e.target.value}`); // nosemgrep: js-express-xss
  }

  return (
    <select
      aria-label="Organization"
      value={current}
      onChange={onChange}
      className="max-w-[9rem] rounded-md border border-border bg-bg px-2 py-1 text-sm sm:max-w-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {orgs.map((o) => (
        <option key={o.name} value={o.name}>
          {o.full_name ?? o.name}
        </option>
      ))}
    </select>
  );
}
