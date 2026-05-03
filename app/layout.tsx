import type { Metadata } from "next";
import { Dancing_Script, Frank_Ruhl_Libre, Heebo, Lora, Montserrat, Oswald, Playpen_Sans_Hebrew, Secular_One } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";

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

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "block",
});

const playpenSansHebrew = Playpen_Sans_Hebrew({
  variable: "--font-playpen-sans-hebrew",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700", "800"],
  display: "fallback",
});

const frankRuhlLibre = Frank_Ruhl_Libre({
  variable: "--font-frank-ruhl-libre",
  subsets: ["latin", "hebrew"],
  weight: ["300", "400", "500", "700", "900"],
  display: "fallback",
});


export const metadata: Metadata = {
  title: "Pintle — Custom Invitation Design",
  description: "Create beautiful custom invitations with unique backgrounds, typography, and layouts — all in one place.",
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
    <html lang="en" className={`${dancingScript.variable} ${lora.variable} ${montserrat.variable} ${oswald.variable} ${secularOne.variable} ${heebo.variable} ${frankRuhlLibre.variable} ${playpenSansHebrew.variable}`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://use.typekit.net/hat2kft.css" />
        {/* Force light mode — clear any stale dark theme from localStorage */}
        <script dangerouslySetInnerHTML={{ __html: `try{localStorage.setItem('theme','light');}catch(e){}document.documentElement.removeAttribute('data-theme');` }} />
      </head>
      <body className="antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
