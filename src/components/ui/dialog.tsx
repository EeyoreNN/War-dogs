"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { Field } from "./field";
import { Textarea } from "./textarea";
import { getFocusable } from "./focus";
import { cn } from "@/lib/utils";

const sizes = { sm: "max-w-[400px]", md: "max-w-[520px]", lg: "max-w-[720px]" } as const;

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Native `<dialog>` opened with `showModal()` (the top layer makes the rest inert). Focus moves
 * to `initialFocusRef` or the first control, returns to the opener on close; Esc and a click on
 * the backdrop close it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  initialFocusRef,
}: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);
  const openRef = React.useRef(false);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    openRef.current = open;
    if (open) {
      if (!el.open) {
        restoreRef.current = document.activeElement as HTMLElement | null;
        if (typeof el.showModal === "function") el.showModal();
        else el.setAttribute("open", "");
      }
      // Prefer the first control in the body / footer over the header's Close button.
      const target =
        initialFocusRef?.current ??
        (contentRef.current ? getFocusable(contentRef.current)[0] : undefined) ??
        getFocusable(el)[0] ??
        el;
      target.focus({ preventScroll: true });
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    if (el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
      restoreRef.current?.focus();
      restoreRef.current = null;
    }
  }, [open, initialFocusRef]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={() => {
        if (openRef.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none place-items-center bg-transparent p-4 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-[2px] open:grid"
    >
      {open ? (
        <div className={cn("w-full panel p-6 shadow-panel", sizes[size])}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="display display-4 text-fg">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-2 text-sm text-fg-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <Button variant="icon" size="icon" aria-label="Close" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </Button>
          </div>
          <div ref={contentRef}>
            <div className="text-[15px] leading-relaxed text-fg">{children}</div>
            {footer ? (
              <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{footer}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
  reasonField?: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
  };
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = "primary",
  reasonField,
}: ConfirmDialogProps) {
  const reasonId = React.useId();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const blocked = Boolean(reasonField?.required && reasonField.value.trim() === "");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      initialFocusRef={reasonField ? undefined : cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} disabled={blocked} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-fg-muted">{body}</div>
      {reasonField ? (
        <Field label={reasonField.label} htmlFor={reasonId} className="mt-4">
          <Textarea
            rows={3}
            value={reasonField.value}
            required={reasonField.required}
            onChange={(e) => reasonField.onChange(e.target.value)}
          />
        </Field>
      ) : null}
    </Dialog>
  );
}
