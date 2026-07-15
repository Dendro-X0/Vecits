type VectisMarkProps = {
  className?: string;
};

export function VectisMark({ className }: VectisMarkProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="9.25" cy="9.75" r="1.35" fill="currentColor" />
      <circle cx="22.75" cy="9.75" r="1.35" fill="currentColor" />
      <circle cx="15.5" cy="20.5" r="1.85" fill="currentColor" />
      <path
        d="M9.25 9.75c1.4 4.2 3.1 7.4 6.25 10.75"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <path
        d="M22.75 9.75c-2.5 4.4-4.6 7.6-7.25 10.75l4.5 3.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="7.5"
        y1="20.5"
        x2="23.5"
        y2="20.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.32"
      />
    </svg>
  );
}
