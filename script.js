import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, doc, onSnapshot, updateDoc,
  arrayUnion, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ====== 1) FYLL I DIN FIREBASE CONFIG ====== */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

/* ====== 2) SETTINGS ====== */
const GAME_DOC = "sluta-snusa"; // games/sluta-snusa
const ALLAR_PHONE = "+46700000000";
const startDate = new Date(); // start idag

const backgrounds = [
  "images/bg1.jpg",
  "images/bg2.jpg",
  "images/bg3.jpg",
  "images/bg4.jpg"
];

/* ====== 3) Confetti ====== */
function popConfetti(){
  const emojis = ["🎉","🎊","⚽","🔵","🔴"];
  for(let i=0;i<22;i++){
    const el = document.createElement("div");
    el.className = "confetti";
    el.innerText = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.left = Math.random()*100 + "vw";
    el.style.fontSize = (16 + Math.random()*18) + "px";
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1400);
  }
}

/* ====== 4) Bakgrundsbildspel ====== */
let bgIndex = 0;
function changeBackground(){
  document.body.style.backgroundImage = `url('${backgrounds[bgIndex]}')`;
  bgIndex = (bgIndex + 1) % backgrounds.length;
}
changeBackground();
setInterval(changeBackground, 15000);

/* ====== 5) Firebase init + auth ====== */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
await signInAnonymously(auth);

/* ====== 6) Välj spelare ====== */
let who = localStorage.getItem("who"); // "bitti" | "mattias"
const whoChosen = document.getElementById("whoChosen");

function setWho(v){
  who = v;
  localStorage.setItem("who", v);
  whoChosen.textContent = `✅ ${v === "bitti" ? "Bitti" : "Mattias"}`;
}
document.getElementById("iAmBitti").onclick = () => setWho("bitti");
document.getElementById("iAmMattias").onclick = () => setWho("mattias");
if (who) whoChosen.textContent = `✅ ${who === "bitti" ? "Bitti" : "Mattias"}`;

/* ====== 7) Firestore refs ====== */
const gameRef = doc(db, "games", GAME_DOC);

/* ====== 8) UI: skapa 60 luckor ====== */
const cal = document.querySelector(".calendar");
for(let i=1;i<=60;i++){
  const d = document.createElement("div");
  d.className="day";
  d.innerText=i;
  d.dataset.day=i;
  cal.appendChild(d);
}

let currentDay = null;
let content = null; // from content.json
let gameState = null; // from firestore

/* ====== 9) Ladda content.json ====== */
content = await fetch("content.json").then(r=>r.json());

/* ====== 10) Realtime lyssning för leaderboard & status ====== */
onSnapshot(gameRef, (snap) => {
  gameState = snap.data();

  const bPts = gameState?.participants?.bitti?.points ?? 0;
  const mPts = gameState?.participants?.mattias?.points ?? 0;

  document.getElementById("pointsBitti").textContent = bPts;
  document.getElementById("pointsMattias").textContent = mPts;

  // om modal är öppen uppdatera statusrad
  if (currentDay) updateStatusLine(currentDay);
});

function openedSet(person){
  return new Set(gameState?.participants?.[person]?.openedDays ?? []);
}
function challengeSet(person){
  return new Set(gameState?.participants?.[person]?.challengeDoneDays ?? []);
}

function updateStatusLine(day){
  if(!gameState){
    document.getElementById("statusLine").textContent = "Status: laddar…";
    return;
  }
  const bOpened = openedSet("bitti").has(day);
  const mOpened = openedSet("mattias").has(day);
  const bCh = challengeSet("bitti").has(day);
  const mCh = challengeSet("mattias").has(day);

  document.getElementById("statusLine").textContent =
    `Dag ${day} — Öppnad: Bitti ${bOpened ? "✅" : "⏳"} | Mattias ${mOpened ? "✅" : "⏳"} • Utmaning: Bitti ${bCh ? "⭐" : "—"} | Mattias ${mCh ? "⭐" : "—"}`;

  if (bOpened && mOpened) popConfetti();
}

/* ====== 11) Firestore actions ====== */
async function awardOpenDay(day){
  if(!who) return alert("Välj Bitti eller Mattias först.");

  await updateDoc(gameRef, {
    [`participants.${who}.openedDays`]: arrayUnion(day),
    [`participants.${who}.points`]: increment(1),
    updatedAt: serverTimestamp()
  });

  popConfetti();
}

async function awardChallenge(day){
  if(!who) return alert("Välj Bitti eller Mattias först.");

  await updateDoc(gameRef, {
    [`participants.${who}.challengeDoneDays`]: arrayUnion(day),
    [`participants.${who}.points`]: increment(1),
    updatedAt: serverTimestamp()
  });

  popConfetti();
}

/* ====== 12) Klick på luckor ====== */
document.querySelectorAll(".day").forEach(dayEl => {
  const n = Number(dayEl.dataset.day);

  const openDate = new Date(startDate);
  openDate.setDate(startDate.getDate() + n - 1);
  if(new Date() < openDate) dayEl.classList.add("locked");

  dayEl.onclick = async () => {
    if(dayEl.classList.contains("locked")) return;

    currentDay = n;

    // Visa text + challenge
    const d = content[String(n)];
    document.getElementById("content").textContent = d?.text ?? "💙 Idag: fortsätt bara. / Allar";
    document.getElementById("challengeText").textContent = d?.challenge ?? "Gör något snällt för någon idag.";

    // ring knapp
    const callBtn = document.getElementById("callAllarBtn");
    if(n % 10 === 0){
      callBtn.classList.remove("hidden");
      callBtn.href = `tel:${ALLAR_PHONE}`;
    } else {
      callBtn.classList.add("hidden");
    }

    // Ge +1 poäng + markera öppnad dag i Firestore
    await awardOpenDay(n);

    updateStatusLine(n);
    document.getElementById("modal").classList.remove("hidden");
  };
});

/* ====== 13) Utmaning klar ====== */
document.getElementById("challengeDoneBtn").onclick = async () => {
  if(!currentDay) return;
  await awardChallenge(currentDay);
  updateStatusLine(currentDay);
};

/* ====== 14) Stäng modal ====== */
document.getElementById("close").onclick = () => {
  document.getElementById("modal").classList.add("hidden");
};
