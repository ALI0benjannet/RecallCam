import { cn } from "@/lib/utils";
/** Conceptual timeline geometry, never presented as footage or processing data. */
export function EvidenceGraphic({
  className,
  light = false,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 420 240"
      fill="none"
      aria-hidden="true"
      className={cn("w-full", light ? "text-primary-muted-foreground" : "text-primary", className)}
    >
      <rect
        x="76"
        y="21"
        width="268"
        height="155"
        rx="14"
        stroke="currentColor"
        strokeOpacity=".25"
      />
      <path
        d="M92 61V44a7 7 0 0 1 7-7h17M304 37h17a7 7 0 0 1 7 7v17M92 134v17a7 7 0 0 0 7 7h17M304 158h17a7 7 0 0 0 7-7v-17"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="169"
        y="65"
        width="67"
        height="48"
        rx="9"
        fill="currentColor"
        fillOpacity=".1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m237 80 19-10v37l-19-10M181 66l6-12h25l6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="202" cy="89" r="12" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="202" cy="89" r="4" fill="var(--brand-amber)" />
      <path
        d="M151 83h-18v-17M151 96h-26v19M268 86h18V70M268 98h28v20"
        stroke="currentColor"
        strokeOpacity=".55"
        strokeWidth="1.5"
      />
      <circle cx="133" cy="62" r="4" fill="currentColor" fillOpacity=".7" />
      <circle cx="125" cy="119" r="4" fill="currentColor" fillOpacity=".7" />
      <circle cx="286" cy="66" r="4" fill="currentColor" fillOpacity=".7" />
      <circle cx="296" cy="122" r="4" fill="currentColor" fillOpacity=".7" />
      <path d="M48 205h324" stroke="currentColor" strokeOpacity=".35" />
      <path
        d="M72 201v8m24-8v8m24-8v8m24-8v8m24-8v8m24-8v8m24-8v8m24-8v8m24-8v8m24-8v8m24-8v8m24-8v8"
        stroke="currentColor"
        strokeOpacity=".45"
      />
      <rect x="139" y="197" width="76" height="16" rx="4" fill="currentColor" fillOpacity=".18" />
      <rect
        x="253"
        y="197"
        width="36"
        height="16"
        rx="4"
        fill="var(--brand-amber)"
        fillOpacity=".65"
      />
      <path d="M270 180v45" stroke="var(--brand-amber)" strokeWidth="1.5" />
      <circle cx="270" cy="180" r="3" fill="var(--brand-amber)" />
      <path d="M210 175v14" stroke="currentColor" strokeOpacity=".3" strokeDasharray="3 3" />
    </svg>
  );
}
