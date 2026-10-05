/**
 * Optional SVG chalk filter. No longer used by default (it is expensive to
 * draw while scrolling); chalk grain now comes from the .chalk-grain mask.
 */
export default function ChalkFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <filter id="chalk-stroke" x="-20%" y="-40%" width="140%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.75" result="grain" />
          <feComposite in="SourceGraphic" in2="grain" operator="in" result="eroded" />
          <feDisplacementMap in="eroded" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
