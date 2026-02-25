import type { Metadata } from "next";
import { Playfair_Display, Inter, Dancing_Script, Lora, Montserrat, Oswald, Secular_One } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "swap",
});

const secularOne = Secular_One({
  variable: "--font-secular-one",
  subsets: ["latin", "hebrew"],
  weight: "400",
  display: "swap",
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
    <html lang="en" className={`${playfair.variable} ${inter.variable} ${dancingScript.variable} ${lora.variable} ${montserrat.variable} ${oswald.variable} ${secularOne.variable}`}>
      <body className="antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
