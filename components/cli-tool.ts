"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Which workstation tool the empty-state commands are shown for. */
export type CliTool = "cinc" | "knife";

export const CLI_TOOLS: { id: CliTool; label: string }[] = [
  { id: "cinc", label: "Cinc CLI" },
  { id: "knife", label: "knife" },
];

const KEY = "cinc-console.cli-tool";
const DEFAULT: CliTool = "cinc";
const listeners = new Set<() => void>();

/**
 * In-page fallback, used only once localStorage has failed (private mode,
 * blocked site data, quota). While storage works it is the source of truth.
 */
let memory: CliTool | null = null;

function read(): CliTool {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(KEY) === "knife" ? "knife" : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab changed it.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The user's preferred CLI, remembered in this browser and shared by every
 * CommandSnippet on the page — flipping one flips them all. The server render
 * always uses the default (Cinc CLI), so hydration never mismatches.
 */
export function useCliTool(): [CliTool, (tool: CliTool) => void] {
  const tool = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const setTool = useCallback((next: CliTool) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Not persisted across visits; remember it for this page instead.
      memory = next;
    }
    listeners.forEach((l) => l());
  }, []);
  return [tool, setTool];
}
