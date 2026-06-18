export default function manifest() {
  return {
    name: "Time Contractions Supported",
    short_name: "Contractions",
    description: "A calm companion for labor: contraction timer, breathing, and support.",
    start_url: "/",
    display: "standalone",
    background_color: "#9ed0c6",
    theme_color: "#9ed0c6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
