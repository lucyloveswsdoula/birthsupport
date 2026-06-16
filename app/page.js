"use client";

import { useState, useEffect, useRef } from "react";

// The three states our screen loops through.
const READY = "ready";
const ACTIVE = "active";
const REST = "rest";

// Where the history is saved on the phone (browser local storage).
const STORAGE_KEY = "birthsupport-history";

// "MM:SS" for the live timer (keeps the existing look).
function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}`;
}

// "M:SS" for durations and gaps, e.g. 45 -> "0:45", 270 -> "4:30".
function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function Home() {
  const [phase, setPhase] = useState(READY);
  const [elapsed, setElapsed] = useState(0); // seconds in the current contraction
  const [history, setHistory] = useState([]); // newest first
  const [hydrated, setHydrated] = useState(false); // has saved history loaded yet?

  const intervalRef = useRef(null); // holds the running 1-second ticker
  const startRef = useRef(null); // when the current contraction began

  // When the app opens, load any history saved on this phone.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) setHistory(saved);
      }
    } catch {
      // If anything is off, just start with an empty history.
    }
    setHydrated(true);
  }, []);

  // Save the history back to the phone whenever it changes.
  useEffect(() => {
    if (!hydrated) return; // don't overwrite saved data before we've loaded it
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [history, hydrated]);

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

    const startTime = startRef.current;
    const durationSec = Math.max(0, Math.round((Date.now() - startTime) / 1000));

    setHistory((prev) => {
      const previous = prev[0]; // the most recent contraction (newest first)
      // Gap = from the start of the previous contraction to the start of this one.
      const gapSec = previous
        ? Math.max(0, Math.round((startTime - previous.startTime) / 1000))
        : null;
      return [{ startTime, durationSec, gapSec }, ...prev];
    });

    setPhase(REST);
  }

  const isActive = phase === ACTIVE;
  const lastContraction = history[0];
  const showHistory = phase !== ACTIVE && history.length > 0;

  return (
    <main style={styles.main}>
      <header style={styles.title}>Birth Support</header>

      <section style={styles.stage}>
        {/* Top area changes with the phase */}
        {isActive && <div style={styles.timer}>{formatClock(elapsed)}</div>}

        {phase === REST && lastContraction && (
          <p style={styles.duration}>
            That contraction lasted {formatDuration(lastContraction.durationSec)}
          </p>
        )}

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

      {showHistory && (
        <section style={styles.historyWrap}>
          <h2 style={styles.historyTitle}>History</h2>
          <ul style={styles.historyList}>
            {history.map((c) => (
              <li key={c.startTime} style={styles.historyRow}>
                {`Lasted ${formatDuration(c.durationSec)}${
                  c.gapSec != null ? ` · ${formatDuration(c.gapSec)} apart` : ""
                }`}
              </li>
            ))}
          </ul>
        </section>
      )}
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
  duration: {
    margin: 0,
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#5a4650",
  },
  historyWrap: {
    width: "min(90vw, 360px)",
    marginTop: "2.5rem",
    marginBottom: "1rem",
  },
  historyTitle: {
    margin: "0 0 0.75rem 0",
    fontSize: "0.95rem",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#c99aa6",
    textAlign: "center",
  },
  historyList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  historyRow: {
    background: "rgba(255, 255, 255, 0.55)",
    borderRadius: "12px",
    padding: "0.85rem 1rem",
    fontSize: "1.15rem",
    color: "#6b5560",
    textAlign: "center",
  },
};
