"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { announce } from "@/components/ui/live-region";
import { validateIni, type IniValidation } from "@/lib/config-ini/validate";

/**
 * Paste a ServerSettings.ini, get what `POST /v1/config/validate` would say (§4.9): errors in
 * danger, warnings in warn, stripped keys muted. `Load the template` fills the textarea.
 */
export function ConfigValidator({ template }: { template: string }) {
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<IniValidation | null>(null);
  const [pristine, setPristine] = React.useState(true);
  const id = React.useId();

  const run = () => {
    const r = validateIni(text);
    setResult(r);
    setPristine(false);
    const errors = r.issues.filter((i) => i.level === "error").length;
    const warnings = r.issues.length - errors;
    announce(
      errors === 0
        ? `Valid. ${warnings} warning${warnings === 1 ? "" : "s"}.`
        : `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`,
    );
  };
  const load = () => {
    setText(template);
    setResult(null);
    setPristine(true);
    announce("Template loaded");
  };

  const errors = result?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = result?.issues.filter((i) => i.level === "warning") ?? [];

  return (
    <div data-bundle="wd:validator" className="not-prose flex flex-col gap-5">
      <Field
        label="Paste your ServerSettings.ini"
        htmlFor={`${id}-ini`}
        helper="Nothing leaves your browser. The rules mirror what POST /v1/config/validate returns."
      >
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPristine(true);
          }}
          rows={12}
          spellCheck={false}
          autoComplete="off"
          placeholder={
            "[/Script/WDRCON.WDRCONSettings]\nbEnabled=true\nBindAddress=127.0.0.1\nPort=7776"
          }
          className="font-mono text-[13px] leading-relaxed"
        />
      </Field>
      <div className="flex flex-wrap gap-3">
        <Button onClick={run} disabled={text.trim() === ""}>
          Validate
        </Button>
        <Button variant="secondary" onClick={load}>
          Load the template
        </Button>
      </div>

      <div aria-live="polite" className="min-h-6">
        {result && !pristine ? (
          <div className="rounded-md border border-line bg-bg-1 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              {result.ok ? <Badge tone="ok">Valid</Badge> : <Badge tone="danger">Rejected</Badge>}
              <p className="font-mono text-[12px] text-fg-muted">
                {errors.length} error{errors.length === 1 ? "" : "s"} · {warnings.length} warning
                {warnings.length === 1 ? "" : "s"} · {result.stripped.length} stripped ·{" "}
                {result.sections.filter((s) => s.name).length} sections read
              </p>
            </div>

            {result.issues.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2" aria-label="Validation results">
                {[...errors, ...warnings].map((issue, i) => (
                  <li
                    key={`${issue.code}-${issue.line ?? "x"}-${i}`}
                    className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t border-line pt-2 text-[14px] leading-relaxed first:border-t-0 first:pt-0"
                  >
                    <span className="flex shrink-0 items-center gap-2 pt-0.5">
                      <Badge tone={issue.level === "error" ? "danger" : "warn"}>
                        {issue.level}
                      </Badge>
                      <span className="font-mono text-[11px] tracking-[0.1em] text-fg-faint uppercase">
                        {issue.line === null ? "—" : `L${issue.line}`}
                      </span>
                    </span>
                    <span
                      className={
                        issue.level === "error"
                          ? "min-w-0 flex-1 text-fg"
                          : "min-w-0 flex-1 text-fg-muted"
                      }
                    >
                      {issue.key ? (
                        <code className="mr-1.5 rounded-sm bg-bg-2 px-1.5 font-mono text-[12px] text-accent">
                          {issue.key}
                        </code>
                      ) : null}
                      {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[14px] text-fg-muted">
                Every section and key is one the server reads, every value is in range.
              </p>
            )}

            {result.stripped.length > 0 ? (
              <p className="mt-4 border-t border-line pt-3 font-mono text-[12px] text-fg-faint">
                Stripped: {result.stripped.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
