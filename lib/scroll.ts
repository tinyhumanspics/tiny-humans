/** "smooth", unless the visitor asked for reduced motion (then the jump is instant). Browser only. */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
