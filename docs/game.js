document.addEventListener("DOMContentLoaded", () => {
  // Detect mobile
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Mobile scaling
  if (isMobile) {
    const gameContainer = document.getElementById("game-container");
    const baseWidth = 1920;
    const baseHeight = 1080;
    function scaleGame() {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const scale = Math.min(windowWidth / baseWidth, windowHeight / baseHeight);
      const translateX = (windowWidth - baseWidth * scale) / 2;
      const translateY = (windowHeight - baseHeight * scale) / 2;
      gameContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      gameContainer.style.transformOrigin = 'top left';
      gameContainer.style.width = `${baseWidth}px`;
      gameContainer.style.height = `${baseHeight}px`;
    }
    scaleGame();
    window.addEventListener('resize', scaleGame);
    window.addEventListener('orientationchange', scaleGame);
  }

  // === DOM ===
  const startGameBtn = document.getElementById("startGameBtn");
  const mainMenuBtn = document.getElementById("mainMenuBtn");
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  const coinsContainer = document.getElementById("coins-container");
  const wavesContainer = document.getElementById("waves-container");
  const character = document.getElementById("character");
  const lighthouse = document.getElementById("lighthouse");
  const coinCounter = document.getElementById("coin-counter");
  const levelIndicator = document.getElementById("level-indicator");
  const hint = document.getElementById("hint");

  // === Ethers ===
  let provider, signer, contract, playerAddress;
  let transactionInProgress = false;

  // === Connect Wallet ===
  async function connect() {
    try {
      // @ts-ignore
      const { createWeb3Modal } = Web3Modal;
      const web3Modal = createWeb3Modal({
        projectId: "f3a4411a5d6201d00fd86817d41b64e8",
        chains: [{
          chainId: parseInt(window.PHAROS.chainId, 16),
          name: window.PHAROS.chainName,
          currency: window.PHAROS.nativeCurrency.symbol,
          rpcUrl: window.PHAROS.rpcUrls[0],
          explorerUrl: window.PHAROS.blockExplorerUrls[0]
        }]
      });
      await web3Modal.open();
      provider = web3Modal.getProvider();
      if (!provider) {
        alert("No provider found after connection.");
        return false;
      }
      provider = new ethers.providers.Web3Provider(provider);
      signer = provider.getSigner();
      playerAddress = await signer.getAddress();
      contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, signer);

      // Проверяем регистрацию
      const p = await contract.players(playerAddress);
      if (!p.registered) {
        alert("Please register on the main page first.");
        location.href = "index.html";
        return false;
      }
      return true;
    } catch (e) {
      console.error("Wallet connect failed:", e);
      alert("Failed to connect wallet. Please ensure your wallet app is installed and try again.");
      return false;
    }
  }

  // === GAME STATE ===
  let gameActive = false;
  let currentLevel = 1;
  let collectedCoins = 0;
  let totalCoins = 10;
  let droppedCoins = 0; 
  let waveSpeed = 3;
  let waveAccel = 0.02;
  let waveSpawnTimer = null;
  let coinSpawnTimer = null;
  let coinSpawnMin = 1000;
  let coinSpawnMax = 2000;
  let keys = {};
  let vy = 0; 
  const GRAVITY = 0.6;
  const JUMP_V = 18;
  let isVisible = true;
  let lastCoinLeft = 0;

  document.addEventListener("visibilitychange", () => {
    isVisible = !document.hidden;
    if (!isVisible && gameActive) {
      gameOver(true);
    }
  });

  // === UI helpers ===
  function modal(html) {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { position:"fixed", inset:"0", display:"grid", placeItems:"center", background:"rgba(0,0,0,.6)", zIndex:"9999" });
    wrap.innerHTML = `<div style="min-width:320px;max-width:90vw;background:rgba(10,12,25,.95);border:2px solid #0ff;border-radius:16px;padding:18px;color:#0ff;font-family:'Space Grotesk',sans-serif;box-shadow:0 10px 40px rgba(0,255,255,.25)">${html}</div>`;
    document.body.appendChild(wrap);
    return { el: wrap, close: () => wrap.remove() };
  }
  const btn = (label,id,extra="") => `<button id="${id}" style="margin:8px 6px 0 0;padding:10px 16px;border-radius:12px;border:2px solid #0ff;background:#000;color:#0ff;cursor:pointer;${extra}">${label}</button>`;

  function updateHUD() {
    coinCounter.textContent = `Coins: ${collectedCoins} / ${totalCoins}`;
    levelIndicator.textContent = `Level: ${currentLevel}`;
    hint.textContent = `GOAL: COLLECT ALL COINS AND REACH THE LIGHTHOUSE!`;
  }

  const r = el => el.getBoundingClientRect();
  const intersect = (a,b) => a.left < b.right && a.right > b.left && a.bottom > b.top && a.top < b.bottom;

  function applyLevel(level) {
    const L = [
      { total:10, waveSpeed:3, accel:0.02, coinSpawnMin:1000, coinSpawnMax:2000 },
      { total:50, waveSpeed:6, accel:0.03, coinSpawnMin:800, coinSpawnMax:1800 },
      { total:100, waveSpeed:9, accel:0.04, coinSpawnMin:600, coinSpawnMax:1600 }
    ][level-1];
    totalCoins = L.total;
    waveSpeed = L.waveSpeed;
    waveAccel = L.accel;
    coinSpawnMin = L.coinSpawnMin;
    coinSpawnMax = L.coinSpawnMax;
    collectedCoins = 0;
    droppedCoins = 0;
    lastCoinLeft = 0;
    updateHUD();
  }

  function resetWorld() {
    clearTimeout(coinSpawnTimer); coinSpawnTimer = null;
    clearTimeout(waveSpawnTimer); waveSpawnTimer = null;
    coinsContainer.innerHTML = "";
    wavesContainer.innerHTML = "";
    character.style.left = "0px";
    character.style.bottom = "0px";
    vy = 0;
    keys = {};
  }

  async function startLevel() {
    startGameBtn.style.display = "none";
    mainMenuBtn.style.display = "none";
    leaderboardBtn.style.display = "none";
    resetWorld();
    applyLevel(currentLevel);
    countdown(3, ()=> {
      gameActive = true;
      spawnNextCoin();
      spawnNextWave();
    });
  }

  function countdown(sec, onDone) {
    const m = modal(`<div style="text-align:center">
      <div style="font-size:22px;margin-bottom:8px">Game starts in</div>
      <div id="cd" style="font-size:56px;font-weight:700">${sec}</div>
    </div>`);
    const cd = m.el.querySelector("#cd");
    const iv = setInterval(()=>{
      sec--; cd.textContent = sec;
      if (sec<=0) { clearInterval(iv); m.close(); onDone&&onDone(); }
    },1000);
  }

  // === Payment modal ===
  async function showPaymentModal(callback) {
    if (transactionInProgress) return;
    transactionInProgress = true;
    try {
      const ok = await connect(); if (!ok) return;
      const fee = await contract.ENTRY_FEE();
      const m = modal(`<div style="text-align:center">
        <div style="font-size:18px;margin-bottom:8px">Entry fee — ${ethers.utils.formatEther(fee)} PHR</div>
        ${btn("Pay & Start","go")}
      </div>`);
      const goBtn = m.el.querySelector("#go");
      goBtn.onclick = async () => {
        try {
          const tx = await contract.startGame({ value: fee, gasLimit: 300000 });
          await tx.wait();
          m.close();
          callback();
        } catch (e) {
          console.error("startGame failed:", e);
          alert("Payment failed.");
        } finally {
          transactionInProgress = false;
        }
      };
    } finally {
      transactionInProgress = false;
    }
  }

  // === Finish & GameOver ===
  async function finishLevel(reached) {
    if (!gameActive) return;
    gameActive = false;
    clearTimeout(coinSpawnTimer); clearTimeout(waveSpawnTimer);
    try {
      const tx = await contract.submitResult(collectedCoins, currentLevel, reached, { gasLimit: 300000 });
      await tx.wait();
    } catch (e) { console.error(e); alert("Submit failed: " + e.message); }

    const rewardPHR = collectedCoins / 100;
    let html = `<div style="text-align:center">
      <div style="font-size:22px">${reached ? "You reached the lighthouse!" : "Level failed!"}</div>
      <div>Coins: <b>${collectedCoins}/${totalCoins}</b></div>
      <div>Reward: <b>${rewardPHR.toFixed(2)} PHR</b></div>`;
    html += `${btn("Main Menu","btnMenu","width:100%")}${btn("Leaderboard","btnLeader","width:100%")}`;
    const m = modal(html);
    m.el.querySelector("#btnMenu").onclick = ()=>location.href="index.html";
    m.el.querySelector("#btnLeader").onclick = ()=>location.href="leaderboard.html";
    startGameBtn.style.display="block"; mainMenuBtn.style.display="block"; leaderboardBtn.style.display="block";
    resetWorld();
  }

  async function gameOver() {
    if (!gameActive) return;
    gameActive = false;
    clearTimeout(coinSpawnTimer); clearTimeout(waveSpawnTimer);
    try { 
      const tx = await contract.submitResult(collectedCoins, currentLevel, false, { gasLimit: 300000 });
      await tx.wait();
    } catch(e){ console.error(e); alert("Submit failed: " + e.message); }
    const m = modal(`<div style="text-align:center">
      <div style="font-size:22px">You were hit by a wave!</div>
      <div>Coins: <b>${collectedCoins}/${totalCoins}</b></div>
      ${btn("Restart from Level 1","btnR","width:100%")}
      ${btn("Leaderboard","btnLeader","width:100%")}
      ${btn("Main Menu","btnMenu","width:100%")}
    </div>`);
    m.el.querySelector("#btnR").onclick=()=>{ m.close(); currentLevel=1; showPaymentModal(()=>startLevel()); };
    m.el.querySelector("#btnLeader").onclick=()=>location.href="leaderboard.html";
    m.el.querySelector("#btnMenu").onclick=()=>location.href="index.html";
    startGameBtn.style.display="block"; mainMenuBtn.style.display="block"; leaderboardBtn.style.display="block";
    resetWorld();
  }

  // === MENU BTN ===
  mainMenuBtn.addEventListener("click", ()=>location.href="index.html");
  leaderboardBtn.addEventListener("click", ()=>location.href="leaderboard.html");
  startGameBtn.addEventListener("click", async ()=>{
    startGameBtn.disabled = true;
    await showPaymentModal(()=>startLevel());
    startGameBtn.disabled = false;
  });

  // === Controls ===
  document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
  document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

  // Mobile touch controls
  let touchStartX = 0;
  let touchStartY = 0;
  let touchThreshold = 30; // px for swipe detection (reduced for better response)

  if (isMobile) {
    const touchArea = document.createElement("div");
    touchArea.style.position = "absolute";
    touchArea.style.left = "0";
    touchArea.style.bottom = "0";
    touchArea.style.width = "50%";
    touchArea.style.height = "100%";
    touchArea.style.opacity = "0"; // Invisible
    touchArea.style.zIndex = "1000";
    document.body.appendChild(touchArea);

    touchArea.addEventListener("touchstart", (e) => {
      e.preventDefault();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });

    touchArea.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (!gameActive) return;
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaX = touchX - touchStartX;
      const deltaY = touchY - touchStartY;

      keys["arrowleft"] = false;
      keys["arrowright"] = false;
      keys[" "] = false;

      if (Math.abs(deltaX) > touchThreshold) {
        if (deltaX < 0) keys["arrowleft"] = true;
        else keys["arrowright"] = true;
      }

      if (deltaY < -touchThreshold && onGround()) {
        keys[" "] = true;
      }
    });

    touchArea.addEventListener("touchend", (e) => {
      e.preventDefault();
      keys["arrowleft"] = false;
      keys["arrowright"] = false;
      keys[" "] = false;
    });
  } else {
    if ('ontouchstart' in window) {
      const controls = document.createElement("div");
      controls.style.position = "fixed";
      controls.style.bottom = "0";
      controls.style.left = "0";
      controls.style.width = "100%";
      controls.style.display = "flex";
      controls.style.justifyContent = "space-between";
      controls.style.padding = "10px";
      controls.style.boxSizing = "border-box";
      controls.style.zIndex = "1000";
      const leftBtn = document.createElement("button");
      leftBtn.textContent = "Left";
      leftBtn.style.padding = "20px";
      leftBtn.style.border = "2px solid #0ff";
      leftBtn.style.background = "#000";
      leftBtn.style.color = "#0ff";
      leftBtn.style.borderRadius = "8px";
      leftBtn.style.fontSize = "20px";
      leftBtn.style.opacity = "0.7";
      leftBtn.addEventListener("touchstart", () => keys["arrowleft"] = true);
      leftBtn.addEventListener("touchend", () => keys["arrowleft"] = false);
      const rightBtn = document.createElement("button");
      rightBtn.textContent = "Right";
      rightBtn.style.padding = "20px";
      rightBtn.style.border = "2px solid #0ff";
      rightBtn.style.background = "#000";
      rightBtn.style.color = "#0ff";
      rightBtn.style.borderRadius = "8px";
      rightBtn.style.fontSize = "20px";
      rightBtn.style.opacity = "0.7";
      rightBtn.addEventListener("touchstart", () => keys["arrowright"] = true);
      rightBtn.addEventListener("touchend", () => keys["arrowright"] = false);
      const jumpBtn = document.createElement("button");
      jumpBtn.textContent = "Jump";
      jumpBtn.style.padding = "20px";
      jumpBtn.style.border = "2px solid #0ff";
      jumpBtn.style.background = "#000";
      jumpBtn.style.color = "#0ff";
      jumpBtn.style.borderRadius = "8px";
      jumpBtn.style.fontSize = "20px";
      jumpBtn.style.opacity = "0.7";
      jumpBtn.addEventListener("touchstart", () => keys[" "] = true);
      jumpBtn.addEventListener("touchend", () => keys[" "] = false);
      controls.appendChild(leftBtn);
      controls.appendChild(rightBtn);
      controls.appendChild(jumpBtn);
      document.body.appendChild(controls);
    }
  }
});