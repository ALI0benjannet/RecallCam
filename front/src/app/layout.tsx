import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallCam",
  description: "Video search and investigation with timestamped evidence",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link className="brand" href="/">RecallCam</Link>
          <nav aria-label="Main navigation">
            <Link href="/upload">Upload</Link>
            <Link href="/library">Library</Link>
            <Link href="/chat">Investigate</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
