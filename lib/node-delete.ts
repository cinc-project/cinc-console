/**
 * Deleting a node can also delete the API client of the same name (what
 * `knife node delete X && knife client delete X` does). When the node goes but
 * the client stays, the reason is one of these codes. They're shared by the
 * server action, the delete button and the node list, which shows the outcome
 * after the node page is gone.
 */
export const CLIENT_KEPT_REASONS = ["forbidden", "validator", "error"] as const;
export type ClientKeptReason = (typeof CLIENT_KEPT_REASONS)[number];

/** A list-page query value as a reason, or null for anything else. */
export function parseClientKept(v: unknown): ClientKeptReason | null {
  return (CLIENT_KEPT_REASONS as readonly unknown[]).includes(v)
    ? (v as ClientKeptReason)
    : null;
}

const WHY: Record<ClientKeptReason, string> = {
  forbidden: "you don't have permission to delete it",
  validator: "it is the organization's validator client",
  error: "the Cinc server returned an error",
};

/** "Node X was deleted, but client X wasn't: <why>." */
export function clientKeptMessage(name: string, reason: ClientKeptReason): string {
  return `Node ${name} was deleted, but client ${name} wasn't: ${WHY[reason]}. Its key can still authenticate to the server until the client is deleted.`;
}
