import type { Metadata } from "next";
import type { CSSProperties } from "react";
import "./globals.css";
import { activeSchoolTheme } from "@/themes/schools";
export const metadata: Metadata = {
  title: {
    default: "DegreePath — Plan the path to graduation",
    template: "%s · DegreePath",
  },
  description:
    "An independent, deterministic college planning tool with official-source transparency.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-school={activeSchoolTheme.id}
      style={activeSchoolTheme.cssVariables as CSSProperties}
    >
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
