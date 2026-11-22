/** Chars of a revision id shown before it's elided; enough to tell revisions apart. */
const SHORT = 10;

/** The anchor a revision's row carries on the policy detail page. */
export function revisionAnchor(revision: string): string {
  return `revision-${revision}`;
}

/** Link to one revision of a policy: its row on the policy detail page. */
export function revisionHref(org: string, policy: string, revision: string): string {
  return `/orgs/${org}/policies/${encodeURIComponent(policy)}#${encodeURIComponent(
    revisionAnchor(revision),
  )}`;
}

/**
 * A policy revision id. Policyfile revisions are 64-char SHA-256 hashes, so the
 * visible text is the first few characters; the full id is on hover (`title`)
 * and is what a screen reader reads, so the accessible name never truncates.
 */
export function RevisionId({ revision }: { revision: string }) {
  if (revision.length <= SHORT + 2) {
    return <span className="font-mono">{revision}</span>;
  }
  return (
    <span className="font-mono" title={revision}>
      <span aria-hidden="true">{revision.slice(0, SHORT)}…</span>
      <span className="sr-only">{revision}</span>
    </span>
  );
}
