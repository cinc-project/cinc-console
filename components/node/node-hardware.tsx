import Link from "next/link";
import { formatKb, machineKind, type NodeFacts } from "@/lib/cinc/node-facts";
import { EmptyState } from "@/components/details/primitives";
import { NodeSection, NotReported, UsageBar } from "./parts";

function Card({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface px-4 py-3.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </div>
  );
}

function cpuSummary(cpu: NonNullable<NodeFacts["cpu"]>): string | null {
  const parts = [
    cpu.sockets ? `${cpu.sockets} ${cpu.sockets === 1 ? "socket" : "sockets"}` : null,
    cpu.cores ? `${cpu.cores} cores` : null,
    cpu.threads ? `${cpu.threads} threads` : null,
    cpu.mhz ? `${(cpu.mhz / 1000).toFixed(1)} GHz` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Hardware tab: Ohai's machine, CPU, memory, storage and network, as tables. */
export function NodeHardware({ base, facts }: { base: string; facts: NodeFacts }) {
  const reported =
    facts.cpu || facts.memory || facts.filesystems.length > 0 || facts.interfaces.length > 0;
  if (!reported) {
    return (
      <NodeSection title="Hardware">
        <EmptyState>
          This node hasn&apos;t reported hardware yet. Ohai collects it on the client&apos;s first run.
        </EmptyState>
      </NodeSection>
    );
  }

  const hw = facts.hardware;
  const model = [hw?.manufacturer, hw?.product].filter(Boolean).join(" ");

  return (
    <div className="space-y-5">
      <section aria-label="Machine" className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-3">
        <Card
          label="System"
          value={machineKind(facts) ?? <NotReported />}
          sub={[model, hw?.biosVersion ? `BIOS ${hw.biosVersion}` : null].filter(Boolean).join(" · ") || undefined}
        />
        <Card
          label="CPU"
          value={facts.cpu?.model ?? <NotReported />}
          sub={facts.cpu ? cpuSummary(facts.cpu) : undefined}
        />
        <Card
          label="Memory"
          value={
            facts.memory
              ? facts.memory.usedKb !== null
                ? `${formatKb(facts.memory.usedKb)} of ${formatKb(facts.memory.totalKb)} used`
                : formatKb(facts.memory.totalKb)
              : <NotReported />
          }
          sub={
            facts.swap
              ? `Swap ${facts.swap.usedKb !== null ? `${formatKb(facts.swap.usedKb)} of ` : ""}${formatKb(facts.swap.totalKb)}`
              : undefined
          }
        />
        <Card
          label="Kernel"
          value={<span className="font-mono">{facts.kernelRelease ?? "—"}</span>}
          sub={[facts.kernelName, facts.arch].filter(Boolean).join(" · ") || undefined}
        />
      </section>

      <NodeSection title="Filesystems" action={<span className="text-xs text-muted">Virtual filesystems (tmpfs, proc, overlay…) hidden</span>}>
        {facts.filesystems.length === 0 ? (
          <EmptyState>No filesystems reported.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Mount</th>
                  <th scope="col" className="px-3 py-2 font-medium">Device</th>
                  <th scope="col" className="px-3 py-2 font-medium">Type</th>
                  <th scope="col" className="w-1/3 px-3 py-2 font-medium">Used</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {facts.filesystems.map((fs) => (
                  <tr key={fs.mount}>
                    <th scope="row" className="py-2.5 pr-3 text-left font-mono font-normal">{fs.mount}</th>
                    <td className="break-all px-3 py-2.5 font-mono text-muted">{fs.device ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted">{fs.fsType ?? "—"}</td>
                    <td className="px-3 py-2.5">
                      {fs.percentUsed !== null ? (
                        <UsageBar percent={fs.percentUsed} label={`${fs.mount} used`} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right tabular-nums">{formatKb(fs.kbSize)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NodeSection>

      <NodeSection
        title="Network"
        action={
          facts.defaultGateway ? (
            <span className="text-xs text-muted">
              Default gateway <span className="font-mono">{facts.defaultGateway}</span>
            </span>
          ) : undefined
        }
      >
        {facts.interfaces.length === 0 ? (
          <EmptyState>No network interfaces reported.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">Interface</th>
                  <th scope="col" className="px-3 py-2 font-medium">State</th>
                  <th scope="col" className="px-3 py-2 font-medium">Addresses</th>
                  <th scope="col" className="py-2 pl-3 font-medium">MAC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {facts.interfaces.map((i) => (
                  <tr key={i.name} className="align-top">
                    <th scope="row" className="py-2.5 pr-3 text-left font-mono font-normal">
                      {i.name}
                      {i.isDefault && <span className="ml-2 font-sans text-xs text-link">default route</span>}
                    </th>
                    <td className="px-3 py-2.5">
                      {i.state ? (
                        <span className={i.state === "up" ? "text-success" : "text-muted"}>{i.state}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {i.addresses.length === 0 ? (
                        <span className="font-sans text-muted">None</span>
                      ) : (
                        <ul>
                          {i.addresses.map((a) => (
                            <li key={a.address} className="break-all">
                              {a.address}
                              {a.prefixlen && <span className="text-muted">/{a.prefixlen}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 font-mono text-muted">{i.mac ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NodeSection>

      <p className="text-sm text-muted">
        Everything else Ohai collected (packages, users, block devices…) is under{" "}
        <Link href={`${base}/attributes`}>Attributes</Link>.
      </p>
    </div>
  );
}
