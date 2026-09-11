import * as React from "react";
import { Button, type ButtonProps } from "./button";

export interface ChipProps extends Omit<ButtonProps, "variant" | "size" | "active"> {
  /** Selected chips render solid amber and expose `aria-pressed`. */
  selected?: boolean;
}

/** Filter-row chip: an alias of `<Button variant="chip">` with `selected` as the pressed state. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, ...props },
  ref,
) {
  return <Button ref={ref} variant="chip" active={selected} {...props} />;
});
