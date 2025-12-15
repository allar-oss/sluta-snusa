const startDate = new Date("2025-01-01");

// Poänglagring
const STORAGE = {
  BITTI: "points_bitti",
  MATTIAS: "points_mattias",
  OPENED: "opened_days"
};

function get(key){ return parseInt(localStorage.getItem(key) || "0", 10); }
function set(key,val){ localStorage.setItem(key,val); }

function updateBoard(){
  document.getElementById("pointsBitti").innerText = get(STORAGE.BITTI);
  document.getElementById("pointsMattias").innerText = get(STORAGE.MATTIAS);
}
updateBoard();

// Skapa 60 luckor
const cal = document.querySelector(".calendar");
for(let i=1;i<=60;i++){
  const d = document.createElement("div");
  d.className="day";
  d.innerText=i;
  d.dataset.day=i;
  cal.appendChild(d);
}

// Ladda innehåll
fetch("content.json").then(r=>r.json()).then(data=>{
  document.querySelectorAll(".day").forEach(day=>{
    const n = parseInt(day.dataset.day);
    const openDate = new Date(startDate);
    openDate.setDate(startDate.getDate()+n-1);

    if(new Date() < openDate) day.classList.add("locked");

    day.onclick=()=>{
      if(day.classList.contains("locked")) return;

      document.getElementById("content").innerText = data[n].text;
      document.getElementById("challengeText").innerText = data[n].challenge;

      // Ring Allar var 10:e dag
      const btn = document.getElementById("callAllarBtn");
      if(n%10===0){
        btn.classList.remove("hidden");
        btn.href="tel:+46700000000";
      } else btn.classList.add("hidden");

      document.getElementById("modal").classList.remove("hidden");
    };
  });

  // Bonuspoäng-knappar
  document.getElementById("bittiDone").onclick=()=>{
    set(STORAGE.BITTI, get(STORAGE.BITTI)+1);
    updateBoard();
    alert("⭐ Bonuspoäng till Bitti!");
  };
  document.getElementById("mattiasDone").onclick=()=>{
    set(STORAGE.MATTIAS, get(STORAGE.MATTIAS)+1);
    updateBoard();
    alert("⭐ Bonuspoäng till Mattias!");
  };
});

document.getElementById("close").onclick=()=>{
  document.getElementById("modal").classList.add("hidden");
};
