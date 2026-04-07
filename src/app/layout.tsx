import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Music } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoMusic = Noto_Music({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-noto-music",
});

export const metadata: Metadata = {
  title: "Music staff tutor",
  description:
    "Learn piano key names and treble and bass staff notes with timed practice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoMusic.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
