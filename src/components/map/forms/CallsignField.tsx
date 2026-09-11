"use client";

// Callsign input with the dice button (§4.4 step 7): h-12, placeholder `e.g. Reaper` or a generated
// `Operator 41E3`, inline error `2 to 24 characters.`
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { generateCallsign } from "@/lib/storage/identity";

export function CallsignField({
  value,
  onChange,
  error,
  placeholder = "e.g. Reaper",
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <Field
      label="Type your callsign"
      htmlFor="callsign"
      error={error}
      trailing={
        <Button
          variant="chip"
          onClick={() => onChange(generateCallsign())}
          aria-label="Generate a callsign"
          className="gap-1"
        >
          <Dices size={13} aria-hidden="true" /> Dice
        </Button>
      }
    >
      <Input
        name="callsign"
        value={value}
        placeholder={placeholder}
        maxLength={24}
        autoComplete="nickname"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
