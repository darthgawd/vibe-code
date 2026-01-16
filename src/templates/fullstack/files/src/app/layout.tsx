/**
 * {{projectName}} - Root Layout
 *
 * Security notes:
 * - Content Security Policy set via Next.js headers
 * - No inline scripts (CSP compliant)
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "{{projectName}}",
  description: "{{projectName}} - Secure Fullstack App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
