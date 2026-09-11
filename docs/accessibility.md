# Accessibility checklist

Manual checklist for wardogs.tech (spec §7.4). The automated parts live in
`src/lib/a11y/contrast.test.ts` (unit), `tests/e2e/a11y.spec.ts` (structural audit on every route
including `/activity` and the five dashboard tabs, skip link, visible focus on `/` and `/room/[code]` including `[role="option"]`) and the component tests next to `Button`, `Dialog`,
`Tabs`, `Sheet`, `CodeInput`, `CopyButton`, `LiveRegion` and `Toast` under `src/components/ui/`.
Tick the rest by hand before a release.

## Structure

- [ ] Landmarks on every route: `header`, `nav` (labelled), `main`, `footer`; docs pages add
      `aside` for the TOC.
- [ ] Exactly one `h1` per route; headings nest without skipping levels.
- [ ] Skip link is the first focusable element: **Skip to content** → `#main` in every route
      group (`/create` and `/join` have no map, so the `(app)` layout never links to `#map`); a
      **Skip to map** link belongs to the map app itself, once the map exists. The root layout
      has none, so no route is left with a dead target.
- [ ] Every icon-only button has an `aria-label`; every decorative SVG is `aria-hidden`.
- [ ] Forms: every control has a label; helper and error text are wired with `aria-describedby`;
      invalid fields set `aria-invalid`; errors use `role="alert"`.
- [ ] Text that conveys state is never smaller than 11 px; badges are 11 px mono.

## Keyboard

- [ ] Every pointer interaction has a keyboard path (Appendix A of the spec lists them): tools by
      hotkey, marker placement with Enter at the crosshair, node list with Delete, pings, zoom.
- [ ] Toolbars use roving tabindex with arrow keys; tools expose `aria-keyshortcuts` and toggles
      `aria-pressed`.
- [ ] The map is `role="application"` with a description and a focusable node list.
- [ ] Dialogs are native `<dialog>` opened with `showModal()`: focus goes to the first control,
      Esc closes, focus returns to the opener. Modal sheets trap focus; non-modal ones are
      `role="region"`.
- [ ] No keyboard trap anywhere; the mobile menu closes on Esc and returns focus to the toggle.
- [ ] No positive `tabindex`.

## Visual

- [ ] Text contrast ≥ 4.5:1 on its surface (asserted): `fg-muted` on `bg-1` is 6.5:1; `fg-faint`
      is decorative only; small danger / delivered text uses `text-danger-text` /
      `text-req-delivered-text`.
- [ ] Focus is visible everywhere: 2 px accent outline with 2 px offset; primary buttons add a
      1 px dark ring so the outline stays visible on amber.
- [ ] Colour is never the only signal: request state also appears as text and an icon; ink
      colours are named; sync state is text in the pill.
- [ ] Touch targets ≥ 40 px (44 px on the mobile bottom bar and FABs); page zoom is never locked.
- [ ] Layout works from 360 px with no horizontal scroll (e2e asserts it); only tables and code
      blocks may exceed the width, inside `overflow-x: auto`.

## Motion and live content

- [ ] `prefers-reduced-motion`: no hero animation, no rise, no ping pulse, no marker drop
      animation; the LIVE dot becomes a static ring. Durations ≤ 240 ms otherwise.
- [ ] One polite live region (`LiveRegion`) on the page; toasts announce through it, remote
      changes are rate-limited; timers are `aria-live="off"`.
- [ ] Nothing animates continuously except the LIVE dot and active pings.

## Content

- [ ] Plain language, second person, no jargon in the FAQ, Terms and Privacy.
- [ ] Link text says where it goes; external links open in a new tab with `rel="noopener"`.
- [ ] Every image and OG image has alt text (`og:image:alt` is set on every route).

## How to test by hand

1. Tab through `/`, `/create`, `/room/[code]`, `/demo/admin/live`, `/rcon-api` with the mouse
   unplugged; note anything you cannot reach or cannot see focus on.
2. Turn on reduced motion in the OS and reload `/` and `/demo`.
3. Run a screen reader (VoiceOver / NVDA) over the home page and a war room: landmarks, the map
   description, the node list, a request's state.
4. Emulate a 360 px viewport; check every marketing page and the map on a Pixel 7 profile.
5. Zoom the page to 200 %; nothing should overlap or be cut off.
