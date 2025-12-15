const startDate = new Date("2025-12-15");
const allarPhone = "+46761953421";

// ---------- Bakgrundsbildspel ----------
const backgrounds = [
  "images/bg1.jpg",
  "images/bg2.jpg",
  "images/bg3.jpg",
  "images/bg4.jpg"
];

let bgIndex = 0;
function changeBackground(){
  document.body.style.backgroundImage = `url('${backgrounds[bgIndex]}')`;
  bgIndex = (bgIndex + 1) % backgrounds.length;
}
changeBackground();
setInterval(changeBackground, 15000);

// ---------- Leaderboard ----------
const STORAGE = {
  BITTI: "points_bitti",
  MATTIAS: "points_mattias"
};

function get(key){ return parseInt(localStorage.getItem(key) || "0", 10); }
function set(key,val){ localStorage.setItem(key,val); }

function updateBoard(){
  document.getElementById("pointsBitti").innerText = get(STORAGE.BITTI);
  document.getElementById("pointsMattias").innerText = get(STORAGE.MATTIAS);
}
updateBoard();

// ---------- Skapa kalender ----------
const calendar = document.querySelector(".calendar");
for(let i=1;i<=60;i++){
  const d = document.createElement("div");
  d.className = "day";
  d.dataset.day = i;
  d.innerText = i;
  calendar.appendChild(d);
}

// ---------- Ladda innehåll ----------
fetch("content.json")
  .then(res => res.json())
  .then(data => {

    document.querySelectorAll(".day").forEach(day => {
      const n = Number(day.dataset.day);

      const openDate = new Date(startDate);
      openDate.setDate(startDate.getDate() + n - 1);

      if(new Date() < openDate){
        day.classList.add("locked");
      }

      day.onclick = () => {
        if(day.classList.contains("locked")) return;

        document.getElementById("content").innerText = data[n].text;
        document.getElementById("challengeText").innerText = data[n].challenge;

        const callBtn = document.getElementById("callAllarBtn");
        if(n % 10 === 0){
          callBtn.classList.remove("hidden");
          callBtn.href = `tel:${allarPhone}`;
        } else {
          callBtn.classList.add("hidden");
        }

        document.getElementById("modal").classList.remove("hidden");
      };
    });
  });

// ---------- Utmaningspoäng ----------
document.getElementById("bittiDone").onclick = () => {
  set(STORAGE.BITTI, get(STORAGE.BITTI) + 1);
  updateBoard();
};

document.getElementById("mattiasDone").onclick = () => {
  set(STORAGE.MATTIAS, get(STORAGE.MATTIAS) + 1);
  updateBoard();
};

// ---------- Stäng modal ----------
document.getElementById("close").onclick = () => {
  document.getElementById("modal").classList.add("hidden");
};

