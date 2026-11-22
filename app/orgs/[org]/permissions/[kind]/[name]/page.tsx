import { notFound } from "next/navigation";
import { isAclKind } from "@/lib/acl-kinds";
import { AclPage } from "../../acl-page";

export default async function ObjectPermissions({
  params,
}: {
  params: Promise<{ org: string; kind: string; name: string }>;
}) {
  const { org, kind, name } = await params;
  if (!isAclKind(kind)) notFound();
  return <AclPage org={org} target={{ kind, name: decodeURIComponent(name) }} />;
}
