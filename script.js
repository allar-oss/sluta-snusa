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
   1) FIREBASE CONFIG
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

/* =========================
   2) SETTINGS
========================= */
const GAME_DOC_ID = "sluta-snusa";     // games/sluta-snusa
const ALLAR_PHONE = "+46700000000";    // byt till ditt nummer
const TOTAL_DAYS = 60;

// Dag 1 blir öppen direkt (om du vill ha fast datum: new Date("2025-01-01"))
const startDate = new Date();

const backgrounds = ["images/bg1.jpg","images/bg2.jpg","images/bg3.jpg","images/bg4.jpg"];

/* =========================
   3) MONEY SETTINGS (localStorage)
========================= */
const MONEY_KEY = "moneySettings_v1";
function getMoneySettings(){
  const raw = localStorage.getItem(MONEY_KEY);
  if(raw){ try { return JSON.parse(raw); } catch {} }
  return { costPerDay: 69, startISO: new Date().toISOString().slice(0,10) };
}
function saveMoneySettings(obj){
  localStorage.setItem(MONEY_KEY, JSON.stringify(obj));
}

/* =========================
   4) HELPERS
========================= */
function $(sel) {
  const el = document.querySelector(sel);
  if (!el) console.warn("Missing element:", sel);
  return el;
}
function isLocked(dayNumber) {
  const d = new Date(startDate);
  d.setDate(startDate.getDate() + (dayNumber - 1));
  return new Date() < d;
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

/* ===== Streak ===== */
// Streak = antal dagar i rad från dag 1: [1,2,3,5] => 3
function computeStreak(openedDaysArr) {
  const set = new Set(openedDaysArr || []);
  let streak = 0;
  for (let d = 1; d <= TOTAL_DAYS; d++) {
    if (set.has(d)) streak++;
    else break;
  }
  return streak;
}

/* =========================
   5) BADGES (Barça)
========================= */
const BADGES = [
  { id:"pedri", title:"Pedri Pass", icon:"🧠", reqDays:3,  desc:"3 dagar – smart start, kontroll på mittfältet." },
  { id:"gavi", title:"Gavi Grit", icon:"💥", reqDays:7,  desc:"7 dagar – kämpaglöd, du viker inte." },
  { id:"araujo", title:"Araujo Wall", icon:"🛡️", reqDays:14, desc:"14 dagar – defensiven sitter." },
  { id:"lewa", title:"Lewy Finish", icon:"🎯", reqDays:21, desc:"21 dagar – målmaskin utan snus." },
  { id:"terstegen", title:"Ter Stegen Clean Sheet", icon:"🧤", reqDays:30, desc:"30 dagar – hållit nollan en månad." },
  { id:"xavi", title:"Xavi Maestro", icon:"🎼", reqDays:45, desc:"45 dagar – du styr tempot." },
  { id:"messi", title:"Messi Mode", icon:"🐐", reqDays:60, desc:"60 dagar – GOAT-level disciplin." }
];

/* =========================
   6) INIT
========================= */
async function init() {
  // ----- Rendera kalender direkt -----
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

  // ----- Background slideshow -----
  let bgIndex = 0;
  function changeBackground() {
    document.body.style.backgroundImage = `url('${backgrounds[bgIndex]}')`;
    bgIndex = (bgIndex + 1) % backgrounds.length;
  }
  changeBackground();
  setInterval(changeBackground, 15000);

  // ----- Välj person -----
  let who = localStorage.getItem("who"); // "bitti" | "mattias"
  const whoChosen = $("#whoChosen");

  function setWho(v) {
    who = v;
    localStorage.setItem("who", v);
    if (whoChosen) whoChosen.textContent = `✅ ${v === "bitti" ? "Bitti" : "Mattias"}`;
    if (currentDay) updateStatusLine(currentDay);
  }

  $("#iAmBitti") && ($("#iAmBitti").onclick = () => setWho("bitti"));
  $("#iAmMattias") && ($("#iAmMattias").onclick = () => setWho("mattias"));
  if (who && whoChosen) whoChosen.textContent = `✅ ${who === "bitti" ? "Bitti" : "Mattias"}`;

  // ----- Ladda content.json -----
  let content = {};
  try {
    content = await fetch("content.json").then((r) => r.json());
  } catch (e) {
    console.error("Failed to load content.json", e);
  }

  // ----- Money settings UI init -----
  const ms = getMoneySettings();
  const costInput = document.getElementById("costPerDay");
  const dateInput = document.getElementById("startDateInput");
  if (costInput) costInput.value = String(ms.costPerDay ?? 69);
  if (dateInput) dateInput.value = ms.startISO ?? new Date().toISOString().slice(0,10);

  document.getElementById("saveMoneySettings")?.addEventListener("click", () => {
    const cost = Number(costInput?.value || 69);
    const iso = dateInput?.value || new Date().toISOString().slice(0,10);
    saveMoneySettings({ costPerDay: Math.max(0, cost), startISO: iso });
    confettiBurst("normal");
    updateMoney(); // refresh direkt
  });

  // ----- Firebase init -----
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

 try {
  const cred = await signInAnonymously(auth);
  setStatus("Auth OK: " + cred.user.uid);
} catch (e) {
  console.error("Anonymous auth failed:", e);
  setStatus("Auth FEL: " + (e.code || e.message));
}


  const gameRef = doc(db, "games", GAME_DOC_ID);

  const statusLine = document.getElementById("statusLine");
function setStatus(msg){
  console.log(msg);
  if(statusLine) statusLine.textContent = msg;
}

  // ----- State -----
  let gameState = null;
  let currentDay = null;

  // anti-spam mega-confetti per dag
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

  function updateStats() {
    const b = getParticipant("bitti") || {};
    const m = getParticipant("mattias") || {};

    const bDone = (b.openedDays || []).length;
    const mDone = (m.openedDays || []).length;

    const bStreak = computeStreak(b.openedDays);
    const mStreak = computeStreak(m.openedDays);

    document.getElementById("streakBitti") && (document.getElementById("streakBitti").textContent = String(bStreak));
    document.getElementById("streakMattias") && (document.getElementById("streakMattias").textContent = String(mStreak));
    document.getElementById("doneDaysBitti") && (document.getElementById("doneDaysBitti").textContent = String(bDone));
    document.getElementById("doneDaysMattias") && (document.getElementById("doneDaysMattias").textContent = String(mDone));

    const pbFill = document.getElementById("progressFillBitti");
    const pmFill = document.getElementById("progressFillMattias");
    const bPct = Math.min(100, (bDone / TOTAL_DAYS) * 100);
    const mPct = Math.min(100, (mDone / TOTAL_DAYS) * 100);
    if (pbFill) pbFill.style.width = `${bPct}%`;
    if (pmFill) pmFill.style.width = `${mPct}%`;
  }

  function updateMoney() {
    const s = getMoneySettings();
    const cost = Number(s.costPerDay ?? 69);

    const bDone = (getParticipant("bitti")?.openedDays || []).length;
    const mDone = (getParticipant("mattias")?.openedDays || []).length;

    const bMoney = Math.round(bDone * cost);
    const mMoney = Math.round(mDone * cost);

    document.getElementById("moneyBitti") && (document.getElementById("moneyBitti").textContent = String(bMoney));
    document.getElementById("moneyMattias") && (document.getElementById("moneyMattias").textContent = String(mMoney));
    document.getElementById("moneyTotal") && (document.getElementById("moneyTotal").textContent = String(bMoney + mMoney));
    document.getElementById("moneyBittiDay") && (document.getElementById("moneyBittiDay").textContent = String(cost));
    document.getElementById("moneyMattiasDay") && (document.getElementById("moneyMattiasDay").textContent = String(cost));
  }

  function renderBadges() {
    const wrap = document.getElementById("badgesWrap");
    if (!wrap) return;

    const bDays = (getParticipant("bitti")?.openedDays || []).length;
    const mDays = (getParticipant("mattias")?.openedDays || []).length;

    // TEAM-badges: upplåst om någon av dem nått nivån
    const teamDays = Math.max(bDays, mDays);

    wrap.innerHTML = "";
    BADGES.forEach(badge => {
      const unlocked = teamDays >= badge.reqDays;

      const el = document.createElement("div");
      el.className = "badge" + (unlocked ? "" : " locked");

      el.innerHTML = `
        <div class="badgeIcon">${badge.icon}</div>
        <div>
          <div class="badgeTitle">${badge.title} ${unlocked ? "✅" : "🔒"}</div>
          <div class="badgeDesc">${badge.desc} (krav: ${badge.reqDays} dagar)</div>
        </div>
      `;
      wrap.appendChild(el);
    });
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

    // Utmaningsknapp låses om DU redan gjort den
    if (challengeDoneBtn) {
      if (!who) {
        challengeDoneBtn.disabled = true;
        challengeDoneBtn.textContent = "⭐ Välj Bitti/Mattias först";
      } else {
        const iDid = challengeSet(who).has(day);
        challengeDoneBtn.disabled = iDid;
        challengeDoneBtn.textContent = iDid ? "⭐ Utmaningen redan klar" : "⭐ Jag klarade utmaningen";
      }
    }

    // Ring Allar syns bara 10/20/30/40/50/60 (+2 en gång/person/dag)
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

    if (bCh && mCh) line.textContent += "  🎉 Båda klara!";

    if (bOpened && mOpened) {
      const key = `${day}-opened`;
      if (!fired.has(key)) {
        fired.add(key);
        confettiBurst("mega");
      }
    }
      if (bOpened && mOpened && bCh && mCh) {
      const key2 = `${day}-both`;
      if (!fired.has(key2)) {
        fired.add(key2);
        confettiBurst("mega");
        setTimeout(() => confettiBurst("mega"), 350);
      }
    }
  }

  // ----- Firestore actions -----
  async function awardOpenDay(day) {
    if (!who) return alert("Välj Bitti eller Mattias först.");
    await updateDoc(gameRef, {
      [`participants.${who}.openedDays`]: arrayUnion(day),
      [`participants.${who}.points`]: increment(1),
      updatedAt: serverTimestamp()
    });
    confettiBurst("normal");
  }

  async function awardChallenge(day) {
    if (!who) return alert("Välj Bitti eller Mattias först.");
    if (gameState && challengeSet(who).has(day)) return;

    await updateDoc(gameRef, {
      [`participants.${who}.challengeDoneDays`]: arrayUnion(day),
      [`participants.${who}.points`]: increment(1),
      updatedAt: serverTimestamp()
    });
    confettiBurst("normal");
  }

  async function awardCallBonus(day) {
    if (!who) return;
    if (day % 10 !== 0) return;
    if (gameState && callBonusSet(who).has(day)) return;

    await updateDoc(gameRef, {
      [`participants.${who}.callBonusDays`]: arrayUnion(day),
      [`participants.${who}.points`]: increment(2),
      updatedAt: serverTimestamp()
    });
    confettiBurst("mega");
  }

  // ----- Modal wiring -----
  const modal = $("#modal");
  const contentEl = $("#content");
  const challengeEl = $("#challengeText");
  const closeBtn = $("#close");
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

  callAllarBtn && callAllarBtn.addEventListener("click", () => {
    if (!currentDay) return;
    // kör utan await så tel: öppnas snabbt
    awardCallBonus(currentDay);
  });

  calendar.querySelectorAll(".day").forEach((tile) => {
    tile.addEventListener("click", async () => {
      const day = Number(tile.dataset.day);
      if (tile.classList.contains("locked")) return;

      openModal(day);
      await awardOpenDay(day);
      updateStatusLine(day);
    });
  });

  // ----- Realtime snapshot -----
 onSnapshot(
  gameRef,
  (snap) => {
    setStatus("Snapshot OK. exists=" + snap.exists());
    gameState = snap.data() || null;
// markera dagar som klara för vald person
const whoLocal = localStorage.getItem("who");
if (whoLocal && gameState?.participants?.[whoLocal]?.openedDays) {
  const set = new Set(gameState.participants[whoLocal].openedDays);
  document.querySelectorAll(".day").forEach(d => {
    const n = Number(d.dataset.day);
    d.classList.toggle("done", set.has(n));
  });
}

    updateLeaderboard();
    updateStats();
    updateMoney();
    renderBadges();
    if (currentDay) updateStatusLine(currentDay);
  },
  (err) => {
    console.error("Firestore onSnapshot error:", err);
    setStatus("Firestore FEL: " + (err.code || err.message));
  }
);

}

init().catch((err) => console.error("Init failed:", err));


