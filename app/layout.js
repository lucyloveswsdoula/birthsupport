import "./globals.css";

export const metadata = {
  title: "Time Contractions Supported",
  description: "A calm companion for labor: contraction timer, breathing, and support.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Time Contractions Supported",
  },
  other: {
    // Legacy iOS tag so older iPhones also open it full-screen from the home screen.
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#9ed0c6",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
