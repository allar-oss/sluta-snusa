import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   1) FYLL I DIN FIREBASE CONFIG
   (Firebase Console -> Project settings -> Your apps -> Web app)
========================= */

  const firebaseConfig = {
  apiKey: "AIzaSyBHOGcSZ1o4YGSVQMo6cgJATqUz51GUPt0",
  authDomain: "sluta-snusa-add0a.firebaseapp.com",
  projectId: "sluta-snusa-add0a",
  storageBucket: "sluta-snusa-add0a.firebasestorage.app",
  messagingSenderId: "1091597533744",
  appId: "1:1091597533744:web:35226b31e0a5fbbc7663f5",
  measurementId: "G-7C6R0LML9W"
};
};

/* =========================
   2) SETTINGS
========================= */
const GAME_DOC_ID = "sluta-snusa";      // games/sluta-snusa
const ALLAR_PHONE = "+46700000000";     // byt till ditt riktiga nummer
const TOTAL_DAYS = 60;

// Startdatum för “en ruta per dag”.
// Vill du att dag 1 alltid ska vara öppen direkt: kör new Date()
const startDate = new Date();

const backgrounds = [
  "images/bg1.jpg",
  "images/bg2.jpg",
  "images/bg3.jpg",
  "images/bg4.jpg"
];

/* =========================
   3) HELPERS
========================= */
function $(sel) {
  const el = document.querySelector(sel);
  if (!el) console.warn("Missing element:", sel);
  return el;
}

function popConfetti() {
  const emojis = ["🎉", "🎊", "⚽", "🔵", "🔴"];
  for (let i = 0; i < 22; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + "vw";
    el.style.fontSize = (16 + Math.random() * 18) + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
}

function dateForDay(dayNumber) {
  const d = new Date(startDate);
  d.setDate(startDate.getDate() + (dayNumber - 1));
  return d;
}

function isLocked(dayNumber) {
  return new Date() < dateForDay(dayNumber);
}

/* =========================
   4) MAIN INIT (felsäker)
========================= */
async function init() {
  // ----- A) Rendera kalendern direkt (oavsett Firebase) -----
  const calendar = $(".calendar");
  if (!calendar) return;

  calendar.innerHTML = "";
  for (let i = 1; i <= TOTAL_DAYS; i++) {
    const tile = document.createElement("div");
    tile.className = "day";
    tile.dataset.day = String(i);
    tile.textContent = String(i);
    if (isLocked(i)) tile.classList.add("locked");
    calendar.appendChild(tile);
  }

  // ----- B) Bakgrundsbildspel -----
  let bgIndex = 0;
  function changeBackground() {
    // om bilder saknas, låt det bara vara (ingen crash)
    document.body.style.backgroundImage = `url('${backgrounds[bgIndex]}')`;
    bgIndex = (bgIndex + 1) % backgrounds.length;
  }
  changeBackground();
  setInterval(changeBackground, 15000);

  // ----- C) UI: välj spelare -----
  let who = localStorage.getItem("who"); // "bitti" | "mattias"
  const whoChosen = $("#whoChosen");
  const bittiBtn = $("#iAmBitti");
  const mattiasBtn = $("#iAmMattias");

  function setWho(v) {
    who = v;
    localStorage.setItem("who", v);
    if (whoChosen) whoChosen.textContent = `✅ ${v === "bitti" ? "Bitti" : "Mattias"}`;
  }

  bittiBtn && (bittiBtn.onclick = () => setWho("bitti"));
  mattiasBtn && (mattiasBtn.onclick = () => setWho("mattias"));
  if (who && whoChosen) whoChosen.textContent = `✅ ${who === "bitti" ? "Bitti" : "Mattias"}`;

  // ----- D) Ladda content.json (behövs för modaltext) -----
  let content = {};
  try {
    content = await fetch("content.json").then((r) => r.json());
  } catch (e) {
    console.error("Failed to load content.json", e);
    // vi låter appen fortsätta ändå
  }

  // ----- E) Firebase init + auth + firestore -----
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error("Anonymous auth failed:", e);
    // kalendern finns ändå – men synk funkar inte
  }

  const gameRef = doc(db, "games", GAME_DOC_ID);

  // ----- F) State + realtime -----
  let gameState = null;
  let currentDay = null;

  function getParticipant(p) {
    return gameState?.participants?.[p] ?? null;
  }
  function openedSet(p) {
    return new Set(getParticipant(p)?.openedDays ?? []);
  }
  function challengeSet(p) {
    return new Set(getParticipant(p)?.challengeDoneDays ?? []);
  }

  function updateLeaderboard() {
    const bPts = getParticipant("bitti")?.points ?? 0;
    const mPts = getParticipant("mattias")?.points ?? 0;
    const pb = $("#pointsBitti");
    const pm = $("#pointsMattias");
    if (pb) pb.textContent = String(bPts);
    if (pm) pm.textContent = String(mPts);
  }
  const statusLine = document.getElementById("statusLine");
if (statusLine) {
  statusLine.textContent = "Status: väntar på synk…";
}


  function updateStatusLine(day) {
    const line = $("#statusLine");
    if (!line) return;

    if (!gameState) {
      line.textContent = "Status: laddar…";
      return;
    }

    const bOpened = openedSet("bitti").has(day);
    const mOpened = openedSet("mattias").has(day);
    const bCh = challengeSet("bitti").has(day);
    const mCh = challengeSet("mattias").has(day);

    line.textContent =
      `Dag ${day} — Öppnad: Bitti ${bOpened ? "✅" : "⏳"} | Mattias ${mOpened ? "✅" : "⏳"} • ` +
      `Utmaning: Bitti ${bCh ? "⭐" : "—"} | Mattias ${mCh ? "⭐" : "—"}`;

    // Bonus-känsla när båda öppnat
    if (bOpened && mOpened) popConfetti();
  }

  // Realtime lyssning
  try {
    onSnapshot(gameRef, (snap) => {
      gameState = snap.data() || null;
      updateLeaderboard();
      if (currentDay) updateStatusLine(currentDay);
    });
  } catch (e) {
    console.error("onSnapshot failed:", e);
  }

  // ----- G) Firestore actions -----
  async function awardOpenDay(day) {
    if (!who) {
      alert("Välj Bitti eller Mattias först.");
      return;
    }
    try {
      await updateDoc(gameRef, {
        [`participants.${who}.openedDays`]: arrayUnion(day),
        [`participants.${who}.points`]: increment(1),
        updatedAt: serverTimestamp()
      });
      popConfetti();
    } catch (e) {
      console.error("awardOpenDay failed:", e);
      alert("Kunde inte spara i Firebase. Kolla Console/loggar.");
    }
  }

  async function awardChallenge(day) {
    if (!who) {
      alert("Välj Bitti eller Mattias först.");
      return;
    }
    try {
      await updateDoc(gameRef, {
        [`participants.${who}.challengeDoneDays`]: arrayUnion(day),
        [`participants.${who}.points`]: increment(1),
        updatedAt: serverTimestamp()
      });
      popConfetti();
    } catch (e) {
      console.error("awardChallenge failed:", e);
      alert("Kunde inte spara utmaning i Firebase. Kolla Console/loggar.");
    }
  }

  // ----- H) Modal + klick på luckor -----
  const modal = $("#modal");
  const closeBtn = $("#close");
  const contentEl = $("#content");
  const challengeEl = $("#challengeText");
  const challengeDoneBtn = $("#challengeDoneBtn");
  const callAllarBtn = $("#callAllarBtn");

  function openModal(day) {
    currentDay = day;

    const d = content?.[String(day)];
    if (contentEl) contentEl.textContent = d?.text ?? "💙 Idag: fortsätt bara. / Allar";
    if (challengeEl) challengeEl.textContent = d?.challenge ?? "Gör något snällt för någon idag.";

    // ring-knapp var 10:e dag
    if (callAllarBtn) {
      if (day % 10 === 0) {
        callAllarBtn.classList.remove("hidden");
        callAllarBtn.href = `tel:${ALLAR_PHONE}`;
      } else {
        callAllarBtn.classList.add("hidden");
      }
    }

    updateStatusLine(day);
    modal && modal.classList.remove("hidden");
  }

  closeBtn && (closeBtn.onclick = () => modal && modal.classList.add("hidden"));
  challengeDoneBtn && (challengeDoneBtn.onclick = async () => {
    if (!currentDay) return;
    await awardChallenge(currentDay);
    updateStatusLine(currentDay);
  });

  // Klick på kalender
  calendar.querySelectorAll(".day").forEach((tile) => {
    tile.addEventListener("click", async () => {
      const day = Number(tile.dataset.day);

      if (tile.classList.contains("locked")) return;

      // Öppna modal direkt (så de ser texten även om Firebase strular)
      openModal(day);

      // Ge poäng + markera öppnad (Firebase)
      await awardOpenDay(day);
      updateStatusLine(day);
    });
  });
}

// Kör init
init().catch((err) => {
  console.error("Init failed:", err);
});


