"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { announce } from "@/components/ui/live-region";
import { site } from "@/config/site";

export const STORAGE_KEY = "wardogs:dh";

type Answer = "yes" | "no";
export type OutcomeId = "A" | "B" | "C" | "D";

const QUESTIONS = [
  { id: "q1", text: "Can you — an admin — launch it?" },
  {
    id: "q2",
    text: "Can a non-admin launch it in a brand-new voice channel dragged to the very top of the server, outside every category?",
  },
  {
    id: "q3",
    text: "Is the failing channel created by a bot (join-to-create, temp channels)?",
  },
] as const;

export const OUTCOMES: Record<
  OutcomeId,
  { title: string; body: React.ReactNode; checklist: string; link: { href: string; label: string } }
> = {
  A: {
    title: "Install it first.",
    body: (
      <>
        An admin adds it with <Link href="/add">Add to your server</Link>; or, right now, three dots
        on the app card → Add to my apps.
      </>
    ),
    checklist: [
      "wardogs.tech — it won't launch: checklist (outcome A: not installed)",
      "1. An admin installs it to the server: " + site.url + "/add",
      "2. No admin around? Three dots on the app card → Add to my apps (works for you only, in every server).",
      "3. Server Settings → Integrations shows a server install with who added it and when. Empty list = personal install only.",
    ].join("\n"),
    link: { href: "#installing", label: "Installing it, properly" },
  },
  B: {
    title: "Fix the hub, not the children.",
    body: (
      <>
        Edit Channel → Permissions on the channel your bot clones from. Clear the Use Activities
        deny, delete a temp channel, let the bot make a fresh one.
      </>
    ),
    checklist: [
      "wardogs.tech — it won't launch: checklist (outcome B: temp-channel hub)",
      "1. Find the channel the bot clones from (its config names it: a category template or the join-to-create channel).",
      "2. Edit Channel → Permissions on that hub. Clear the Use Activities deny for @everyone and for the members' role.",
      "3. Delete an existing temp channel and let the bot make a fresh one.",
      "4. Have a non-admin join the fresh channel and launch. Never test as an admin.",
    ].join("\n"),
    link: { href: "#temp-channels", label: "Temp voice channels" },
  },
  C: {
    title: "It is server-wide.",
    body: <>Server Settings → Apps → Activities, and Integrations → wardogs.tech → Manage.</>,
    checklist: [
      "wardogs.tech — it won't launch: checklist (outcome C: server-wide)",
      "1. Server Settings → Apps → Activities (a different page from Integrations). Check activities are allowed.",
      "2. Server Settings → Integrations → wardogs.tech → Manage. Check the app's own access list includes the members' roles and channels.",
      "3. Re-run the one-minute test with a non-admin in a fresh top-level voice channel.",
    ].join("\n"),
    link: { href: "#one-minute-test", label: "The test that finds it in one minute" },
  },
  D: {
    title: "It is that channel or its category.",
    body: (
      <>
        Edit Channel → Permissions: set Use Activities to neutral or allow for @everyone and for
        their role. Check the category above it too.
      </>
    ),
    checklist: [
      "wardogs.tech — it won't launch: checklist (outcome D: channel or category permission)",
      "1. Edit Channel → Permissions on the failing voice channel.",
      "2. Use Activities: set to neutral or allow for @everyone and for the members' role.",
      "3. Do the same on the category above the channel (channel overwrites inherit from it).",
      "4. Have a non-admin try again. Admins bypass channel denies, so an admin test proves nothing.",
    ].join("\n"),
    link: { href: "#answer", label: "The answer, nine times out of ten" },
  },
};

/** Pure: where a list of answers leads. */
export function resolve(answers: Answer[]): { question: number } | { outcome: OutcomeId } {
  const [a1, a2, a3] = answers;
  if (a1 === undefined) return { question: 0 };
  if (a1 === "no") return { outcome: "A" };
  if (a2 === undefined) return { question: 1 };
  if (a2 === "no") return { outcome: "C" };
  if (a3 === undefined) return { question: 2 };
  return { outcome: a3 === "yes" ? "B" : "D" };
}

/* A tiny sessionStorage-backed store so the stepper survives a reload without a hydration mismatch. */
const listeners = new Set<() => void>();
function readRaw(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeRaw(v: string) {
  try {
    if (v) sessionStorage.setItem(STORAGE_KEY, v);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: state lives in memory for this render tree only */
  }
  memory = v;
  listeners.forEach((l) => l());
}
let memory = "";
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => {
  const raw = readRaw();
  return raw || memory;
};
const getServerSnapshot = () => "";

function parseAnswers(raw: string): Answer[] {
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v))
      return v.filter((x): x is Answer => x === "yes" || x === "no").slice(0, 3);
  } catch {
    /* fall through */
  }
  return [];
}

/** The "Start here" diagnostic (§4.9): three questions, four outcomes, state in sessionStorage. */
export function DiscordStepper() {
  const raw = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const answers = React.useMemo(() => parseAnswers(raw), [raw]);
  const state = resolve(answers);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const answer = (a: Answer) => {
    const next = [...answers, a];
    writeRaw(JSON.stringify(next));
    const r = resolve(next);
    if ("outcome" in r) announce(`Outcome ${r.outcome}: ${OUTCOMES[r.outcome].title}`);
  };
  const reset = () => {
    writeRaw("");
    announce("Started over");
  };

  React.useEffect(() => {
    if ("outcome" in state) headingRef.current?.focus();
  }, [state]);

  return (
    <div className="not-prose rounded-lg border border-line bg-bg-1 p-5 sm:p-6">
      {answers.length > 0 ? (
        <ol className="mb-5 flex flex-col gap-2" aria-label="Your answers">
          {answers.map((a, i) => (
            <li
              key={QUESTIONS[i].id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[14px] text-fg-muted"
            >
              <span className="font-mono text-[11px] tracking-[0.14em] text-fg-faint uppercase">
                Q{i + 1}
              </span>
              <span className="min-w-0 flex-1">{QUESTIONS[i].text}</span>
              <span className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
                {a}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {"question" in state ? (
        <fieldset>
          <legend className="mb-1 font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase">
            Question {state.question + 1} of 3
          </legend>
          <p className="text-[17px] leading-snug font-medium text-fg">
            {QUESTIONS[state.question].text}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => answer("yes")}>
              Yes
            </Button>
            <Button variant="secondary" onClick={() => answer("no")}>
              No
            </Button>
            {answers.length > 0 ? (
              <Button variant="ghost" onClick={reset}>
                <RotateCcw size={16} aria-hidden="true" /> Start over
              </Button>
            ) : null}
          </div>
        </fieldset>
      ) : (
        <div
          className="border-l-2 border-accent pl-4"
          role="region"
          aria-labelledby="dh-outcome"
          data-outcome={state.outcome}
        >
          <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
            Outcome {state.outcome}
          </p>
          <h3
            id="dh-outcome"
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 text-[22px] leading-tight font-semibold text-fg outline-none"
          >
            {OUTCOMES[state.outcome].title}
          </h3>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-fg-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4">
            {OUTCOMES[state.outcome].body}
          </p>
          <p className="mt-2 text-[14px]">
            <a
              href={OUTCOMES[state.outcome].link.href}
              className="text-fg underline decoration-accent/60 underline-offset-4 hover:text-accent"
            >
              Read: {OUTCOMES[state.outcome].link.label} ↓
            </a>
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <CopyButton
              text={OUTCOMES[state.outcome].checklist}
              label="Copy this checklist for my mods"
              variant="secondary"
            />
            <Button variant="ghost" onClick={reset}>
              <RotateCcw size={16} aria-hidden="true" /> Start over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
