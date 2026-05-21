export default function InvalidTokenPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-[#080E14] px-6 py-16"
      style={{ fontFamily: "var(--font-inter, ui-sans-serif, sans-serif)" }}
    >
      {/* RASQ arc mark */}
      <svg width="56" height="56" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2C5.582 2 2 5.582 2 10s3.582 8 8 8" stroke="#1D9E75" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M10 5.5C7.515 5.5 5.5 7.515 5.5 10S7.515 14.5 10 14.5" stroke="#5DCAA5" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.5" fill="#1D9E75" />
      </svg>

      {/* Wordmark */}
      <p
        className="mt-4 text-[15px] font-bold text-white"
        style={{
          fontFamily: "var(--font-geist-sans, ui-sans-serif, sans-serif)",
          letterSpacing: "3px",
        }}
      >
        RASQ
      </p>

      {/* Tagline */}
      <p
        className="mt-1 text-[9px] uppercase text-[#374151]"
        style={{ letterSpacing: "0.12em" }}
      >
        Rehabilitation, precisely.
      </p>

      {/* Divider */}
      <div className="my-6 h-px w-[120px] bg-[#1E2D42]" />

      {/* Message */}
      <p className="text-[14px] text-[#6B7280]">
        This link has expired or is invalid.
      </p>
      <p className="mt-2 text-[12px] text-[#374151]">
        Contact your rehabilitation provider for a new access link.
      </p>
    </div>
  );
}
