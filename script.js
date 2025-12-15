const startDate = new Date(); // kör idag
const allarPhone = "+46700000000";

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
  document.getElementById("pointsMattias")
