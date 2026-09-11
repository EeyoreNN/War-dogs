import type * as React from "react";

/** Focus helpers shared by Dialog and Sheet (DOM-only; React is a type import). */

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getAttribute("aria-hidden") !== "true",
  );
}

/** Focus `preferred` when given, else the first control inside `root`, else `root` itself. */
export function focusFirst(root: HTMLElement, preferred?: HTMLElement | null) {
  const target = preferred ?? getFocusable(root)[0] ?? root;
  target.focus({ preventScroll: true });
}

/** Keep Tab / Shift+Tab inside `root`. Call from a keydown handler. */
export function trapTab(root: HTMLElement, e: KeyboardEvent | React.KeyboardEvent) {
  if (e.key !== "Tab") return;
  const items = getFocusable(root);
  if (items.length === 0) {
    e.preventDefault();
    root.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
