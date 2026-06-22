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

// Calming affirmations that slowly rotate while a contraction is in progress.
const AFFIRMATIONS = [
  "Your body was made for this",
  "Your body knows exactly what to do",
  "You were designed for this moment",
  "You can trust what your body is doing",
  "You don't have to fight this — just flow with it",
  "You are stronger than you know",
  "Every contraction is bringing your baby closer to you",
  "You have done hard things before and you are doing one right now",
  "You are more powerful than you feel in this moment",
  "Your body is working perfectly right now",
  "Breathe in calm, breathe out tension",
  "You only have to get through this one contraction",
  "Just this breath, just this moment, just this wave",
  "With every exhale you soften and open",
  "Your breath is carrying you through",
  "You and your baby are doing this together",
  "Your baby is coming to you with every surge",
  "You are opening to welcome your baby earthside",
  "You are safe and your baby is safe",
  "Your baby knows your voice, your heartbeat, your love",
  "This will pass — it always passes",
  "You are surrounded by people who love you",
  "Your body is not broken, it is doing exactly what it should",
  "You are allowed to feel this and keep going anyway",
  "You are exactly where you are supposed to be",
  "This is the most important and powerful work you will ever do",
];

// How long each affirmation stays on screen before the next one (milliseconds).
const AFFIRMATION_INTERVAL_MS = 9000;

// How many recent contractions to show before the user expands the list.
const HISTORY_COLLAPSED = 3;

// Pick a random affirmation that is not the one already showing.
function nextAffirmation(prevIndex) {
  if (AFFIRMATIONS.length <= 1) return 0;
  let next = prevIndex;
  while (next === prevIndex) {
    next = Math.floor(Math.random() * AFFIRMATIONS.length);
  }
  return next;
}

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

// How many contractions each partner support card stays before switching.
const CARD_SPAN = 2;

// Two-stage gentle pattern alerts (4-1-1 "get ready", then 3-1-1 "check in").
const ALERTS_KEY = "birthsupport-alerts";
const ALERT_MIN_DURATION = 45; // seconds — "about a minute or longer"
const ALERT_MIN_SPAN = 50 * 60; // seconds — pattern has held "about an hour"
const GAP_411 = 270; // 4.5 min or closer — "about 4 minutes apart"
const GAP_311 = 210; // 3.5 min or closer — "about 3 minutes apart"

const ALERT_MESSAGES = {
  stage1: {
    headline: "Get ready!",
    body:
      "Your contractions are settling into a steady pattern — coming about every 4 minutes and lasting around a minute. Gather your things and let your support people know.",
  },
  stage2: {
    headline: "Call your doctor or midwife!",
    body:
      "Your contractions have settled into a closer, steady pattern — about every 3 minutes and lasting around a minute, for about an hour. Let them know where things are, and follow the plan you've made with them.",
  },
};

// Does the recent run of contractions hold a steady pattern within maxGapSec?
// history is newest-first; each entry is { startTime, durationSec, gapSec }.
function patternHolds(history, maxGapSec) {
  if (!history.length) return false;
  const newest = history[0];
  if (newest.durationSec < ALERT_MIN_DURATION) return false;

  // Walk backward collecting consecutive contractions that fit the pattern.
  const run = [newest];
  for (let i = 1; i < history.length; i++) {
    const c = history[i];
    const linkingGap = history[i - 1].gapSec; // gap from c to the newer one
    if (c.durationSec >= ALERT_MIN_DURATION && linkingGap != null && linkingGap <= maxGapSec) {
      run.push(c);
    } else {
      break;
    }
  }

  const spanSec = (run[0].startTime - run[run.length - 1].startTime) / 1000;
  return spanSec >= ALERT_MIN_SPAN;
}

// --- Breathing guide ---
// Each pattern is a loop of steps. "scale" is the circle size (1.0 = full),
// and "duration" is how long that step takes, which the circle animates over.
const CIRCLE_BASE = 220; // px at full size (scale 1.0)
const BREATHING_PATTERNS = {
  slow: {
    label: "Slow",
    steps: [
      { word: "Breathe in", scale: 1.0, duration: 4000 },
      { word: "Breathe out", scale: 0.5, duration: 6000 },
    ],
  },
  fourSevenEight: {
    label: "4-7-8",
    steps: [
      { word: "Breathe in", scale: 1.0, duration: 4000 },
      { word: "Hold", scale: 1.0, duration: 7000 },
      { word: "Breathe out", scale: 0.5, duration: 8000 },
    ],
  },
  heehoo: {
    label: "Hee-hoo",
    steps: [
      { word: "hee", scale: 0.95, duration: 450 },
      { word: "hee", scale: 0.7, duration: 450 },
      { word: "hee", scale: 0.95, duration: 450 },
      { word: "hee", scale: 0.7, duration: 450 },
      { word: "hee", scale: 0.95, duration: 450 },
      { word: "hee", scale: 0.7, duration: 450 },
      { word: "hoo", scale: 0.35, duration: 3000 },
    ],
  },
};
const BREATHING_ORDER = ["slow", "fourSevenEight", "heehoo"];

function BreathingGuide({ onBack, onQuestion }) {
  const [patternKey, setPatternKey] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const pattern = patternKey ? BREATHING_PATTERNS[patternKey] : null;
  const step = pattern ? pattern.steps[stepIndex] : null;

  // Step through the chosen pattern on a loop, in time with the circle.
  useEffect(() => {
    if (!pattern) return;
    const id = setTimeout(() => {
      setStepIndex((i) => (i + 1) % pattern.steps.length);
    }, pattern.steps[stepIndex].duration);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternKey, stepIndex]);

  function choosePattern(key) {
    setStepIndex(0);
    setPatternKey(key);
  }

  const scale = step ? step.scale : 0.6;
  const transition = step
    ? `transform ${step.duration}ms ease-in-out`
    : "transform 0.6s ease-in-out";

  return (
    <main style={styles.breathMain}>
      <button type="button" onClick={onBack} style={styles.backButton}>
        ← Back
      </button>

      <div style={styles.breathTitle}>Breathing Guide</div>

      <div style={styles.circleWrap}>
        <div
          style={{ ...styles.breathCircle, transform: `scale(${scale})`, transition }}
        />
      </div>

      <p style={styles.breathWord}>{step ? step.word : "Choose a pattern"}</p>

      <div style={styles.patternRow}>
        {BREATHING_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => choosePattern(key)}
            style={{
              ...styles.patternButton,
              ...(patternKey === key ? styles.patternButtonActive : {}),
            }}
          >
            {BREATHING_PATTERNS[key].label}
          </button>
        ))}
      </div>

      <QuestionFooter onClick={onQuestion} />
    </main>
  );
}

// --- Contacts ---
const CONTACTS_KEY = "birthsupport-contacts";
const CONTACT_DEFS = [
  { id: "doctor", label: "Doctor or midwife" },
  { id: "doula", label: "Doula" },
  { id: "support", label: "Support person" },
];

function makeEmptyContacts() {
  return {
    doctor: { name: "", phone: "" },
    doula: { name: "", phone: "" },
    support: { name: "", phone: "" },
  };
}

// Build tel:/sms: links, keeping only dialable characters.
function telHref(phone) {
  return `tel:${phone.replace(/[^\d+*#]/g, "")}`;
}
function smsHref(phone) {
  return `sms:${phone.replace(/[^\d+*#]/g, "")}`;
}

function ContactsScreen({ contacts, onChange, onBack, bg }) {
  return (
    <main style={{ ...styles.contactsMain, ...(bg ? { background: bg } : {}) }}>
      <button type="button" onClick={onBack} style={styles.backButton}>
        ← Back
      </button>

      <div style={styles.contactsTitle}>Have a question?</div>
      <p style={styles.contactsIntro}>
        Save numbers so you can call or text in one tap. They stay on your phone.
      </p>

      {CONTACT_DEFS.map((def) => {
        const c = contacts[def.id];
        const hasPhone = c.phone.trim() !== "";
        return (
          <div key={def.id} style={styles.contactCard}>
            <div style={styles.contactLabel}>{def.label}</div>
            <input
              type="text"
              placeholder="Name (optional)"
              value={c.name}
              onChange={(e) => onChange(def.id, "name", e.target.value)}
              style={styles.contactInput}
            />
            <input
              type="tel"
              placeholder="Phone number"
              value={c.phone}
              onChange={(e) => onChange(def.id, "phone", e.target.value)}
              style={styles.contactInput}
            />
            {hasPhone && (
              <div style={styles.contactActions}>
                <a href={telHref(c.phone)} style={styles.callButton}>
                  Call
                </a>
                <a href={smsHref(c.phone)} style={styles.textButton}>
                  Text
                </a>
              </div>
            )}
          </div>
        );
      })}
    </main>
  );
}

// --- Prep checklist ---
const CHECKLIST_KEY = "birthsupport-checklist";
const CHECKLIST_ITEMS = [
  "Bag packed and ready",
  "Midwife number saved",
  "Playlist ready",
  "Birth plan printed",
  "Camera charged",
];

function ChecklistScreen({ checked, onToggle, onBack, bg, onQuestion }) {
  return (
    <main style={{ ...styles.checklistMain, ...(bg ? { background: bg } : {}) }}>
      <button type="button" onClick={onBack} style={styles.backButton}>
        ← Back
      </button>

      <div style={styles.contactsTitle}>Prep Checklist</div>

      <ul style={styles.checklistList}>
        {CHECKLIST_ITEMS.map((item, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onToggle(i)}
              style={{
                ...styles.checklistRow,
                ...(checked[i] ? styles.checklistRowDone : {}),
              }}
              aria-pressed={checked[i]}
            >
              <span
                style={{
                  ...styles.checkbox,
                  ...(checked[i] ? styles.checkboxDone : {}),
                }}
              >
                {checked[i] ? "✓" : ""}
              </span>
              <span
                style={{
                  ...styles.checklistText,
                  ...(checked[i] ? styles.checklistTextDone : {}),
                }}
              >
                {item}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <QuestionFooter onClick={onQuestion} />
    </main>
  );
}

// --- Settings ---
const SETTINGS_KEY = "birthsupport-settings";
const SETTINGS_DEFS = [
  { id: "cards", label: "Show partner support cards" },
  { id: "affirmations", label: "Show affirmations during contractions" },
  { id: "keepAwake", label: "Keep the screen awake" },
  { id: "alerts", label: "Show pattern alerts" },
];

function makeDefaultSettings() {
  return { cards: true, affirmations: true, keepAwake: true, alerts: true };
}

// Background sounds. Files go in public/sounds/ (added by the user later); if a
// file is missing it simply won't play — the app keeps working.
const SOUND_KEY = "birthsupport-sound";
const SOUND_OPTIONS = [
  { id: "silence", label: "Silence", src: null },
  { id: "ocean", label: "Ocean waves", src: "/sounds/ocean.mp3" },
  { id: "rain", label: "Rain on leaves", src: "/sounds/rain.mp3" },
  { id: "bowls", label: "Tibetan bowls", src: "/sounds/bowls.mp3" },
  { id: "white-noise", label: "White noise", src: "/sounds/white-noise.mp3" },
];

// A collapsible Settings section: a title + the current choice + a down arrow;
// tapping reveals the options. Reusable for role, sound, future voices, etc.
function Collapsible({ title, value, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.collapsible}>
      <button
        type="button"
        style={styles.collapsibleHeader}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span style={styles.collapsibleTitle}>{title}</span>
        <span style={styles.collapsibleRight}>
          {value ? <span style={styles.collapsibleValue}>{value}</span> : null}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2f5a53"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && <div style={styles.collapsibleBody}>{children}</div>}
    </div>
  );
}

function SettingsScreen({
  settings,
  onToggle,
  onBack,
  bg,
  role,
  onChangeRole,
  soundKey,
  onChangeSound,
  onQuestion,
}) {
  const roleLabel = role === "doula" ? "Doula" : "Mom or Partner";
  const soundLabel = (SOUND_OPTIONS.find((s) => s.id === soundKey) || {}).label;
  return (
    <main style={{ ...styles.checklistMain, background: bg }}>
      <button type="button" onClick={onBack} style={styles.backButton}>
        ← Back
      </button>

      <div style={styles.contactsTitle}>Settings</div>

      <div style={styles.settingsList}>
        {SETTINGS_DEFS.map((def) => {
          const on = settings[def.id];
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onToggle(def.id)}
              style={styles.settingsRow}
              aria-pressed={on}
            >
              <span style={styles.settingsLabel}>{def.label}</span>
              <span
                style={{
                  ...styles.switchTrack,
                  background: on ? "#4e9e90" : "#c4c4c4",
                }}
              >
                <span style={{ ...styles.switchKnob, left: on ? "25px" : "3px" }} />
              </span>
            </button>
          );
        })}
      </div>

      <Collapsible title="Your role" value={roleLabel}>
        <button
          type="button"
          onClick={() => onChangeRole("mom")}
          style={{
            ...styles.roleButton,
            ...(role === "mom" ? styles.roleButtonActive : {}),
          }}
        >
          Mom or Partner
        </button>
        <button
          type="button"
          onClick={() => onChangeRole("doula")}
          style={{
            ...styles.roleButton,
            ...(role === "doula" ? styles.roleButtonActive : {}),
          }}
        >
          Doula
        </button>
      </Collapsible>

      <Collapsible title="Background sound" value={soundLabel}>
        {SOUND_OPTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChangeSound(s.id)}
            style={{
              ...styles.roleButton,
              ...(soundKey === s.id ? styles.roleButtonActive : {}),
            }}
          >
            {s.label}
          </button>
        ))}
      </Collapsible>

      <QuestionFooter onClick={onQuestion} />
    </main>
  );
}

// --- Role / onboarding ---
const ROLE_KEY = "birthsupport-role";

function WelcomeScreen({ onPick }) {
  return (
    <main style={styles.welcomeMain}>
      <h1 style={styles.welcomeTitle}>Time Contractions Supported</h1>
      <p style={styles.welcomeText}>
        Welcome. Let&apos;s set things up for you — who&apos;s using the app?
      </p>
      <div style={styles.welcomeButtons}>
        <button
          type="button"
          onClick={() => onPick("mom")}
          style={styles.welcomeButton}
        >
          I&apos;m a Mom or Partner
        </button>
        <button
          type="button"
          onClick={() => onPick("doula")}
          style={styles.welcomeButton}
        >
          I&apos;m a Doula
        </button>
      </div>
    </main>
  );
}

// A small, unobtrusive footer to reach the contacts screen from anywhere.
function QuestionFooter({ onClick }) {
  return (
    <button type="button" onClick={onClick} style={styles.questionFooter}>
      Have a question?
    </button>
  );
}

export default function Home() {
  const [phase, setPhase] = useState(READY);
  const [elapsed, setElapsed] = useState(0); // seconds in the current contraction
  const [now, setNow] = useState(() => Date.now()); // ticking clock for the rest screen
  const [history, setHistory] = useState([]); // newest first
  const [cardIndex, setCardIndex] = useState(0); // which card is current
  const [cardShown, setCardShown] = useState(0); // how many times current card has shown
  const [currentCard, setCurrentCard] = useState(null); // card shown on rest screen
  const [confirmingDelete, setConfirmingDelete] = useState(false); // showing "Are you sure?"
  const [menuOpen, setMenuOpen] = useState(false); // hamburger menu open?
  const [titleVisible, setTitleVisible] = useState(true); // show the top title at first
  const [soundKey, setSoundKey] = useState("silence"); // background sound choice
  const [affirmationIndex, setAffirmationIndex] = useState(0); // affirmation during contraction
  const [historyExpanded, setHistoryExpanded] = useState(false); // show all history rows?
  const [screen, setScreen] = useState("main"); // "main" | "breathing" | "contacts" | "checklist"
  const [contacts, setContacts] = useState(makeEmptyContacts); // saved phone numbers
  const [checklist, setChecklist] = useState(() => CHECKLIST_ITEMS.map(() => false));
  const [settings, setSettings] = useState(makeDefaultSettings); // feature on/off toggles
  const [role, setRole] = useState(null); // null (not chosen) | "mom" | "doula"
  const [activeAlert, setActiveAlert] = useState(null); // null | "stage1" | "stage2"
  const [stage1Shown, setStage1Shown] = useState(false); // 4-1-1 nudge already shown?
  const [stage2Shown, setStage2Shown] = useState(false); // 3-1-1 nudge already shown?
  const [hydrated, setHydrated] = useState(false); // has saved data loaded yet?

  const intervalRef = useRef(null); // holds the running 1-second ticker
  const startRef = useRef(null); // when the current contraction began
  const audioRef = useRef(null); // background sound player
  const soundKeyRef = useRef("silence"); // latest sound choice for event handlers
  soundKeyRef.current = soundKey;

  // When the app opens, load any saved data from this phone.
  useEffect(() => {
    // Testing helper: visiting "?test=411" or "?test=311" loads a fake hour of
    // contractions so the alerts can be previewed; "?test=clear" wipes everything.
    try {
      const test = new URLSearchParams(window.location.search).get("test");
      if (test) {
        if (test === "clear") {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(ALERTS_KEY);
          setHistory([]);
          setActiveAlert(null);
          setStage1Shown(false);
          setStage2Shown(false);
        } else if (test === "role") {
          // Forget the saved role so the welcome screen shows again.
          localStorage.removeItem(ROLE_KEY);
          setRole(null);
        } else if (test === "411" || test === "311") {
          const g = test === "411" ? 240 : 180; // seconds between starts
          const n = test === "411" ? 15 : 18; // enough to span ~an hour
          const now = Date.now();
          const fake = [];
          for (let i = 0; i < n; i++) {
            fake.push({
              startTime: now - i * g * 1000,
              durationSec: 60,
              gapSec: i === n - 1 ? null : g,
            });
          }
          setHistory(fake);
          setActiveAlert(null);
          setStage1Shown(false);
          setStage2Shown(false);
        }
        // Remove the ?test=... from the address bar so a refresh doesn't repeat it.
        window.history.replaceState({}, "", window.location.pathname);
        setHydrated(true);
        return;
      }
    } catch {
      // Ignore and fall through to normal loading.
    }

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
        if (Number.isInteger(savedCard.shown)) setCardShown(savedCard.shown);
      }
      const rawAlerts = localStorage.getItem(ALERTS_KEY);
      const savedAlerts = rawAlerts ? JSON.parse(rawAlerts) : null;
      if (savedAlerts && typeof savedAlerts === "object") {
        if (savedAlerts.active === "stage1" || savedAlerts.active === "stage2") {
          setActiveAlert(savedAlerts.active);
        }
        setStage1Shown(!!savedAlerts.s1);
        setStage2Shown(!!savedAlerts.s2);
      }
      const rawContacts = localStorage.getItem(CONTACTS_KEY);
      const savedContacts = rawContacts ? JSON.parse(rawContacts) : null;
      if (savedContacts && typeof savedContacts === "object") {
        const merged = makeEmptyContacts();
        for (const def of CONTACT_DEFS) {
          const s = savedContacts[def.id];
          if (s && typeof s === "object") {
            merged[def.id] = {
              name: typeof s.name === "string" ? s.name : "",
              phone: typeof s.phone === "string" ? s.phone : "",
            };
          }
        }
        setContacts(merged);
      }
      const rawChecklist = localStorage.getItem(CHECKLIST_KEY);
      const savedChecklist = rawChecklist ? JSON.parse(rawChecklist) : null;
      if (Array.isArray(savedChecklist)) {
        setChecklist(CHECKLIST_ITEMS.map((_, i) => savedChecklist[i] === true));
      }
      const rawSettings = localStorage.getItem(SETTINGS_KEY);
      const savedSettings = rawSettings ? JSON.parse(rawSettings) : null;
      if (savedSettings && typeof savedSettings === "object") {
        // Anything not explicitly false stays ON (the default).
        setSettings({
          cards: savedSettings.cards !== false,
          affirmations: savedSettings.affirmations !== false,
          keepAwake: savedSettings.keepAwake !== false,
          alerts: savedSettings.alerts !== false,
        });
      }
      const savedRole = localStorage.getItem(ROLE_KEY);
      if (savedRole === "mom" || savedRole === "doula") {
        setRole(savedRole);
      }
      const savedSound = localStorage.getItem(SOUND_KEY);
      if (savedSound && SOUND_OPTIONS.some((s) => s.id === savedSound)) {
        setSoundKey(savedSound);
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
        JSON.stringify({ index: cardIndex, shown: cardShown })
      );
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [cardIndex, cardShown, hydrated]);

  // Save the alert state (which is showing, which have already shown) so it survives a refresh.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        ALERTS_KEY,
        JSON.stringify({ active: activeAlert, s1: stage1Shown, s2: stage2Shown })
      );
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [activeAlert, stage1Shown, stage2Shown, hydrated]);

  // Save contacts on the device whenever they change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [contacts, hydrated]);

  // Save the prep checklist on the device whenever it changes.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(checklist));
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [checklist, hydrated]);

  // Save the settings on the device whenever they change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [settings, hydrated]);

  // Save the chosen role on the device.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (role) localStorage.setItem(ROLE_KEY, role);
      else localStorage.removeItem(ROLE_KEY);
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [role, hydrated]);

  // Save the background sound choice on the device.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SOUND_KEY, soundKey);
    } catch {
      // Saving is best-effort; ignore failures.
    }
  }, [soundKey, hydrated]);

  // Play / switch the looping background sound across all screens.
  useEffect(() => {
    if (!hydrated) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      audioRef.current.volume = 0.3; // gentle, low volume
    }
    const audio = audioRef.current;
    const choice = SOUND_OPTIONS.find((s) => s.id === soundKey);
    if (!choice || !choice.src) {
      audio.pause(); // "Silence"
      return;
    }
    if (!audio.src.endsWith(choice.src)) {
      audio.src = choice.src; // switching sources stops the old one
    }
    // May be blocked until a user gesture, or fail if the file isn't added yet.
    audio.play().catch(() => {});
  }, [soundKey, hydrated]);

  // Browsers block audio until the user interacts; resume on the first tap.
  useEffect(() => {
    function resume() {
      const audio = audioRef.current;
      if (audio && soundKeyRef.current !== "silence" && audio.paused) {
        audio.play().catch(() => {});
      }
    }
    window.addEventListener("pointerdown", resume);
    return () => {
      window.removeEventListener("pointerdown", resume);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  // Re-check the pattern whenever a new contraction is logged (and once on load).
  // Each nudge shows only once; the 3-1-1 nudge can still appear after the 4-1-1 one.
  useEffect(() => {
    if (!hydrated || !settings.alerts) return;
    if (patternHolds(history, GAP_311) && !stage2Shown) {
      setActiveAlert("stage2");
      setStage1Shown(true); // we've moved past the "get ready" point
      setStage2Shown(true);
    } else if (patternHolds(history, GAP_411) && !stage1Shown) {
      setActiveAlert("stage1");
      setStage1Shown(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, hydrated, settings.alerts]);

  // Safety net: if the page ever unmounts mid-contraction, stop the ticker.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Show the app title at the top for the first 10 seconds, then fade it away.
  useEffect(() => {
    const id = setTimeout(() => setTitleVisible(false), 10000);
    return () => clearTimeout(id);
  }, []);

  // Keep the phone screen awake while the app is open and visible (if enabled).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return; // older browser: do nothing, app works normally
    }
    if (!settings.keepAwake) {
      return; // setting turned off: don't hold the screen awake
    }

    let wakeLock = null;

    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // e.g. tab not visible or request denied — ignore quietly
      }
    };

    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        requestWakeLock(); // phones drop the lock when away — re-acquire it
      } else if (wakeLock) {
        try {
          await wakeLock.release();
        } catch {
          // ignore
        }
        wakeLock = null;
      }
    };

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };
  }, [settings.keepAwake]);

  // While a contraction is in progress, slowly rotate the affirmation on its own.
  useEffect(() => {
    if (phase !== ACTIVE || !settings.affirmations) return;
    // Fresh affirmation at the start of each contraction.
    setAffirmationIndex((prev) => nextAffirmation(prev));
    const id = setInterval(() => {
      setAffirmationIndex((prev) => nextAffirmation(prev));
    }, AFFIRMATION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, settings.affirmations]);

  // While resting (no contraction in progress), tick a clock once a second so the
  // "time since your last contraction" line stays current.
  useEffect(() => {
    if (phase === ACTIVE) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  function clearHistory() {
    setHistory([]); // also empties the saved copy via the save effect
    setConfirmingDelete(false);
  }

  function dismissAlert() {
    setActiveAlert(null);
  }

  function updateContact(id, field, value) {
    setContacts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function toggleChecklistItem(index) {
    setChecklist((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  function toggleSetting(id) {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
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

    // Show the current partner support card. Keep it for CARD_SPAN contractions,
    // then move on to the next card.
    setCurrentCard(SUPPORT_CARDS[cardIndex]);
    const shownNow = cardShown + 1;
    if (shownNow >= CARD_SPAN) {
      setCardIndex((cardIndex + 1) % SUPPORT_CARDS.length);
      setCardShown(0);
    } else {
      setCardShown(shownNow);
    }

    setPhase(REST);
  }

  const isActive = phase === ACTIVE;
  const lastContraction = history[0];
  const showHistory = phase !== ACTIVE && history.length > 0;
  const sinceSeconds =
    history.length > 0
      ? Math.max(0, Math.floor((now - history[0].startTime) / 1000))
      : 0;

  // Mom/Partner and Doula now look the same (the soft teal theme on every
  // screen). The roles are kept for a future price difference, not the look.
  const homeBg = "#86c9bd";
  const subBg = "#86c9bd"; // contacts / checklist
  const settingsBg = "#86c9bd";

  // Wait for saved data before deciding, to avoid flashing the welcome screen.
  if (!hydrated) {
    return <main style={styles.bootMain} />;
  }
  // First launch (no role saved yet): show the welcome / role picker.
  if (!role) {
    return <WelcomeScreen onPick={(r) => setRole(r)} />;
  }

  // The breathing guide is just a different screen of this same component, so the
  // contraction timer keeps running underneath and its history is untouched.
  if (screen === "breathing") {
    return (
      <BreathingGuide
        onBack={() => setScreen("main")}
        onQuestion={() => setScreen("contacts")}
      />
    );
  }
  if (screen === "contacts") {
    return (
      <ContactsScreen
        contacts={contacts}
        onChange={updateContact}
        onBack={() => setScreen("main")}
        bg={subBg}
      />
    );
  }
  if (screen === "checklist") {
    return (
      <ChecklistScreen
        checked={checklist}
        onToggle={toggleChecklistItem}
        onBack={() => setScreen("main")}
        bg={subBg}
        onQuestion={() => setScreen("contacts")}
      />
    );
  }
  if (screen === "settings") {
    return (
      <SettingsScreen
        settings={settings}
        onToggle={toggleSetting}
        onBack={() => setScreen("main")}
        bg={settingsBg}
        role={role}
        onChangeRole={setRole}
        soundKey={soundKey}
        onChangeSound={setSoundKey}
        onQuestion={() => setScreen("contacts")}
      />
    );
  }

  return (
    <main style={{ ...styles.main, background: homeBg }}>
      <header style={{ ...styles.title, opacity: titleVisible ? 1 : 0 }}>
        Time Contractions Supported
      </header>

      <button
        type="button"
        style={styles.hamburger}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={menuOpen}
      >
        ☰
      </button>

      {menuOpen && (
        <>
          <div style={styles.menuBackdrop} onClick={() => setMenuOpen(false)} />
          <nav style={styles.menuPanel}>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                setScreen("breathing");
                setMenuOpen(false);
              }}
            >
              Breathing Guide
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                setScreen("checklist");
                setMenuOpen(false);
              }}
            >
              Prep Checklist
            </button>
            <button
              type="button"
              style={styles.menuItem}
              onClick={() => {
                setScreen("settings");
                setMenuOpen(false);
              }}
            >
              Settings
            </button>
          </nav>
        </>
      )}

      {activeAlert && settings.alerts && (
        <div style={styles.alertBox} role="status">
          <p style={styles.alertHeadline}>{ALERT_MESSAGES[activeAlert].headline}</p>
          <p style={styles.alertText}>{ALERT_MESSAGES[activeAlert].body}</p>
          <div style={styles.alertActions}>
            {activeAlert === "stage2" && contacts.doctor.phone.trim() !== "" && (
              <a href={telHref(contacts.doctor.phone)} style={styles.alertCallButton}>
                Call now
              </a>
            )}
            <button type="button" onClick={dismissAlert} style={styles.alertButton}>
              Got it
            </button>
          </div>
        </div>
      )}

      <section style={styles.stage}>
        {/* Top area changes with the phase */}
        {isActive && <div style={styles.timer}>{formatClock(elapsed)}</div>}

        {isActive && settings.affirmations && (
          <p key={affirmationIndex} style={styles.affirmation}>
            {AFFIRMATIONS[affirmationIndex]}
          </p>
        )}

        {phase === REST && currentCard && settings.cards && (
          <div style={styles.card}>
            <p style={styles.cardLabel}>For your partner</p>
            <p style={styles.cardAction}>{currentCard}</p>
          </div>
        )}

        {!isActive && (
          <div style={styles.restBlock}>
            <p style={styles.restMessage}>
              Rest now. Breathe slowly. You&apos;re doing beautifully.
            </p>
            {history.length > 0 && (
              <>
                <p style={styles.restLasted}>
                  Your last contraction lasted{" "}
                  {formatDuration(lastContraction.durationSec)}
                </p>
                <p style={styles.restSince}>
                  It&apos;s been {formatDuration(sinceSeconds)} since your last
                  contraction
                </p>
              </>
            )}
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
      </section>

      {showHistory && (
        <section style={styles.historyWrap}>
          <h2 style={styles.historyTitle}>History</h2>
          <ul style={styles.historyList}>
            {(historyExpanded ? history : history.slice(0, HISTORY_COLLAPSED)).map(
              (c) => (
                <li key={c.startTime} style={styles.historyRow}>
                  {`Lasted ${formatDuration(c.durationSec)}${
                    c.gapSec != null ? ` · ${formatDuration(c.gapSec)} apart` : ""
                  }`}
                </li>
              )
            )}
          </ul>

          {history.length > HISTORY_COLLAPSED && (
            <button
              type="button"
              onClick={() => setHistoryExpanded((v) => !v)}
              style={styles.expandButton}
              aria-label={historyExpanded ? "Show fewer contractions" : "Show all contractions"}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a98591"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: historyExpanded ? "rotate(180deg)" : "none",
                  transition: "transform 0.2s ease",
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}

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

      <QuestionFooter onClick={() => setScreen("contacts")} />
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
    padding: "1.5rem 1.5rem 4rem",
    boxSizing: "border-box",
    background: "#9ed0c6",
    fontFamily:
      "Georgia, 'Times New Roman', Times, serif",
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
    transition: "opacity 1s ease",
    pointerEvents: "none",
  },
  hamburger: {
    position: "fixed",
    top: "0.9rem",
    right: "1rem",
    width: "2.6rem",
    height: "2.6rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255, 255, 255, 0.8)",
    border: "1px solid rgba(80, 80, 80, 0.18)",
    borderRadius: "12px",
    color: "#4f4f4f",
    fontSize: "1.5rem",
    lineHeight: 1,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    zIndex: 30,
  },
  menuBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 25,
  },
  menuPanel: {
    position: "fixed",
    top: "3.6rem",
    right: "1rem",
    minWidth: "190px",
    display: "flex",
    flexDirection: "column",
    padding: "0.4rem",
    background: "#ffffff",
    borderRadius: "14px",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.18)",
    zIndex: 30,
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "0.85rem 1rem",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    color: "#4f4f4f",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  stage: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.4rem",
  },
  timer: {
    fontSize: "min(22vw, 5.5rem)",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "#5a4650",
    lineHeight: 1,
  },
  affirmation: {
    margin: 0,
    maxWidth: "20rem",
    fontSize: "1.5rem",
    fontWeight: 500,
    lineHeight: 1.45,
    color: "#7a5e68",
    animation: "affirmationFade 1s ease",
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
    transition: "background 0.3s ease, transform 0.15s ease",
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
  restBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  restMessage: {
    margin: 0,
    maxWidth: "20rem",
    fontSize: "1.3rem",
    lineHeight: 1.5,
    color: "#4f4347",
  },
  restLasted: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#4f4347",
  },
  restSince: {
    margin: 0,
    fontSize: "1rem",
    color: "#6e5f64",
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
    marginTop: "1.5rem",
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
  alertBox: {
    width: "min(90vw, 360px)",
    margin: "0 0 1.75rem 0",
    padding: "1.1rem 1.25rem",
    background: "#fbeef0",
    border: "1px solid #e3aeba",
    borderRadius: "16px",
    boxShadow: "0 6px 18px rgba(180, 110, 130, 0.18)",
  },
  alertHeadline: {
    margin: "0 0 0.5rem 0",
    fontSize: "1.3rem",
    fontWeight: 700,
    color: "#8a5563",
  },
  alertText: {
    margin: "0 0 1rem 0",
    fontSize: "1.02rem",
    lineHeight: 1.45,
    color: "#6b5560",
  },
  alertActions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.6rem",
  },
  alertCallButton: {
    display: "inline-block",
    padding: "0.75rem 1.9rem",
    background: "#c76b82",
    borderRadius: "999px",
    color: "#ffffff",
    fontSize: "1.1rem",
    fontWeight: 700,
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
  },
  alertButton: {
    padding: "0.6rem 1.6rem",
    background: "#e08aa0",
    border: "none",
    borderRadius: "999px",
    color: "#ffffff",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  contactsMain: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4.5rem 1.5rem 2.5rem",
    boxSizing: "border-box",
    gap: "1.25rem",
    fontFamily:
      "Georgia, 'Times New Roman', Times, serif",
    color: "#34564f",
  },
  contactsTitle: {
    fontSize: "1.05rem",
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#2f5a53",
  },
  contactsIntro: {
    margin: 0,
    maxWidth: "20rem",
    fontSize: "1rem",
    lineHeight: 1.4,
    color: "#4a6b66",
    textAlign: "center",
  },
  contactCard: {
    width: "min(92vw, 380px)",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    padding: "1.1rem",
    boxSizing: "border-box",
    background: "rgba(255, 255, 255, 0.65)",
    border: "1px solid #8fc4ba",
    borderRadius: "16px",
  },
  contactLabel: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#2f5a53",
  },
  contactInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.7rem 0.9rem",
    fontSize: "1.05rem",
    borderRadius: "10px",
    border: "1px solid #9ec9c2",
    background: "#ffffff",
    color: "#333333",
  },
  contactActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.25rem",
  },
  callButton: {
    flex: 1,
    textAlign: "center",
    padding: "0.85rem",
    borderRadius: "999px",
    background: "#4e9e90",
    color: "#ffffff",
    fontSize: "1.1rem",
    fontWeight: 600,
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
  },
  textButton: {
    flex: 1,
    boxSizing: "border-box",
    textAlign: "center",
    padding: "0.85rem",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.9)",
    border: "1px solid #4e9e90",
    color: "#2f5a53",
    fontSize: "1.1rem",
    fontWeight: 600,
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
  },
  checklistMain: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4.5rem 1.5rem 4.5rem",
    boxSizing: "border-box",
    gap: "1.25rem",
    fontFamily:
      "Georgia, 'Times New Roman', Times, serif",
    color: "#34564f",
  },
  checklistList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    width: "min(92vw, 380px)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  checklistRow: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem 1.1rem",
    background: "rgba(255, 255, 255, 0.65)",
    border: "1px solid #8fc4ba",
    borderRadius: "14px",
    cursor: "pointer",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  checklistRowDone: {
    background: "rgba(78, 158, 144, 0.18)",
  },
  checkbox: {
    flexShrink: 0,
    width: "28px",
    height: "28px",
    borderRadius: "7px",
    border: "2px solid #4e9e90",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#ffffff",
    background: "transparent",
    lineHeight: 1,
  },
  checkboxDone: {
    background: "#4e9e90",
  },
  checklistText: {
    fontSize: "1.2rem",
    fontWeight: 600,
    color: "#2f5a53",
  },
  checklistTextDone: {
    textDecoration: "line-through",
    color: "#5a8079",
  },
  settingsList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    width: "min(92vw, 380px)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  settingsRow: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "1rem 1.1rem",
    background: "rgba(255, 255, 255, 0.65)",
    border: "1px solid #8fc4ba",
    borderRadius: "14px",
    cursor: "pointer",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  settingsLabel: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#2f5a53",
  },
  switchTrack: {
    position: "relative",
    flexShrink: 0,
    width: "52px",
    height: "30px",
    borderRadius: "999px",
    transition: "background 0.2s ease",
    display: "inline-block",
  },
  switchKnob: {
    position: "absolute",
    top: "3px",
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "#ffffff",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
    transition: "left 0.2s ease",
  },
  roleSection: {
    width: "min(92vw, 380px)",
    marginTop: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  collapsible: {
    width: "min(92vw, 380px)",
    background: "rgba(255, 255, 255, 0.65)",
    border: "1px solid #8fc4ba",
    borderRadius: "14px",
    overflow: "hidden",
  },
  collapsibleHeader: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "1rem 1.1rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  collapsibleTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#2f5a53",
  },
  collapsibleRight: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  collapsibleValue: {
    fontSize: "0.95rem",
    color: "#5a8079",
  },
  collapsibleBody: {
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    padding: "0 1.1rem 1.1rem 1.1rem",
  },
  roleHeading: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#2f5a53",
    textAlign: "center",
  },
  roleButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  },
  roleButton: {
    padding: "0.85rem 1.25rem",
    background: "rgba(255, 255, 255, 0.72)",
    border: "1px solid rgba(80, 80, 80, 0.18)",
    borderRadius: "999px",
    color: "#4f4f4f",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.15s ease, background 0.2s ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  roleButtonActive: {
    background: "#4e9e90",
    borderColor: "#4e9e90",
    color: "#ffffff",
  },
  bootMain: {
    minHeight: "100vh",
    background: "#9ed0c6",
  },
  welcomeMain: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "1.5rem",
    boxSizing: "border-box",
    gap: "1.5rem",
    background: "#f7e3ec",
    color: "#5a4650",
    fontFamily: "Georgia, 'Times New Roman', Times, serif",
  },
  welcomeTitle: {
    margin: 0,
    fontSize: "2.6rem",
    fontWeight: 700,
    color: "#5a4650",
    letterSpacing: "0.5px",
  },
  welcomeText: {
    margin: 0,
    maxWidth: "20rem",
    fontSize: "1.2rem",
    lineHeight: 1.5,
    color: "#7a6470",
  },
  welcomeButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    width: "min(85vw, 320px)",
  },
  welcomeButton: {
    padding: "1.1rem 1.5rem",
    background: "#e08aa0",
    border: "none",
    borderRadius: "999px",
    color: "#ffffff",
    fontSize: "1.2rem",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(180, 110, 130, 0.3)",
    transition: "transform 0.15s ease, background 0.2s ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  footerLinks: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.6rem",
    marginTop: "0.5rem",
  },
  questionFooter: {
    position: "fixed",
    bottom: "0.9rem",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "0.5rem 1.1rem",
    background: "rgba(255, 255, 255, 0.78)",
    border: "1px solid rgba(80, 80, 80, 0.18)",
    borderRadius: "999px",
    color: "#4f4f4f",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    zIndex: 20,
  },
  footerLink: {
    padding: "0.8rem 1.5rem",
    background: "rgba(255, 255, 255, 0.72)",
    border: "1px solid rgba(80, 80, 80, 0.18)",
    borderRadius: "999px",
    color: "#4f4f4f",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.15s ease, background 0.2s ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  breathMain: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "1.5rem 1.5rem 3.75rem",
    boxSizing: "border-box",
    gap: "1.75rem",
    background: "#f6bfd2",
    fontFamily:
      "Georgia, 'Times New Roman', Times, serif",
    color: "#5e4b8b",
  },
  backButton: {
    position: "fixed",
    top: "1rem",
    left: "1rem",
    padding: "0.6rem 1.2rem",
    background: "rgba(255, 255, 255, 0.78)",
    border: "1px solid rgba(80, 80, 80, 0.18)",
    borderRadius: "999px",
    color: "#4f4f4f",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.15s ease, background 0.2s ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  breathTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#9784c0",
  },
  circleWrap: {
    width: CIRCLE_BASE,
    height: CIRCLE_BASE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  breathCircle: {
    width: CIRCLE_BASE,
    height: CIRCLE_BASE,
    borderRadius: "50%",
    background: "radial-gradient(circle at 50% 40%, #c9b3ef, #a98fdf)",
    boxShadow: "0 10px 30px rgba(120, 90, 180, 0.3)",
    willChange: "transform",
  },
  breathWord: {
    margin: 0,
    minHeight: "2.4rem",
    fontSize: "2rem",
    fontWeight: 600,
    color: "#5e4b8b",
  },
  patternRow: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "0.75rem",
  },
  patternButton: {
    padding: "0.7rem 1.25rem",
    background: "rgba(255, 255, 255, 0.6)",
    border: "1px solid #c9b8e8",
    borderRadius: "999px",
    color: "#5e4b8b",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  patternButtonActive: {
    background: "#9b7fd4",
    borderColor: "#9b7fd4",
    color: "#ffffff",
  },
  expandButton: {
    display: "block",
    margin: "0.5rem auto 0 auto",
    padding: "0.35rem 1rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    lineHeight: 0,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  shareButton: {
    display: "block",
    margin: "1.25rem auto 0 auto",
    padding: "0.7rem 1.4rem",
    background: "rgba(255, 255, 255, 0.72)",
    border: "1px solid rgba(80, 80, 80, 0.18)",
    borderRadius: "999px",
    color: "#4f4f4f",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.15s ease, background 0.2s ease",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  shareMsg: {
    margin: "0.6rem auto 0 auto",
    maxWidth: "20rem",
    fontSize: "0.95rem",
    color: "#3f5f5a",
    textAlign: "center",
  },
  deleteButton: {
    display: "block",
    margin: "0.75rem auto 0 auto",
    padding: "0.7rem 1.4rem",
    background: "rgba(255, 255, 255, 0.55)",
    border: "1px solid rgba(80, 80, 80, 0.15)",
    borderRadius: "999px",
    color: "#7a7a7a",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "transform 0.15s ease, background 0.2s ease",
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
