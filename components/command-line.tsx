/** UPPER_CASE words in a command are placeholders the user fills in. */
const PLACEHOLDER = /\b([A-Z][A-Z_]{2,})\b/g;

/** One command line with its placeholders emphasized. */
export function CommandLine({ line }: { line: string }) {
  return (
    <>
      {line.split(PLACEHOLDER).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-semibold text-text">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
