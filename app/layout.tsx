import type { Metadata } from "next";
import { Playfair_Display, Inter, Dancing_Script, Lora, Montserrat, Oswald, Secular_One, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "block",   // hold text invisible until font ready — no swap flash
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "fallback", // 100ms hold, 3s swap window — minimal flash
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
  display: "fallback",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "fallback",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "fallback",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "fallback",
});

const secularOne = Secular_One({
  variable: "--font-secular-one",
  subsets: ["latin", "hebrew"],
  weight: "400",
  display: "fallback",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "fallback",
});

export const metadata: Metadata = {
  title: "Invitia — AI-Powered Invitation Design",
  description: "Generate AI backgrounds, craft custom typography, and export print-ready invitations — all in one place.",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${dancingScript.variable} ${lora.variable} ${montserrat.variable} ${oswald.variable} ${secularOne.variable} ${plusJakartaSans.variable}`}>
      <body className="antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
