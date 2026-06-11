import "./globals.css";

export const metadata = {
  title: "Birth Support",
  description: "Coming soon.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
