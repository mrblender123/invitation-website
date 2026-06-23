import type { Metadata } from "next";
import { Dancing_Script, Frank_Ruhl_Libre, Heebo, Lexend, Lora, Montserrat, Oswald, Playpen_Sans_Hebrew, Secular_One } from "next/font/google";
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

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "fallback",
});


export const metadata: Metadata = {
  title: "Simcha Invitations",
  description: "Create beautiful Jewish simcha invitations in minutes. Professional templates for bris, bar mitzvah, tenoyim, upsherin, sheva brachos, wedding & more. Personalize and download instantly for $8.99.",
  keywords: [
    "Jewish simcha invitation",
    "simcha invitation template",
    "bris invitation",
    "bar mitzvah invitation",
    "tenoyim invitation",
    "upsherin invitation",
    "sheva brachos invitation",
    "vachnacht invitation",
    "Jewish wedding invitation",
    "Pidyon haben invitation",
    "shulem zucher invitation",
    "Jewish invitation template",
    "Yiddish invitation",
    "Hebrew invitation",
    "shareyoursimcha",
  ],
  metadataBase: new URL('https://www.shareyoursimcha.com'),
  openGraph: {
    title: "Share Your Simcha | Jewish Simcha Invitation Templates",
    description: "Create beautiful Jewish simcha invitations in minutes. Templates for bris, bar mitzvah, tenoyim, upsherin, sheva brachos & more. Personalize and download for $8.99.",
    type: "website",
    url: "https://www.shareyoursimcha.com",
    siteName: "Share Your Simcha",
    images: [
      {
        url: "/og-image.png?v=2",
        width: 1200,
        height: 630,
        alt: "Share Your Simcha — Jewish Simcha Invitation Templates",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Share Your Simcha | Jewish Simcha Invitation Templates",
    description: "Create beautiful Jewish simcha invitations in minutes. Templates for every occasion. Personalize and download for $8.99.",
    images: ["/og-image.png"],
  },
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
    <html lang="en" className={`${dancingScript.variable} ${lora.variable} ${montserrat.variable} ${oswald.variable} ${secularOne.variable} ${heebo.variable} ${frankRuhlLibre.variable} ${playpenSansHebrew.variable} ${lexend.variable}`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://use.typekit.net/hat2kft.css" />
        {/* Force light mode — clear any stale dark theme from localStorage */}
        <script dangerouslySetInnerHTML={{ __html: `try{localStorage.setItem('theme','light');}catch(e){}document.documentElement.removeAttribute('data-theme');` }} />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-M9CSBEK4CT" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-M9CSBEK4CT');` }} />
      </head>
      <body className="antialiased"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
