import type { Metadata } from "next";
import { Manrope, Lora } from "next/font/google";
import "@/styles/tokens.css";
import AppShell from "@/components/AppShell/AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600"],
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-literata",
  display: "swap",
  weight: ["400", "500"],
});

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
    <html lang="en" className={`${manrope.variable} ${lora.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
