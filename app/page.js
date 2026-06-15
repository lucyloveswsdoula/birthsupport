"use client";

import { useState, useEffect, useRef } from "react";

// The three states our screen loops through.
const READY = "ready";
const ACTIVE = "active";
const REST = "rest";

// Turn a number of seconds into "MM:SS" (e.g. 75 -> "01:15").
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}`;
}

export default function Home() {
  const [phase, setPhase] = useState(READY);
  const [elapsed, setElapsed] = useState(0); // seconds in the current contraction
  const intervalRef = useRef(null); // holds the running 1-second ticker
  const startRef = useRef(null); // when the current contraction began

  // Safety net: if the page ever unmounts mid-contraction, stop the ticker.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startContraction() {
    setElapsed(0);
    startRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      // Measure against the real clock so the count stays accurate.
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    setPhase(ACTIVE);
  }

  function endContraction() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setPhase(REST);
  }

  const isActive = phase === ACTIVE;

  return (
    <main style={styles.main}>
      <header style={styles.title}>Birth Support</header>

      <section style={styles.stage}>
        {/* Top area changes with the phase */}
        {isActive && <div style={styles.timer}>{formatTime(elapsed)}</div>}

        {phase === REST && (
          <div style={styles.card}>
            <p style={styles.cardText}>Rest. A support card will appear here.</p>
          </div>
        )}

        {/* One big button; its label and action depend on the phase */}
        <button
          type="button"
          onClick={isActive ? endContraction : startContraction}
          style={{
            ...styles.button,
            background: isActive ? "#c76b82" : "#e08aa0",
          }}
        >
          {isActive ? "End" : "Start"}
        </button>

        {phase === READY && (
          <p style={styles.helper}>Tap start when a contraction begins.</p>
        )}
      </section>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "1.5rem",
    boxSizing: "border-box",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    color: "#6b5560",
  },
  title: {
    position: "fixed",
    top: "1.25rem",
    fontSize: "1rem",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#c99aa6",
  },
  stage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2rem",
  },
  timer: {
    fontSize: "min(22vw, 5.5rem)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "#5a4650",
    lineHeight: 1,
  },
  button: {
    width: "min(70vw, 260px)",
    height: "min(70vw, 260px)",
    borderRadius: "50%",
    border: "none",
    color: "#ffffff",
    fontSize: "2rem",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(180, 110, 130, 0.35)",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    userSelect: "none",
  },
  helper: {
    margin: 0,
    fontSize: "1.05rem",
    color: "#9c8088",
    maxWidth: "18rem",
  },
  card: {
    width: "min(85vw, 320px)",
    minHeight: "100px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.25rem",
    boxSizing: "border-box",
    border: "2px dashed #e3aeba",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.4)",
  },
  cardText: {
    margin: 0,
    fontSize: "1rem",
    color: "#b08c97",
    fontStyle: "italic",
  },
};
