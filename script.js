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
========================= */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

/* =========================
   2) SETTINGS
========================= */
const GAME_DOC_ID = "sluta-snusa";      // games/sluta-snusa
const ALLAR_PHONE = "+46700000000";     // byt till ditt nummer
const TOTAL_DAYS = 60;

// Dag 1 öppen direkt: kör new Date()
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

function dateForDay(dayNumber) {
  const d = new Date(startDate);
  d.setDate(startDate.getDate() + (dayNumber - 1));
  return d;
}

function isLocked(dayNumber) {
  return new Date() < dateForDay(dayNumber);
}

/* ===== Confetti ===== */
function confettiBurst(intensity = "normal") {
  const emojis = ["🎉", "🎊", "⚽", "🔵", "🔴", "✨"];
  const count = intensity === "mega" ? 120 : 24;
  const duration = intensity === "mega" ? 2200 : 1400;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];

    el.style.left = Math.random() * 100 + "vw";
    el.style.fontSize = (14 + Math.random() * (intensity === "mega" ? 28 : 18)) + "px";

    // lite mer spridning i mega-läget
    const drift = (Math.random() - 0.5) * (intensity === "mega" ? 400 : 120);
    const rotate = Math.random() * 720;

    el.animate(
      [
        { transform: `translate(0, -20px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${drift}px, 110vh) rotate(${rotate}deg)`, opacity: 0.2 }
      ],
      { duration, easing: "linear", fill: "forwards" }
    );

    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration + 50);
  }
}

/* =========================
   4) MAIN INIT (felsäker)
========================= */
async function init() {
  // ----- A) Rendera kalendern direkt -----
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
    // när man byter person: uppdatera status/knappar om modal är öppen
    if (currentDay) updateStatusLine(currentDay);
  }

  bittiBtn && (bittiBtn.onclick = () => setWho("bitti"));
  mattiasBtn && (mattiasBtn.onclick = () => setWho("mattias"));
  if (who && whoChosen) whoChosen.textContent = `✅ ${who === "bitti" ? "Bitti" : "Mattias"}`;

  // ----- D) Ladda content.json -----
  let content = {};
  try {
    content = await fetch("content.json").then((r) => r.json());
  } catch (e) {
    console.error("Failed to load content.json", e);
  }

  // ----- E) Firebase init + auth -----
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error("Anonymous auth failed:", e);
  }

  const gameRef = doc(db, "games", GAME_DOC_ID);

  // ----- F) State + realtime -----
  let gameState = null;
  let currentDay = null;

  // mega-confetti trigger så vi inte spammar när snapshot uppdateras flera gånger
  // nyckel: `${day}-opened` eller `${day}-both`
  const fired = new Set();

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

  // ===== Polished status + Mega confetti rules =====
  function updateStatusLine(day) {
    const line = $("#statusLine");
    const challengeDoneBtn = $("#challengeDoneBtn");
    if (!line) return;

    if (!gameState) {
      line.textContent = "Status: väntar på synk…";
      if (challengeDoneBtn) {
        challengeDoneBtn.disabled = true;
        challengeDoneBtn.textContent = "⭐ Jag klarade utmaningen";
      }
      return;
    }

    const bOpened = openedSet("bitti").has(day);
    const mOpened = openedSet("mattias").has(day);
    const bCh = challengeSet("bitti").has(day);
    const mCh = challengeSet("mattias").has(day);

    line.textContent =
      `Dag ${day} — Öppnad: Bitti ${bOpened ? "✅" : "⏳"} | Mattias ${mOpened ? "✅" : "⏳"} • ` +
      `Utmaning: Bitti ${bCh ? "⭐" : "—"} | Mattias ${mCh ? "⭐" : "—"}`;

    // Lås / ändra text på utmaningsknappen om DU redan gjort den
    if (challengeDoneBtn) {
      if (!who) {
        challengeDoneBtn.disabled = true;
        challengeDoneBtn.textContent = "⭐ Välj Bitti/Mattias först";
      } else {
        const iDid = challengeSet(who).has(day);
        challengeDoneBtn.disabled = iDid;
        challengeDoneBtn.textContent = iDid
          ? "⭐ Utmaningen redan klar"
          : "⭐ Jag klarade utmaningen";
      }
    }

    // Text + bonus när båda gjort utmaningen
    if (bCh && mCh) {
      line.textContent += "  🎉 Båda klara!";
    }

    // MEGA CONFETTI när båda har öppnat samma dag (en gång per dag)
    if (bOpened && mOpened) {
      const key = `${day}-opened`;
      if (!fired.has(key)) {
        fired.add(key);
        confettiBurst("mega");
      }
    }

    // EXTRA MEGA (en gång per dag) om båda även klarat utmaningen
    if (bOpened && mOpened && bCh && mCh) {
      const key2 = `${day}-both`;
      if (!fired.has(key2)) {
        fired.add(key2);
        // dubbel-burst för extra wow
        confettiBurst("mega");
        setTimeout(() => confettiBurst("mega"), 350);
      }
    }
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
      // liten burst för "jag öppnade"
      confettiBurst("normal");
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
      confettiBurst("normal");
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
  const statusLine = $("#statusLine");

  function openModal(day) {
    currentDay = day;

    // sätt en direkt status (ingen "laddar")
    if (statusLine) statusLine.textContent = "Status: väntar på synk…";

    const d = content?.[String(day)];
    if (contentEl) contentEl.textContent = d?.text ?? "💙 Idag: fortsätt bara. / Allar";
    if (challengeEl) challengeEl.textContent = d?.challenge ?? "Gör något snällt för någon idag.";

    // ring-knapp var 10:e dag (valfritt att även ge bonus senare)
    if (callAllarBtn) {
      if (day % 10 === 0) {
        callAllarBtn.classList.remove("hidden");
        callAllarBtn.href = `tel:${ALLAR_PHONE}`;
      } else {
        callAllarBtn.classList.add("hidden");
      }
    }

    // Uppdatera status (om gameState redan finns)
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

      openModal(day);

      // ge öppningspoäng + markera öppnad
      await awardOpenDay(day);
      updateStatusLine(day);
    });
  });
}

init().catch((err) => {
  console.error("Init failed:", err);
});
