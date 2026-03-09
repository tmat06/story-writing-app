import type { Metadata } from "next";
import "@/styles/tokens.css";
import AppShell from "@/components/AppShell/AppShell";

export const metadata: Metadata = {
  title: "Story Writing App",
  description: "A focused place to draft your stories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
