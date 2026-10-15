import type { ReactNode } from "react";

import { THEME_BOOTSTRAP_SCRIPT } from "../lib/theme/bootstrap";
import { themeDataAttribute } from "../lib/theme";

export function RootDocument({
  children,
  fontClassName,
  themePreference,
}: {
  children: ReactNode;
  fontClassName: string;
  themePreference: unknown;
}) {
  const theme = themeDataAttribute(themePreference);

  return (
    <html
      lang="en"
      className={`${fontClassName} h-full`}
      {...(theme ? { "data-theme": theme } : {})}
      suppressHydrationWarning
    >
      {/* The root document needs this inline bootstrap before first paint. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
