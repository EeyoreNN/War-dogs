"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Sheet } from "@/components/ui/sheet";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { toCurl, toFetch, toPowerShell } from "@/lib/openapi/parse";
import { getSpec, matchEndpoint } from "@/lib/openapi/match";
import type { AuditEntry, RconCall } from "@/lib/admin-sim/types";
import { useSim } from "./sim-provider";
import { MethodBadge } from "./method-badge";

const TOKEN = "<token>";
type Lang = "curl" | "fetch" | "powershell";

function snippets(call: RconCall) {
  const base = getSpec().servers[0]?.url ?? "https://your-server-host:7776";
  const hit = matchEndpoint(call.method, call.path);
  if (!hit) return null;
  const body = call.body;
  return {
    endpoint: hit.endpoint,
    curl: toCurl(hit.endpoint, base, TOKEN, hit.values, body),
    fetch: toFetch(hit.endpoint, base, TOKEN, hit.values, body),
    powershell: toPowerShell(hit.endpoint, base, TOKEN, hit.values, body),
  };
}

/**
 * "What this sends" (§4.8): a non-modal right sheet showing the exact RCON call behind an
 * audit row, with copyable curl / fetch / PowerShell forms and a deep link into the console.
 */
export function RconSheet() {
  const { sheet, closeSheet, state, showRcon, setShowRcon } = useSim();
  const [lang, setLang] = React.useState<Lang>("curl");
  // The audit row may have been a pending stub when the sheet opened; read the live one.
  const entry: AuditEntry | null = React.useMemo(() => {
    if (!sheet.entry) return null;
    return state?.audit.find((a) => a.id === sheet.entry?.id) ?? sheet.entry;
  }, [sheet.entry, state]);
  const call = entry?.rcon ?? null;
  const snip = React.useMemo(() => (call ? snippets(call) : null), [call]);
  const bodyText = call
    ? call.body === null
      ? ""
      : typeof call.body === "string"
        ? call.body
        : JSON.stringify(call.body, null, 2)
    : "";

  return (
    <Sheet open={sheet.open} onClose={closeSheet} side="right" title="What this sends">
      <div className="flex flex-col gap-5 p-4">
        {entry && call ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <MethodBadge method={call.method} />
              <code className="min-w-0 font-mono text-[13px] break-all text-fg">{call.path}</code>
              {entry.result === "refused" ? <Badge tone="danger">Refused</Badge> : null}
            </div>
            <p className="text-sm text-fg-muted">
              {snip?.endpoint.summary ?? "Not in the spec"}
              {entry.target ? (
                <>
                  {" · "}
                  <span className="text-fg">{entry.target}</span>
                </>
              ) : null}
              {entry.detail ? ` · ${entry.detail}` : ""}
            </p>
            <div>
              <p className="mb-2 label-mono text-fg-faint">Body</p>
              <pre className="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed text-fg">
                {bodyText || "(no body)"}
              </pre>
            </div>
            {snip ? (
              <div>
                <Tabs
                  value={lang}
                  onChange={(v) => setLang(v as Lang)}
                  size="sm"
                  aria-label="Copy as"
                  items={[
                    { value: "curl", label: "curl" },
                    { value: "fetch", label: "fetch" },
                    { value: "powershell", label: "PowerShell" },
                  ]}
                />
                {(["curl", "fetch", "powershell"] as const).map((l) => (
                  <TabPanel key={l} value={l} active={lang} className="mt-3">
                    <pre className="scrollbar-thin overflow-x-auto rounded-md border border-line bg-bg-0 p-3 font-mono text-[12px] leading-relaxed whitespace-pre text-fg">
                      {snip[l]}
                    </pre>
                    <CopyButton
                      text={snip[l]}
                      label={`Copy as ${l === "powershell" ? "PowerShell" : l}`}
                      variant="secondary"
                      size="sm"
                      className="mt-2"
                    />
                  </TabPanel>
                ))}
              </div>
            ) : null}
            <p className="text-sm text-fg-muted">
              Sent to the in-browser simulator.{" "}
              <Link
                href={snip ? `/rcon-api?endpoint=${snip.endpoint.id}` : "/rcon-api"}
                className="text-fg underline underline-offset-4 hover:text-accent"
              >
                Point the API console at your own server to run it for real.
              </Link>
            </p>
          </>
        ) : entry ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="muted">Local only</Badge>
              <code className="font-mono text-[13px] text-fg">{entry.action}</code>
            </div>
            <p className="text-sm text-fg-muted">
              This action has no RCON endpoint. It changes only what this browser remembers:{" "}
              {entry.detail || "the visitor command log."}
            </p>
          </>
        ) : (
          <p className="text-sm text-fg-muted">
            Take an action on the dashboard and the RCON call it would send shows up here.
          </p>
        )}
        <label className="flex items-center gap-2 border-t border-line pt-4 text-sm text-fg-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={!showRcon}
            onChange={(e) => setShowRcon(!e.target.checked)}
          />
          Don&apos;t show automatically
        </label>
      </div>
    </Sheet>
  );
}
