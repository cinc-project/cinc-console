import { currentUser } from "@/lib/guard";
import { makeResource } from "@/lib/cinc/resource";
import { safeGet } from "@/lib/cinc/safe-get";
import { RunListEditor } from "@/components/details/run-list-editor";
import { TagsEditor } from "@/components/details/tags-editor";
import { EnvironmentPicker } from "@/components/node/environment-picker";
import { AppliedRunList } from "@/components/node/applied-run-list";
import { NodeSection } from "@/components/node/parts";
import { saveNode, setNodeEnvironment } from "../../actions";
import { loadNode, nodeParams } from "../data";

const environments = makeResource("environments");

export default async function NodeRunListPage({
  params,
}: {
  params: Promise<{ org: string; name: string }>;
}) {
  const { org, name } = await nodeParams(params);
  const user = await currentUser();
  const [res, envs] = await Promise.all([
    loadNode(org, name),
    safeGet(() => environments.list(user, org)),
  ]);
  if ("error" in res) return null; // the layout explains the failure
  const { node, facts } = res.data;
  const save = saveNode.bind(null, org, name);

  return (
    <div className="space-y-5">
      {facts.policyName ? (
        <NodeSection title="Policy">
          <p className="text-sm">
            This node is managed by the Policyfile{" "}
            <span className="font-mono">{facts.policyName}</span>
            {facts.policyGroup && (
              <>
                {" "}in policy group <span className="font-mono">{facts.policyGroup}</span>
              </>
            )}
            . Its run list comes from the policy, not from the node.
          </p>
        </NodeSection>
      ) : (
        <>
          <NodeSection title="Environment">
            <EnvironmentPicker
              current={facts.environment}
              options={"error" in envs ? null : Object.keys(envs.data).sort()}
              onSave={setNodeEnvironment.bind(null, org, name)}
            />
          </NodeSection>
          <RunListEditor data={node} onSave={save} />
        </>
      )}
      <AppliedRunList facts={facts} />
      <TagsEditor data={node} onSave={save} />
    </div>
  );
}
