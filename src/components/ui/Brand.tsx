export function NestMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="34"
      height="34"
      viewBox="0 0 42 42"
      aria-hidden="true"
    >
      <path d="M4 38V4h9l16 24V4h9v34h-9L13 14v24Z" fill="currentColor" />
      <path d="M0 21h42" stroke="var(--bg-primary)" strokeWidth="3" />
    </svg>
  );
}
export function BoundaryFigure({ className }: { className?: string }) {
  return (
    <figure className={className}>
      <svg
        viewBox="0 0 480 480"
        role="img"
        aria-label="An open trust boundary: a path from input to evidence"
      >
        <g fill="none" stroke="currentColor" strokeWidth=".5" opacity=".22">
          {Array.from({ length: 21 }, (_, i) => (
            <path key={i} d={`M${i * 24} 0V480M0 ${i * 24}H480`} />
          ))}
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="20">
          <path d="M32 218V32H448V448H32V284" />
          <path d="M82 218V82H398V398H82V284" />
          <path d="M132 218V132H348V348H132V284" />
          <path d="M182 218V182H298V298H182V284" />
        </g>
        <path d="M0 250H250" stroke="currentColor" strokeWidth="8" />
        <path
          d="m228 229 22 21-22 21"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
        />
        <g fill="currentColor">
          <rect x="20" y="230" width="5" height="5" />
          <rect x="58" y="269" width="5" height="5" />
          <rect x="116" y="237" width="5" height="5" />
        </g>
      </svg>
      <figcaption>
        <span>FIG. 01 / TRUST BOUNDARIES</span>
        <span>INPUT → EVIDENCE</span>
      </figcaption>
    </figure>
  );
}
export function ArrowIcon({
  diagonal = false,
  className,
}: {
  diagonal?: boolean;
  className?: string;
}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden="true"
    >
      {diagonal ? (
        <path d="M6 18 18 6M6 6h12v12" />
      ) : (
        <path d="M4 12h16m-6-6 6 6-6 6" />
      )}
    </svg>
  );
}
