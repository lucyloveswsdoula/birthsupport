export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "1.5rem",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "2.5rem",
          fontWeight: 600,
          color: "#333333",
          letterSpacing: "0.5px",
        }}
      >
        Birth Support
      </h1>
      <p
        style={{
          marginTop: "0.75rem",
          fontSize: "1.1rem",
          color: "#888888",
        }}
      >
        Coming soon.
      </p>
    </main>
  );
}
