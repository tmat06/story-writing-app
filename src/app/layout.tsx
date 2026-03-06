import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
