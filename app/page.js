"use client";

import { useState, useEffect, useRef } from "react";

// The three states our screen loops through.
const READY = "ready";
const ACTIVE = "active";
const REST = "rest";

// Where things are saved on the phone (browser local storage).
const STORAGE_KEY = "birthsupport-history";
const CARD_KEY = "birthsupport-card-index";

// Partner support cards, shown one at a time after each contraction, in order.
const SUPPORT_CARDS = [
  "Press firmly on her lower back during the next contraction.",
  "Squeeze her hips inward during a contraction to ease the pressure.",
  "Rub her shoulders slowly and gently.",
  "Hold her hand and breathe with her.",
  "Wipe her forehead with a cool, damp cloth.",
  "Massage her feet or lower legs.",
  "Offer her a sip of water or her favorite drink.",
  "Offer her a small bite to eat if she wants one.",
  "Help her change position — try standing and swaying.",
  "Let her lean on you and sway side to side together.",
  "Help her onto hands and knees to ease back pressure.",
  "Bring the birth ball over for her to rock on.",
  "Walk slowly together, arm in arm.",
  "Run a warm shower or bath if she'd like one.",
  "Breathe slowly with her and let her follow your breath.",
  "Gently remind her to drop her shoulders.",
  "Remind her to soften her jaw and unclench her hands.",
  "Tell her she's doing beautifully.",
  "Remind her each contraction brings her closer to baby.",
  "Tell her you're proud of her and you're not going anywhere.",
  "Remind her she is strong and her body knows what to do.",
  "Dim the lights to help her relax.",
  "Put on her calming playlist.",
  "Ask if she'd like the room warmer or cooler, and adjust it.",
  "Make quiet eye contact and stay close.",
  "Keep your voice soft and slow to match her calm.",
  "Be still beside her — sometimes presence is enough.",
  "Time the next contraction so she doesn't have to think about it.",
  "Walk her to the bathroom and remind her to empty her bladder.",
];

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

// Keep the same card for "about 2-4 contractions" -> a random 2, 3, or 4.
function randomSpan() {
  return 2 + Math.floor(Math.random() * 3);
}

export default function Home() {
  const [phase, setPhase] = useState(READY);
  const [elapsed, setElapsed] = useState(0); // seconds in the current contraction
  const [history, setHistory] = useState([]); // newest first
  const [cardIndex, setCardIndex] = useState(0); // which card is current
  const [cardSpan, setCardSpan] = useState(3); // how many contractions this card lasts (~2-4)
  const [cardShown, setCardShown] = useState(0); // how many times current card has shown
  const [currentCard, setCurrentCard] = useState(null); // card shown on rest screen
  const [confirmingDelete, setConfirmingDelete] = useState(false); // showing "Are you sure?"
  const [hydrated, setHydrated] = useState(false); // has saved data loaded yet?

  const intervalRef = useRef(null); // holds the running 1-second ticker
  const startRef = useRef(null); // when the current contraction began

  // When the app opens, load any saved data from this phone.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) setHistory(saved);
      }
      const rawCard = localStorage.getItem(CARD_KEY);
      const savedCard = rawCard ? JSON.parse(rawCard) : null;
      if (
        savedCard &&
        typeof savedCard === "object" &&
        Number.isInteger(savedCard.index) &&
        savedCard.index >= 0 &&
        savedCard.index < SUPPORT_CARDS.length
      ) {
        setCardIndex(savedCard.index);
        if (Number.isInteger(savedCard.span)) setCardSpan(savedCard.span);
        if (Number.isInteger(savedCard.shown)) setCardShown(savedCard.shown);
      } else {
        // First time on this phone: pick how long the first card lasts.
        setCardSpan(randomSpan());
      }
    } catch {
      // If anything is off, just start fresh.
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

  // Save the card cycle (which card, how long it lasts, how far in) so it survives a refresh.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        CARD_KEY,
        JSON.stringify({ index: cardIndex, span: cardSpan, shown: cardShown })
      );
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [cardIndex, cardSpan, cardShown, hydrated]);

  // Safety net: if the page ever unmounts mid-contraction, stop the ticker.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function clearHistory() {
    setHistory([]); // also empties the saved copy via the save effect
    setConfirmingDelete(false);
  }

  function startContraction() {
    setConfirmingDelete(false);
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

    // Show the current partner support card. Keep it for ~2-4 contractions,
    // then move on to the next card and pick a fresh span.
    setCurrentCard(SUPPORT_CARDS[cardIndex]);
    const shownNow = cardShown + 1;
    if (shownNow >= cardSpan) {
      setCardIndex((cardIndex + 1) % SUPPORT_CARDS.length);
      setCardSpan(randomSpan());
      setCardShown(0);
    } else {
      setCardShown(shownNow);
    }

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

        {phase === REST && currentCard && (
          <div style={styles.card}>
            <p style={styles.cardLabel}>For your partner</p>
            <p style={styles.cardAction}>{currentCard}</p>
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

          {confirmingDelete ? (
            <div style={styles.confirmBox}>
              <p style={styles.confirmText}>
                Are you sure you want to delete all contraction history?
              </p>
              <div style={styles.confirmRow}>
                <button
                  type="button"
                  onClick={clearHistory}
                  style={styles.confirmDelete}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  style={styles.confirmCancel}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              style={styles.deleteButton}
            >
              Delete History
            </button>
          )}
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
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.6rem",
    padding: "1.25rem",
    boxSizing: "border-box",
    border: "2px dashed #e3aeba",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.4)",
  },
  cardLabel: {
    margin: 0,
    fontSize: "0.85rem",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#c99aa6",
  },
  cardAction: {
    margin: 0,
    fontSize: "1.35rem",
    fontWeight: 500,
    lineHeight: 1.4,
    color: "#6b5560",
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
  deleteButton: {
    display: "block",
    margin: "1.25rem auto 0 auto",
    padding: "0.65rem 1.25rem",
    background: "transparent",
    border: "1px solid #e3aeba",
    borderRadius: "999px",
    color: "#a98591",
    fontSize: "1rem",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  confirmBox: {
    marginTop: "1.25rem",
    padding: "1rem",
    border: "1px solid #e3aeba",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.6)",
  },
  confirmText: {
    margin: "0 0 0.9rem 0",
    fontSize: "1.05rem",
    color: "#6b5560",
    lineHeight: 1.4,
  },
  confirmRow: {
    display: "flex",
    justifyContent: "center",
    gap: "0.75rem",
  },
  confirmDelete: {
    padding: "0.7rem 1.4rem",
    background: "#c76b82",
    border: "none",
    borderRadius: "999px",
    color: "#ffffff",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  confirmCancel: {
    padding: "0.7rem 1.4rem",
    background: "transparent",
    border: "1px solid #cda9b3",
    borderRadius: "999px",
    color: "#6b5560",
    fontSize: "1rem",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
};
