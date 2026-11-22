import Link from "next/link";
import { currentUser } from "@/lib/guard";
import { listContainers } from "@/lib/cinc/acl";
import { safeGet, explainRead } from "@/lib/cinc/safe-get";
import { permissionsHref } from "@/lib/acl-kinds";

/**
 * Permissions that aren't on any one object: the organization's own, and each
 * container's, which decides who may create objects of that kind. An object's
 * permissions are linked from its page.
 */
export default async function PermissionsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const user = await currentUser();
  const res = await safeGet(() => listContainers(user, org));
  const link = "block px-4 py-2 transition-colors hover:bg-surface-2 hover:text-link";

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Permissions</h1>
        <p className="text-sm text-muted">
          Each object has its own permissions (create, read, update, delete and
          grant), granted to users, clients and groups; open them from the
          object&apos;s page. Seeing or changing permissions needs{" "}
          <span className="font-mono">grant</span>.
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="org-heading">
        <h2 id="org-heading" className="text-lg font-semibold tracking-tight">
          Organization
        </h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <Link href={permissionsHref(org, { kind: "organization" })} className={`${link} font-mono text-text`}>
            {org}
          </Link>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="containers-heading">
        <h2 id="containers-heading" className="text-lg font-semibold tracking-tight">
          Object types (containers)
        </h2>
        <p className="text-sm text-muted">
          A container&apos;s <span className="font-mono">create</span> permission decides
          who may make new objects of that type.
        </p>
        {"error" in res ? (
          <p className="text-sm text-danger">{explainRead(res.error)}</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-border">
            {res.data.map((c) => (
              <li key={c} className="border-b border-border last:border-0">
                <Link href={permissionsHref(org, { kind: "containers", name: c })} className={`${link} font-mono text-text`}>
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
