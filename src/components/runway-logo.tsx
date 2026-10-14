export function RunwayLogo({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size}>
      <rect fill="var(--ink)" height="22" rx="7" width="22" x="1" y="1" />
      <path
        d="M7 17.5h10M9.5 13.5h5M11 9.5h2"
        fill="none"
        stroke="var(--bg)"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
