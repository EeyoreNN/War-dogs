// Lazy feature bundle for `LazyMotion` (§7.3): the animation runtime loads only after the
// marketing page has rendered, and only `m` components are used under it (`strict`).
import { domAnimation } from "motion/react";

export default domAnimation;
