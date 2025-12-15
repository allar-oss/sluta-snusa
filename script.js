const startDate = new Date(); // kör idag
const allarPhone = "+46761953421";

const backgrounds = [
  "images/bg1.jpg",
  "images/bg2.jpg",
  "images/bg3.jpg",
  "images/bg4.jpg"
];

// ----- bakgrund -----
let bgIndex = 0;
function changeBackground(){
  document.body.style.backgroundImage = `url('${backgrounds[bgIndex]}')`;
  bgIndex = (bgIndex + 1) % backgrounds.length;
}
changeBackground();
setInterval(changeBackground, 15000);

// ----- leaderboard -----
const STORAGE = {
  BITTI_POINTS: "points_bitti",
  MATTIAS_POINTS: "points_mattias",
  BITTI_OPENED: "opened_bitti_days",
  MATTIAS_OPENED: "opened_mattias_days"
};

function getNum(key){ return parseInt(localStorage.getItem(key) || "0", 10); }
function setNum(key,val){ localStorage.setItem(key, String(val)); }

function getArr(key){
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}
function setArr(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }

function updateBoard(){
  document.getElementById("pointsBitti").innerText = getNum(STORAGE.BITTI_POINTS);
  document.getElementById("pointsMattias").innerText = getNum(STORAGE.MATTIAS_POINTS);
}
updateBoard();

// ----- confetti -----
function popConfetti(){
  const emojis = ["🎉","🎊","⚽","🔵","🔴"];
  for(let i=0;i<22;i++){
    const el = document.createElement("div");
    el.className = "confetti";
    el.innerText = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.left = Math.random()*100 + "vw";
    el.style.transform = `translateY(0) rotate(${Math.random()*360}deg)`;
    el.style.fontSize = (16 + Math.random()*18) + "px";
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1400);
  }
}

// ----- kalender -----
const cal = document.querySelector(".calendar");
for(let i=1;i<=60;i++){
  const d = document.createElement("div");
  d.className="day";
  d.innerText=i;
  d.dataset.day=i;
  cal.appendChild(d);
}

let currentDay = null;

function hasOpened(personKey, day){
  return new Set(getArr(personKey)).has(day);
}

function markOpened(personKey, day){
  const set = new Set(getArr(personKey));
  const was = set.has(day);
  if(!was){
    set.add(day);
    setArr(personKey, Array.from(set));
  }
  return !was; // true om ny
}

function updateStatusLine(day){
  const b = hasOpened(STORAGE.BITTI_OPENED, day);
  const m = hasOpened(STORAGE.MATTIAS_OPENED, day);

  const line = document.getElementById("statusLine");
  line.innerText = `Status dag ${day}: Bitti ${b ? "✅" : "⏳"} | Mattias ${m ? "✅" : "⏳"}`;

  if(b && m){
    line.innerText += "  —  🏁 Båda har öppnat dagens lucka!";
  }
}

// ----- ladda content -----
fetch("content.json")
  .then(r=>r.json())
  .then(data=>{
    document.querySelectorAll(".day").forEach(day=>{
      const n = Number(day.dataset.day);

      const openDate = new Date(startDate);
      openDate.setDate(startDate.getDate()+n-1);

      if(new Date() < openDate) day.classList.add("locked");

      day.onclick = ()=>{
        if(day.classList.contains("locked")) return;

        currentDay = n;

        document.getElementById("content").innerText = data[n].text;
        document.getElementById("challengeText").innerText = data[n].challenge;

        // Ring Allar var 10:e dag
        const callBtn = document.getElementById("callAllarBtn");
        if(n%10===0){
          callBtn.classList.remove("hidden");
          callBtn.href = `tel:${allarPhone}`;
        } else {
          callBtn.classList.add("hidden");
        }

        updateStatusLine(n);
        document.getElementById("modal").classList.remove("hidden");
      };
    });

    // Bonuspoäng för utmaningar (som du redan hade)
    document.getElementById("bittiDone").onclick=()=>{
      setNum(STORAGE.BITTI_POINTS, getNum(STORAGE.BITTI_POINTS)+1);
      updateBoard();
      popConfetti();
    };
    document.getElementById("mattiasDone").onclick=()=>{
      setNum(STORAGE.MATTIAS_POINTS, getNum(STORAGE.MATTIAS_POINTS)+1);
      updateBoard();
      popConfetti();
    };

    // Markera "öppnade" per person + confetti vid första öppning
    document.getElementById("markBittiOpened").onclick=()=>{
      if(!currentDay) return;
      const first = markOpened(STORAGE.BITTI_OPENED, currentDay);
      if(first) popConfetti();
      updateStatusLine(currentDay);
    };

    document.getElementById("markMattiasOpened").onclick=()=>{
      if(!currentDay) return;
      const first = markOpened(STORAGE.MATTIAS_OPENED, currentDay);
      if(first) popConfetti();
      updateStatusLine(currentDay);
    };
  });

document.getElementById("close").onclick=()=>{
  document.getElementById("modal").classList.add("hidden");
};
