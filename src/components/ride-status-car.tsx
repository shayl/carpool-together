type CoverageStatus = "covered" | "open" | "neutral";

export function coverageMood(status: CoverageStatus) {
  if (status === "covered") return "happy";
  if (status === "open") return "sad";
  return "neutral";
}

export function RideStatusCar({ status }: { status: CoverageStatus }) {
  const mood = coverageMood(status);
  const mouth =
    mood === "happy"
      ? "M35 31 Q44 41 53 31"
      : mood === "sad"
        ? "M35 39 Q44 30 53 39"
        : "M37 35 H51";

  return (
    <svg
      className={`ride-status-car ride-status-car-${mood}`}
      viewBox="0 0 88 64"
      aria-hidden="true"
    >
      {mood === "happy" && (
        <g
          className="car-celebration"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2.5"
        >
          <path d="M10 13v7M6.5 16.5h7M76 8v7M72.5 11.5h7" />
          <path d="M13 7 11 5M75 22l3 2" />
        </g>
      )}
      {mood === "sad" && (
        <path
          className="car-rain"
          d="M76 8c-5 7-6 9-6 12a6 6 0 0 0 12 0c0-3-1-5-6-12Z"
          fill="currentColor"
          opacity=".28"
        />
      )}
      <ellipse cx="44" cy="57" rx="31" ry="4" fill="var(--car-ink)" opacity=".13" />
      <path
        d="M17 31 25 12c1-3 4-5 7-5h24c3 0 6 2 7 5l8 19 6 5v15H11V36l6-5Z"
        fill="currentColor"
      />
      <path
        d="M27 14c1-2 2-3 5-3h24c2 0 4 1 5 3l6 17H21l6-17Z"
        fill="white"
      />
      {mood === "sad" && (
        <g
          fill="none"
          stroke="var(--car-ink)"
          strokeLinecap="round"
          strokeWidth="2.5"
        >
          <path d="m32 21 8-4M48 17l8 4" />
          <path
            d="M57 28c0 3-3 5-3 7a3 3 0 0 0 6 0c0-2-3-4-3-7Z"
            fill="currentColor"
            stroke="none"
            opacity=".7"
          />
        </g>
      )}
      {mood === "sad" ? (
        <>
          <ellipse cx="37" cy="26" rx="3.2" ry="4" fill="var(--car-ink)" />
          <ellipse cx="51" cy="26" rx="3.2" ry="4" fill="var(--car-ink)" />
          <circle cx="36" cy="24.5" r="1" fill="white" />
          <circle cx="50" cy="24.5" r="1" fill="white" />
        </>
      ) : (
        <>
          <circle cx="37" cy="25" r="2.5" fill="var(--car-ink)" />
          <circle cx="51" cy="25" r="2.5" fill="var(--car-ink)" />
        </>
      )}
      <path
        d={mouth}
        fill="none"
        stroke="var(--car-ink)"
        strokeLinecap="round"
        strokeWidth="2.8"
      />
      <rect x="16" y="39" width="56" height="10" rx="5" fill="white" opacity=".2" />
      <circle cx="21" cy="42" r="4" fill="white" />
      <circle cx="67" cy="42" r="4" fill="white" />
      <rect x="34" y="46" width="20" height="5" rx="2.5" fill="white" />
      <path
        d="M17 51v5M71 51v5"
        stroke="var(--car-ink)"
        strokeLinecap="round"
        strokeWidth="7"
      />
    </svg>
  );
}
