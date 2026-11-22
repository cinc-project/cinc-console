import { getConfig } from "@/lib/config";
import { NewUserForm } from "./new-user-form";
import { createUser } from "../users/actions";

export default async function NewUserPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { authMode } = getConfig();
  return <NewUserForm org={org} authMode={authMode} onCreate={createUser.bind(null, org)} />;
}
