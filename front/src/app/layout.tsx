import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
export const metadata: Metadata = {
  title: { default: "RecallCam", template: "%s · RecallCam" },
  description: "Video search and investigation with timestamped evidence",
  icons: {
    icon: "/brand/recallcam-icon-v3.png",
    apple: "/brand/recallcam-icon-v3.png",
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-3"
        >
          Skip to content
        </a>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
        <Toaster position="top-right" closeButton richColors duration={5000} />
      </body>
    </html>
  );
}
