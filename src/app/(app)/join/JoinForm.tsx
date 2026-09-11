"use client";

// /join (§4.5): the six-cell code input, Discord, callsign, focus, submit, and the Rejoin list.
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeInput, isSubmittableCode } from "@/components/ui/code-input";
import { Label } from "@/components/ui/input";
import type { Focus } from "@/lib/map/types";
import { isReservedCode, isRoomCode, normalizeCode } from "@/lib/room/code";
import { generateCallsign, loadIdentity, saveIdentity } from "@/lib/storage/identity";
import { CallsignField } from "@/components/map/forms/CallsignField";
import { parseCallsign } from "@/components/map/forms/callsign";
import { DiscordButton } from "@/components/map/forms/DiscordButton";
import { FocusGrid } from "@/components/map/forms/FocusPicker";
import { FormShell, GroupLabel, OrDivider } from "@/components/map/forms/FormShell";
import { RecentRooms } from "@/components/map/forms/RecentRooms";
import { useMounted } from "@/components/map/context";

const CODE_ERROR = "Codes are 6 letters or digits, never 0, O, 1 or I.";

export function JoinForm() {
  const router = useRouter();
  const mounted = useMounted();
  const saved = React.useMemo(() => (mounted ? loadIdentity() : null), [mounted]);
  const codeFromUrl = React.useMemo(
    () =>
      mounted
        ? normalizeCode(new URLSearchParams(window.location.search).get("code") ?? "").slice(0, 6)
        : "",
    [mounted],
  );
  const [generated] = React.useState(() => generateCallsign());
  const [codePick, setCode] = React.useState<string | null>(null);
  const [codeError, setCodeError] = React.useState<string | undefined>();
  const [callsignPick, setCallsign] = React.useState<string | null>(null);
  const [callsignError, setCallsignError] = React.useState<string | undefined>();
  const [focusPick, setFocus] = React.useState<Focus | null | undefined>(undefined);
  const [busy, setBusy] = React.useState(false);
  const code = codePick ?? codeFromUrl;
  const callsign = callsignPick ?? saved?.callsign ?? "";
  const focus = focusPick === undefined ? (saved?.focus ?? null) : focusPick;
  const placeholder = mounted ? generated : "e.g. Reaper";

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = normalizeCode(code);
    if (isReservedCode(clean)) {
      router.push("/demo");
      return;
    }
    if (!isRoomCode(clean)) {
      setCodeError(CODE_ERROR);
      return;
    }
    setCodeError(undefined);
    const parsedCallsign = parseCallsign(callsign || placeholder);
    if (parsedCallsign === null) {
      setCallsignError("2 to 24 characters.");
      return;
    }
    setCallsignError(undefined);
    setBusy(true);
    saveIdentity({ ...loadIdentity(), callsign: parsedCallsign, focus });
    router.push(`/room/${clean}`);
  };

  return (
    <FormShell title="Join a war room">
      <form onSubmit={submit} noValidate className="flex flex-col gap-7">
        <div>
          <Label htmlFor="code">War room code</Label>
          <CodeInput
            id="code"
            value={code}
            onChange={(v) => {
              setCode(v);
              if (codeError && (isSubmittableCode(v) || v.length < 6)) setCodeError(undefined);
            }}
            onSubmit={() => submit()}
            error={codeError}
            autoFocus
          />
          <p className="mt-2 text-sm text-fg-muted">
            Type <span className="font-mono text-fg">DEMO</span> to open the live demo instead.
          </p>
        </div>
        <DiscordButton />
        <OrDivider />
        <CallsignField
          value={callsign}
          onChange={setCallsign}
          error={callsignError}
          placeholder={placeholder}
        />
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <GroupLabel className="mb-0">Your focus</GroupLabel>
            <span className="text-right text-[13px] text-fg-muted">
              Change it any time from your name in the top bar
            </span>
          </div>
          <FocusGrid value={focus} onChange={setFocus} />
        </div>
        <div
          className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg-0/90 p-4 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Button type="submit" size="lg" loading={busy} className="w-full gap-2">
            Join war room <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
        <noscript>
          <p className="text-center text-sm text-fg-muted">JavaScript is needed to join a room.</p>
        </noscript>
      </form>
      <RecentRooms />
    </FormShell>
  );
}
