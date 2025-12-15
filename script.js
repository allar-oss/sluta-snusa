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

// Dag 1 öppen direkt:
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

    const drift = (Math.random() - 0.5) * (intensity === "mega" ? 420 : 140);
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

  // anti-spam för mega-confetti (per dag)
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
  function callBonusSet(p) {
    return new Set(getParticipant(p)?.callBonusDays ?? []);
  }

  function updateLeaderboard() {
    const bPts = getParticipant("bitti")?.points ?? 0;
    const mPts = getParticipant("mattias")?.points ?? 0;
    const pb = $("#pointsBitti");
    const pm = $("#pointsMattias");
    if (pb) pb.textContent = String(bPts);
    if (pm) pm.textContent = String(mPts);
  }

  function updateStatusLine(day) {
    const line = $("#statusLine");
    const challengeDoneBtn = $("#challengeDoneBtn");
    const callBtn = $("#callAllarBtn");
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

    // Lås/ändra text på utmaningsknappen om DU redan gjort den
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

    // Ring-Allar-bonus (endast dag 10/20/30/40/50/60)
    if (callBtn) {
      const isCallDay = day % 10 === 0;
      if (!isCallDay) {
        callBtn.classList.add("hidden");
      } else {
        callBtn.classList.remove("hidden");
        callBtn.href = `tel:${ALLAR_PHONE}`;

        if (who) {
          const claimed = callBonusSet(who).has(day);
          callBtn.textContent = claimed
            ? "✅ Ring Allar (bonus redan tagen)"
            : "📞 Ring Allar och hämta belöningen (+2p)";
          callBtn.classList.toggle("claimed", claimed);
        } else {
          callBtn.textContent = "📞 Ring Allar och hämta belöningen (+2p)";
          callBtn.classList.remove("claimed");
        }
      }
    }

    // Text + bonus när båda gjort utmaningen
    if (bCh && mCh) line.textContent += "  🎉 Båda klara!";

    // MEGA confetti när båda öppnat samma dag (en gång)
    if (bOpened && mOpened) {
      const key = `${day}-opened`;
      if (!fired.has(key)) {
        fired.add(key);
        confettiBurst("mega");
      }
    }

    // EXTRA MEGA om båda även gjort utmaningen (en gång)
    if (bOpened && mOpened && bCh && mCh) {
      const key2 = `${day}-both`;
      if (!fired.has(key2)) {
        fired.add(key2);
        confettiBurst("mega");
        setTimeout(() => confettiBurst("mega"), 350);
      }
    }
  }

  // Realtime
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
    if (!who) return alert("Välj Bitti eller Mattias först.");

    try {
      await updateDoc(gameRef, {
        [`participants.${who}.openedDays`]: arrayUnion(day),
        [`participants.${who}.points`]: increment(1),
        updatedAt: serverTimestamp()
      });
      confettiBurst("normal");
    } catch (e) {
      console.error("awardOpenDay failed:", e);
      alert("Kunde inte spara i Firebase. Kolla Console/loggar.");
    }
  }

  async function awardChallenge(day) {
    if (!who) return alert("Välj Bitti eller Mattias först.");

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

  // +2 poäng när man trycker ring-knappen (en gång per person per dag)
  async function awardCallBonus(day) {
    if (!who) return;

    // om redan tagen, gör inget
    if (gameState && callBonusSet(who).has(day)) return;

    try {
      await updateDoc(gameRef, {
        [`participants.${who}.callBonusDays`]: arrayUnion(day),
        [`participants.${who}.points`]: increment(2),
        updatedAt: serverTimestamp()
      });
      // lite extra fest
      confettiBurst("mega");
    } catch (e) {
      console.error("awardCallBonus failed:", e);
    }
  }

  // ----- H) Modal + klick -----
  const modal = $("#modal");
  const closeBtn = $("#close");
  const contentEl = $("#content");
  const challengeEl = $("#challengeText");
  const challengeDoneBtn = $("#challengeDoneBtn");
  const callAllarBtn = $("#callAllarBtn");
  const statusLine = $("#statusLine");

  function openModal(day) {
    currentDay = day;

    if (statusLine) statusLine.textContent = "Status: väntar på synk…";

    const d = content?.[String(day)];
    if (contentEl) contentEl.textContent = d?.text ?? "💙 Idag: fortsätt bara. / Allar";
    if (challengeEl) challengeEl.textContent = d?.challenge ?? "Gör något snällt för någon idag.";

    updateStatusLine(day);
    modal && modal.classList.remove("hidden");
  }

  closeBtn && (closeBtn.onclick = () => modal && modal.classList.add("hidden"));

  challengeDoneBtn && (challengeDoneBtn.onclick = async () => {
    if (!currentDay) return;
    await awardChallenge(currentDay);
    updateStatusLine(currentDay);
  });

  // När man klickar “Ring Allar”: ge +2 (utan att stoppa telefonlänken)
  callAllarBtn && callAllarBtn.addEventListener("click", () => {
    if (!currentDay) return;
    if (currentDay % 10 !== 0) return; // bara ring-dagar
    // fire-and-forget (för att tel: ska öppna snabbt)
    awardCallBonus(currentDay);
  });

  // Klick på kalender
  calendar.querySelectorAll(".day").forEach((tile) => {
    tile.addEventListener("click", async () => {
      const day = Number(tile.dataset.day);
      if (tile.classList.contains("locked")) return;

      openModal(day);

      await awardOpenDay(day);
      updateStatusLine(day);
    });
  });
}

init().catch((err) => console.error("Init failed:", err));
