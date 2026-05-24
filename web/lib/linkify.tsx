import React from "react";

const URL_RE = /(https?:\/\/[^\s]+)/g;

// Render free text with any http(s) URLs turned into clickable links.
// Safe inside server components; not for use inside another <a>.
export function linkify(text: string): React.ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-words hover:opacity-80"
      >
        {part}
      </a>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}
