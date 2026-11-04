import "server-only";

/**
 * Minimal structured logger: one JSON object per line to stdout/stderr.
 *
 * No dependency — in the container, Kubernetes collects stdout, so JSON lines
 * are the cheapest path to queryable logs. This is a privileged console, so the
 * point is an audit trail (who logged in, which Cinc requests were denied), not
 * verbose tracing.
 *
 * NEVER pass secrets here: no passwords, no request/response bodies (data bag
 * items hold secrets), no headers (they carry the webui signature). Stick to
 * identifiers — actor, user, org, method, path, status.
 */
type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | undefined>;

function emit(level: Level, event: string, fields: Fields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields: Fields = {}) => emit("info", event, fields),
  warn: (event: string, fields: Fields = {}) => emit("warn", event, fields),
  error: (event: string, fields: Fields = {}) => emit("error", event, fields),
};
