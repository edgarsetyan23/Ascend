// Shared reduced-motion check for the portfolio's tour animations
// (RecruiterView.jsx) and the 3D guide's own render loop (TourGuide.jsx) —
// one MediaQueryList, read fresh on every call (never cached to a boolean)
// so a visitor toggling the OS setting mid-session is picked up immediately
// in both places.
const reduceMotionQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)')
  : null

export function prefersReducedMotion() {
  return reduceMotionQuery?.matches ?? false
}
