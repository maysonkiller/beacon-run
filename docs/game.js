document.addEventListener("DOMContentLoaded", () => {
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
async function connect() {
  let isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    try {
      const wcProvider = await window.EthereumProvider.init({
        projectId: "f3a4411a5d6201d00fd86817d41b64e8", // твой ProjectID
        chains: [parseInt(window.PHAROS.chainId, 16)],
        rpcMap: {
          [parseInt(window.PHAROS.chainId, 16)]: window.PHAROS.rpcUrls[0]
        },
        showQrModal: true,
      });

      await wcProvider.enable();
      provider = new ethers.providers.Web3Provider(wcProvider);
    } catch (e) {
      console.error(e);
      alert("WalletConnect v2 error: " + (e.message || "Unknown error"));
      return false;
    }
  } else {
    if (!window.ethereum) { 
      alert("Install MetaMask or another EVM wallet!");
      return false; 
    }
    try {
      await window.ensurePharos();
    } catch (e) {
      console.error("Network switch error:", e);
      alert("Failed to switch to Pharos Testnet.");
      return false;
    }
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
  }

  signer = provider.getSigner();
  playerAddress = await signer.getAddress();
  contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, signer);

  const p = await contract.players(playerAddress);
  if (!p.registered) {
    alert("Please register on the main page first.");
    location.href = "/";
    return false;
  }
  return true;
}

  // === GAME STATE ===
  let gameActive = false;
  let currentLevel = 1;
  let collectedCoins = 0;
  let totalCoins = 10;
  let droppedCoins = 0;  // волны
  let waveSpeed = 3;
  let waveAccel = 0.02;
  let waveSpawnTimer = null;  // монеты
  let coinSpawnTimer = null;
  let coinSpawnMin = 1000;
  let coinSpawnMax = 2000;  // движение/прыжок
  let keys = {};
  let vy = 0;            // скорость по вертикали
  const GRAVITY = 0.6;   // гравитация
  const JUMP_V = 18;    // сила прыжка
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
    hint.textContent = `Goal: Collect all coins and reach the lighthouse!`;
  }
  // === Геометрия ===
  const r = el => el.getBoundingClientRect();
  const intersect = (a,b) => a.left < b.right && a.right > b.left && a.bottom > b.top && a.top < b.bottom;
  // === Настройки уровней ===
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
    updateHUD();
  }
  // === RESET мира ===
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
  // === Запуск уровня ===
  async function startLevel() {
    startGameBtn.style.display = "none"; // hide start button
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
  // === Отсчёт ===
  function countdown(sec, onDone) {
    const m = modal(`<div style="text-align:center">
      <div style="font-size:22px;margin-bottom:8px">Game starts in</div>
      <div id="cd" style="font-size:56px;font-weight:700">${sec}</div>
      <div style="margin-top:8px;font-size:14px;opacity:.9">Collect coins and run to the lighthouse!</div>
    </div>`);
    const cd = m.el.querySelector("#cd");
    const iv = setInterval(()=>{
      sec--; cd.textContent = sec;
      if (sec<=0) { clearInterval(iv); m.close(); onDone&&onDone(); }
    },1000);
  }
  // === Волны (справа→налево) ===
  function spawnNextWave() {
    if (!gameActive) return;
    const wave = document.createElement("img");
    wave.src = "img/wave.png"; wave.className = "wave";
    const waveH = 100; // визуальная высота волны (примерно)
    const maxBottom = Math.max(0, Math.floor(window.innerHeight / 2 - waveH));
    wave.style.bottom = (Math.random() * maxBottom) + "px";
    wave.style.right = "-140px";
    wavesContainer.appendChild(wave);
    let posRight = -140;
    const iv = setInterval(()=>{
      if (!gameActive) { clearInterval(iv); wave.remove(); return; }
      posRight += waveSpeed; waveSpeed += waveAccel*0.1;
      wave.style.right = posRight + "px";
      const waveRect = r(wave);
      const shrink = 0.30; // обрезаем по 30% со всех сторон (это хитбокс волны - редактируйте shrink для изменения зоны поражения)
      const hitbox = {
        left: waveRect.left + waveRect.width*shrink,
        right: waveRect.right - waveRect.width*shrink,
        top: waveRect.top + waveRect.height*shrink,
        bottom: waveRect.bottom - waveRect.height*shrink
      };
      if (intersect(hitbox, r(character))) {
        clearInterval(iv); wave.remove();
        return gameOver(true);
      }
      // ушла за левый край
      if (posRight > window.innerWidth + 140) {
        clearInterval(iv); wave.remove();
      }
    }, 20);
    // следующая волна через 1–2 сек (faster on higher levels)
    const base = 1700, extra = 1400 - currentLevel*200;
    waveSpawnTimer = setTimeout(spawnNextWave, base + Math.random()*extra);
  }
  // === Монеты ===
  function spawnNextCoin() {
    if (!gameActive || droppedCoins >= totalCoins) return;
    const coin = document.createElement("img");
    coin.src = "img/coin.png";
    coin.className = "coin";
    // безопасная зона: между персонажем и маяком
    const charRect = r(character);
    const lhRect = r(lighthouse);
    const padding = 50;
    const leftMinSafe = charRect.right + padding;
    const leftMaxSafe = lhRect.left - padding;
    const left = Math.random() * (leftMaxSafe - leftMinSafe) + leftMinSafe;
    coin.style.left = left + "px";
    coin.style.top = "-50px";
    coinsContainer.appendChild(coin);
    droppedCoins++;
    updateHUD();
    let posY = -50;
    const iv = setInterval(() => {
      if (!gameActive) { clearInterval(iv); coin.remove(); return; }
      posY += 1.5;
      coin.style.top = posY + "px";
      if (intersect(r(coin), r(character))) {
        collectedCoins++;
        updateHUD();
        floatPlus("+1", r(character).left + 20, r(character).top - 10);
        clearInterval(iv);
        coin.remove();
      }
      if (posY > window.innerHeight) { clearInterval(iv); coin.remove(); }
    }, 20);
    const nextIn = coinSpawnMin + Math.random()*(coinSpawnMax - coinSpawnMin);
    coinSpawnTimer = setTimeout(spawnNextCoin, nextIn);
  }
  // всплывашка +1
  function floatPlus(text, x, y) {
    const el = document.createElement("div");
    el.className = "float-plus"; el.textContent = text;
    el.style.left = x + "px"; el.style.top = y + "px";
    document.body.appendChild(el);
    let t = 0;
    const iv = setInterval(()=>{
      t += 1; el.style.top = (y - t*1.5) + "px"; el.style.opacity = (1 - t/40).toString();
      if (t>40) { clearInterval(iv); el.remove(); }
    }, 16);
  }
  // === Управление: arrows / WASD / ЦЫФВ + Space (jump) ===
  document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
  document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);
  function moveLoop() {
    if (gameActive) {
      const speed = 6;
      const cr = r(character);
      let left = cr.left, bottom = parseFloat(character.style.bottom) || 0;
      // horizontal
      if (keys["arrowleft"] || keys["a"] || keys["ф"]) left -= speed;
      if (keys["arrowright"] || keys["d"] || keys["в"]) left += speed;
      character.style.left = Math.max(0, Math.min(window.innerWidth - cr.width, left)) + "px";
      // jump on space
      if ((keys[" "] || keys["arrowup"] || keys["w"] || keys["ц"]) && onGround()) vy = JUMP_V;
      // gravity and jump (using bottom for consistency)
      if (!onGround()) vy -= GRAVITY;
      let newBottom = bottom + vy;
      if (newBottom < 0) {
        newBottom = 0;
        vy = 0;  // Reset velocity on landing (prevents accumulation)
      }
      newBottom = Math.min(window.innerHeight - cr.height, newBottom);  // Optional: Cap max height if needed
      character.style.bottom = newBottom + "px";
      const lhRect = r(lighthouse);
      // Отдельные коэффициенты сжатия (padding) для каждой стороны (0 = нет сжатия, 0.5 = сжимаем на 50% с этой стороны)
      // Уменьшай значение, чтобы расширить хитбокс в эту сторону или сделать ближе к краю
      const paddingLeft = lhRect.width * 0.50;   // Сжатие слева (стандартное, не меняем)
      const paddingRight = lhRect.width * 0.05;  // Меньше сжатие справа — хитбокс ближе к правому краю и растянут вправо
      const paddingTop = lhRect.height * 0.50;   // Сжатие сверху (стандартное)
      const paddingBottom = lhRect.height * 0.05; // Меньше сжатие снизу — хитбокс больше вниз (растянут вниз)
      const lhHitbox = {
        left: lhRect.left + paddingLeft,         // Левый край: сдвигаем вправо на paddingLeft
        right: lhRect.right - paddingRight,      // Правый край: отнимаем меньше, чтобы растянуть вправо
        top: lhRect.top + paddingTop,            // Верхний край: стандарт
        bottom: lhRect.bottom - paddingBottom    // Нижний край: отнимаем меньше, чтобы растянуть вниз (больше в низ)
      };
      if (intersect(r(character), lhHitbox)) {
        finishLevel(true);
      }
    }
    requestAnimationFrame(moveLoop);
  }
  moveLoop();
  function onGround() {
    return parseFloat(character.style.bottom) <= 0;
  }
  // === Платёжный модал ===
  async function showPaymentModal(callback) {
    try {
      const ok = await connect(); if (!ok) return;
      const fee = await contract.ENTRY_FEE();
      const m = modal(`<div style="text-align:center">
        <div style="font-size:18px;margin-bottom:8px">Entry fee — ${ethers.utils.formatEther(fee)} PHR</div>
        <div style="font-size:14px;opacity:.9;margin-bottom:12px">
          100 coins = 1 PHR. Collect coins, reach the lighthouse, and claim your reward.
        </div>
        ${btn("Pay & Start","go")}
      </div>`);
      m.el.querySelector("#go").onclick = async () => {
        try {
          const tx = await contract.startGame({ value: fee, gasLimit: 300000 });
          await tx.wait();
          m.close();
          callback();
        } catch (e) {
          console.error(e);
          if (e.code === "ACTION_REJECTED") {
            alert("Transaction canceled by user.");
          } else {
            alert("Payment failed.");
          }
        }
      };
    } catch (e) {
      console.error(e);
      alert("Connect wallet first. If you have multiple wallet extensions, disable all except one.");
    }
  }
  // === START (pay ENTRY_FEE) ===
  startGameBtn.addEventListener("click", async () => {
    startGameBtn.disabled = true;
    showPaymentModal(() => {
      startLevel();
    });
    startGameBtn.disabled = false;
  });
  // === Finish / GameOver ===
  async function finishLevel(reached) {
    if (!gameActive) return;
    gameActive = false;
    clearTimeout(coinSpawnTimer); clearTimeout(waveSpawnTimer);
    // submit result
    try {
      const tx = await contract.submitResult(collectedCoins, currentLevel, reached, { gasLimit: 300000 });
      await tx.wait();
    } catch (e) {
      console.error(e);
    }
    const gotAll = (collectedCoins >= totalCoins);
    const rewardPHR = collectedCoins / 100;
    let html = `<div style="text-align:center">
      <div style="font-size:22px;margin-bottom:6px">${reached ? "You reached the lighthouse!" : "Level failed!"}</div>
      <div>Coins collected: <b>${collectedCoins}/${totalCoins}</b></div>
      <div style="margin-top:6px">Reward: <b>${rewardPHR.toFixed(2)} PHR</b></div>`;
    if (reached) {
      html += `<div style="margin-top:10px">${btn("Claim Reward","btnClaim","width:100%")}</div>`;
    }
    if (reached && gotAll && currentLevel < 3) {
      html += `<div style="margin-top:6px">${btn("Next Level","btnNext","width:100%")}</div>`;
    } else if (reached && gotAll && currentLevel === 3) {
      html += `<div style="margin-top:6px;font-size:16px"> You completed all levels!</div>
              <div style="margin-top:6px">${btn("Play Again (Level 1)","btnAgain","width:100%")}</div>`;
    } else {
      html += `<div style="margin-top:6px">${btn("Restart Level","btnRestart","width:100%")}</div>`;
    }
    html += `<div style="margin-top:6px">${btn("Leaderboard","btnLeader","width:100%")}</div>`;
    html += `<div style="margin-top:6px">${btn("Main Menu","btnMenu","width:100%")}</div>`;
    html += `</div>`;
    const m = modal(html);
    if (reached) {
      const claimBtn = m.el.querySelector("#btnClaim");
      if (claimBtn) claimBtn.onclick = async () => {
        claimBtn.disabled = true;
        try {
          const tx = await contract.claimReward({ gasLimit: 300000 });
          await tx.wait();
          alert("Reward claimed!");
        } catch (e) {
          console.error(e);
          alert("Claim failed.");
        } finally {
          claimBtn.disabled = false;
        }
      };
    }
    const toNext = m.el.querySelector("#btnNext");
    if (toNext) toNext.onclick = () => { m.close(); currentLevel++; showPaymentModal(() => { startLevel(); }); };
    const toAgain = m.el.querySelector("#btnAgain");
    if (toAgain) toAgain.onclick = () => { m.close(); currentLevel = 1; showPaymentModal(() => { startLevel(); }); };
    const toRestart = m.el.querySelector("#btnRestart");
    if (toRestart) toRestart.onclick = async () => { 
      m.close();
      showPaymentModal(() => { startLevel(); });
    };
    const leaderBtnModal = m.el.querySelector("#btnLeader");
    if (leaderBtnModal) leaderBtnModal.onclick = () => { m.close(); window.location.href = "leaderboard.html"; };
    const menuBtnModal = m.el.querySelector("#btnMenu");
    if (menuBtnModal) menuBtnModal.onclick = () => { m.close(); window.location.href = "index.html"; };
    // show start button again if needed
    startGameBtn.style.display = "block";
    startGameBtn.disabled = false;
    resetWorld();
  }
  async function gameOver(byWave=true) {
    if (!gameActive) return;
    gameActive = false;
    clearTimeout(coinSpawnTimer); clearTimeout(waveSpawnTimer);
    // submit without reward
    try {
      const tx = await contract.submitResult(collectedCoins, currentLevel, false, { gasLimit: 300000 });
      await tx.wait();
    } catch(e){ 
      console.error(e); 
    }
    const m = modal(`<div style="text-align:center">
      <div style="font-size:22px;margin-bottom:6px">You were hit by a wave!</div>
      <div>Coins collected: <b>${collectedCoins}/${totalCoins}</b></div>
      <div style="margin-top:6px">You go back to Level 1.</div>
      ${btn("Restart from Level 1","btnR","width:100%;margin-top:10px")}
      ${btn("Leaderboard","btnLeader","width:100%;margin-top:10px")}
      ${btn("Main Menu","btnMenu","width:100%;margin-top:10px")}
      </div>`);
    m.el.querySelector("#btnR").onclick = ()=>{ m.close(); currentLevel=1; showPaymentModal(() => { startLevel(); }); };
    const leaderBtnModal = m.el.querySelector("#btnLeader");
    if (leaderBtnModal) leaderBtnModal.onclick = () => { m.close(); window.location.href = "leaderboard.html"; };
    const menuBtnModal = m.el.querySelector("#btnMenu");
    if (menuBtnModal) menuBtnModal.onclick = () => { m.close(); window.location.href = "index.html"; };
    startGameBtn.style.display = "block";
    startGameBtn.disabled = false;
    resetWorld();
  }
  mainMenuBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
  leaderboardBtn.addEventListener("click", () => {
    window.location.href = "leaderboard.html";
  });
  // Mobile touch controls
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
});