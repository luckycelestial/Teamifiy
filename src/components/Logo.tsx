type LogoProps = {
  /** "light" renders on dark navy backgrounds, "dark" on white */
  tone?: "light" | "dark";
  className?: string;
};

/**
 * Sri Eshwar Innovation Studio wordmark.
 * "SRI ESHWAR" eyebrow, "Innovati<bulb>n" wordmark with a gold bulb replacing
 * the second "o", and the gold script "Studio" tucked under the wordmark.
 */
export function Logo({ tone = "dark", className = "" }: LogoProps) {
  const main = tone === "light" ? "text-white" : "text-navy";
  const eyebrow = tone === "light" ? "text-white/85" : "text-navy/80";

  return (
    <span className={`inline-flex select-none flex-col leading-none ${className}`}>
      <span
        className={`text-[0.5em] font-extrabold uppercase tracking-[0.28em] ${eyebrow}`}
      >
        Sri Eshwar
      </span>
      <span className={`mt-[0.12em] flex items-end font-extrabold tracking-tight ${main}`}>
        <span>Innovati</span>
        <Bulb />
        <span>n</span>
      </span>
      <span className="-mt-[0.18em] self-end pr-[0.15em] font-serif text-[0.62em] italic text-gold">
        Studio
      </span>
    </span>
  );
}

function Bulb() {
  return (
    <svg
      viewBox="0 0 24 32"
      aria-hidden="true"
      className="mx-[0.02em] h-[1.02em] w-[0.72em] shrink-0 translate-y-[0.02em]"
    >
      <path
        d="M12 1.5c5.5 0 9.6 4.1 9.6 9.3 0 4.2-2.9 7.1-5 9.6-.9 1-1.4 1.8-1.6 2.6H9c-.2-.8-.7-1.6-1.6-2.6-2.1-2.5-5-5.4-5-9.6C2.4 5.6 6.5 1.5 12 1.5Z"
        className="fill-gold"
      />
      <rect x="8.4" y="24.6" width="7.2" height="2.4" rx="1.2" className="fill-gold" />
      <rect x="9.4" y="28.2" width="5.2" height="2.3" rx="1.15" className="fill-gold" />
    </svg>
  );
}
