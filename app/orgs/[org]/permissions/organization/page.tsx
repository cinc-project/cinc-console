import { AclPage } from "../acl-page";

export default async function OrgPermissions({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  return <AclPage org={org} target={{ kind: "organization" }} />;
}
