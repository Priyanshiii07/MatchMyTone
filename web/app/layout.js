import { DM_Sans, Playfair_Display } from "next/font/google";
import { Suspense } from "react";
import NavigationTracker from "./components/NavigationTracker";
import { ToastProvider } from "./components/Toaster";
import "./globals.css";
import "./styles/personalization.css";
import "./styles/home.css";
import "./styles/visual-refresh.css";

const display = Playfair_Display({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  title: "MatchMyTone — Your personal style, made clear",
  description:
    "Discover the colors, shapes, and routines that make your personal style feel like you.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        <Suspense fallback={null}><NavigationTracker /></Suspense>
        <ToastProvider><div id="main-content">{children}</div></ToastProvider>
      </body>
    </html>
  );
}
