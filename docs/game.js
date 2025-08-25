// @ts-ignore
/* eslint-disable no-undef */ // Ignore for undefined vars like window.EthereumProvider

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
      const aspectRatio = baseWidth / baseHeight;
      const windowAspectRatio = windowWidth / windowHeight;
      let scale, translateX = 0, translateY = 0;
      if (windowAspectRatio > aspectRatio) {
        scale = windowHeight / baseHeight;
        translateX = (windowWidth - baseWidth * scale) / 2;
      } else {
        scale = windowWidth / baseWidth;
        translateY = (windowHeight - baseHeight * scale) / 2;
      }
      gameContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      gameContainer.style.transformOrigin = 'top left';
      gameContainer.style.width = `${baseWidth}px`;
      gameContainer.style.height = `${baseHeight}px`;
    }
    scaleGame();
    window.addEventListener('resize', scaleGame);
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
  let transactionInProgress = false; // Lock for transactions
  async function connect() {
    try {
      if (isMobile) {
        if (window.ethereum) {
          // If window.ethereum is available (in-app wallet browser), use directly
          // @ts-ignore
          await window.ensurePharos();
          // @ts-ignore
          provider = new ethers.providers.Web3Provider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
        } else {
          // Reown (WalletConnect v2)
          if (!window.EthereumProvider) {
            console.error('Reown library failed to load');
            alert('Reown failed to load. Check your internet, reload the page, or open in a wallet app such as MetaMask/Trust Wallet.');
            return false;
          }
          // @ts-ignore
          const wcProvider = await window.EthereumProvider.init({
            projectId: "f3a4411a5d6201d00fd86817d41b64e8",
            optionalChains: [parseInt(window.PHAROS.chainId, 16)],
            rpcMap: {
              [parseInt(window.PHAROS.chainId, 16)]: window.PHAROS.rpcUrls[0]
            },
            showQrModal: true,
            metadata: {
              name: "Beacon Run",
              description: "Play Beacon Run and Win Tokens",
              url: window.location.origin,
              icons: ["https://testnet.pharosnetwork.xyz/favicon.ico"]
            }
          });
          wcProvider.on("display_uri", (uri) => {
            console.log("Reown URI:", uri);
            const deepLinks = [
              `metamask://wc?uri=${encodeURIComponent(uri)}`,
              `trust://wc?uri=${encodeURIComponent(uri)}`,
              `cbwallet://wc?uri=${encodeURIComponent(uri)}`,
              `wc:${uri}`
            ];
            let connected = false;
            deepLinks.forEach((link, index) => {
              setTimeout(() => {
                if (!connected) {
                  console.log(`Attempting deep link: ${link}`);
                  window.location.href = link;
                }
              }, index * 2000);
            });
            wcProvider.on("connect", () => {
              connected = true;
              console.log("Reown connected");
            });
          });
          await wcProvider.enable();
          // @ts-ignore
          provider = new ethers.providers.Web3Provider(wcProvider);
        }
      } else {
        if (!window.ethereum) { 
          alert("Install an EVM-compatible wallet like MetaMask, Trust Wallet, or any other that injects window.ethereum!"); 
          return false; 
        }
        try {
          // @ts-ignore
          await window.ensurePharos();
        } catch (e) {
          console.error("Network switch error:", e);
          alert("Failed to switch to Pharos Testnet. Please check your wallet settings or disable conflicting extensions.");
          return false;
        }
        // @ts-ignore
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
      }
      signer = provider.getSigner();
      playerAddress = await signer.getAddress();
      // @ts-ignore
      contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, signer);
      const p = await contract.players(playerAddress);
      if (!p.registered) {
        alert("Please register on the main page first.");
        location.href = "index.html"; return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      alert("Failed to connect wallet. Please ensure your wallet app is installed and try again. If you have multiple wallet extensions, disable all except one.");
      return false;
    }
  }
  // === GAME STATE ===
  let gameActive = false;
  let currentLevel = 1;
  let collectedCoins = 0;
  let totalCoins = 10;
  let droppedCoins = 0;  // waves
  let waveSpeed = 3;
  let waveAccel = 0.02;
  let waveSpawnTimer = null;  // coins
  let coinSpawnTimer = null;
  let coinSpawnMin = 1000;
  let coinSpawnMax = 2000;  // movement/jump
  let keys = {};
  let vy = 0;            // vertical velocity
  const GRAVITY = 0.6;   // gravity
  const JUMP_V = 18;    // jump force
  let isVisible = true; // For visibility pause
  let lastCoinLeft = 0; // Last coin position for avoiding same place

  // Visibility change for restart
  document.addEventListener("visibilitychange", () => {
    isVisible = !document.hidden;
    if (!isVisible && gameActive) {
      gameOver(false); // Restart game on hidden
    }
  });
  let gameActiveBeforePause = false;

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
  // === Geometry ===
  const r = el => el.getBoundingClientRect();
  const intersect = (a,b) => a.left < b.right && a.right > b.left && a.bottom > b.top && a.top < b.bottom;
  // === Level settings ===
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
    lastCoinLeft = 0; // Reset last coin position on level start
    updateHUD();
  }
  // === Reset world ===
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
  // === Start level ===
  async function startLevel() {
    startGameBtn.style.display = "none"; // hide start button
    mainMenuBtn.style.display = "none";
    leaderboardBtn.style.display = "none";
    resetWorld();
    applyLevel(currentLevel);
    countdown(3, ()=> {
      gameActive = true;
      gameActiveBeforePause = true;
      spawnNextCoin();
      spawnNextWave();
    });
  }
  // === Countdown ===
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
  // === Waves (from right to left) ===
  function spawnNextWave() {
    if (!gameActive) return;
    const wave = document.createElement("img");
    wave.src = "img/wave.png"; wave.className = "wave";
    const waveH = 100; // wave visual height (approx)
    const maxBottom = Math.max(0, Math.floor(window.innerHeight / 2 - waveH));
    wave.style.bottom = (Math.random() * maxBottom) + "px";
    wave.style.right = "-140px";
    wavesContainer.appendChild(wave);
    let posRight = -140;
    const iv = setInterval(()=>{
      if (!gameActive || !isVisible) { clearInterval(iv); wave.remove(); return; }
      posRight += waveSpeed; waveSpeed += waveAccel*0.1;
      wave.style.right = posRight + "px";
      const waveRect = r(wave);
      const shrink = 0.30; // shrink 30% from all sides (wave hitbox - edit shrink to change hit zone)
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
      // left the screen
      if (posRight > window.innerWidth + 140) {
        clearInterval(iv); wave.remove();
      }
    }, 20);
    // next wave in 1-2 sec (faster on higher levels)
    const base = 1700, extra = 1400 - currentLevel*200;
    waveSpawnTimer = setTimeout(spawnNextWave, base + Math.random()*extra);
  }
  // === Coins ===
  function spawnNextCoin() {
    if (!gameActive || droppedCoins >= totalCoins) return;
    const coin = document.createElement("img");
    coin.src = "img/coin.png";
    coin.className = "coin";
    // safe zone: between character and lighthouse
    const charRect = r(character);
    const lhRect = r(lighthouse);
    const padding = 50;
    const leftMinSafe = charRect.right + padding;
    const leftMaxSafe = lhRect.left - padding;
    let left = Math.random() * (leftMaxSafe - leftMinSafe) + leftMinSafe;
    const minDistance = 200; // Minimum distance from last coin
    // Ensure not too close to last coin
    let attempts = 0;
    while (Math.abs(left - lastCoinLeft) < minDistance && attempts < 10) {
      left = Math.random() * (leftMaxSafe - leftMinSafe) + leftMinSafe;
      attempts++;
    }
    lastCoinLeft = left; // Update last position
    coin.style.left = left + "px";
    coin.style.top = "-50px";
    coinsContainer.appendChild(coin);
    droppedCoins++;
    updateHUD();
    let posY = -50;
    const iv = setInterval(() => {
      if (!gameActive || !isVisible) { clearInterval(iv); coin.remove(); return; }
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
  // +1 float text
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
  // === Controls: arrows / WASD / ЦЫФВ + Space (jump) ===
  document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
  document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);
  function moveLoop() {
    if (gameActive && isVisible) {
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
      // Separate shrink coefficients (padding) for each side (0 = no shrink, 0.5 = shrink 50% from this side)
      // Decrease value to expand hitbox in that direction or make closer to edge
      const paddingLeft = lhRect.width * 0.60;   // Shrink from left (standard)
      const paddingRight = lhRect.width * 0.05;  // Less shrink from right — hitbox closer to right edge and stretched right
      const paddingTop = lhRect.height * 0.50;   // Shrink from top (standard)
      const paddingBottom = lhRect.height * 0.05; // Less shrink from bottom — hitbox bigger down (stretched down)
      const lhHitbox = {
        left: lhRect.left + paddingLeft,         // Left edge: shift right by paddingLeft
        right: lhRect.right - paddingRight,      // Right edge: subtract less to stretch right
        top: lhRect.top + paddingTop,            // Top edge: standard
        bottom: lhRect.bottom - paddingBottom    // Bottom edge: subtract less to stretch down (bigger down)
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
  // === Payment modal ===
  async function showPaymentModal(callback) {
    if (transactionInProgress) return; // Prevent multiple
    transactionInProgress = true;
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
      const goBtn = m.el.querySelector("#go");
      goBtn.onclick = async () => {
        goBtn.disabled = true; // Disable to prevent multiple clicks
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
        } finally {
          transactionInProgress = false;
          goBtn.disabled = false; // Re-enable if needed, but modal closed
        }
      };
    } catch (e) {
      console.error(e);
      alert("Connect wallet first. If you have multiple wallet extensions, disable all except one.");
    } finally {
      transactionInProgress = false;
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
    gameActiveBeforePause = false;
    clearTimeout(coinSpawnTimer); clearTimeout(waveSpawnTimer);
    // submit result
    try {
      const tx = await contract.submitResult(collectedCoins, currentLevel, reached, { gasLimit: 300000 });
      await tx.wait();
    } catch (e) {
      console.error(e);
      alert("Submit result failed: " + e.message);
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
          alert("Claim failed: " + e.message);
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
    mainMenuBtn.style.display = "block";
    leaderboardBtn.style.display = "block";
    startGameBtn.disabled = false;
    resetWorld();
  }
  function gameOver(byWave=true) {
    if (!gameActive) return;
    gameActive = false;
    gameActiveBeforePause = false;
    clearTimeout(coinSpawnTimer); clearTimeout(waveSpawnTimer);
    // submit without reward
    try { 
      const tx = await contract.submitResult(collectedCoins, currentLevel, false, { gasLimit: 300000 });
      await tx.wait();
    } catch(e){ console.error(e); alert("Submit result failed: " + e.message); }
    const m = modal(`<div style="text-align:center">
      <div style="font-size:22px;margin-bottom:6px">You were hit by a wave!</div>
      <div>Coins collected: <b>${collectedCoins}/${totalCoins}</b></div>
      <div style="margin-top:6px">You go back to Level 1.</div>
      <div style="margin-top:6px">${btn("Restart from Level 1","btnR","width:100%")}</div>
      <div style="margin-top:6px">${btn("Leaderboard","btnLeader","width:100%")}</div>
      <div style="margin-top:6px">${btn("Main Menu","btnMenu","width:100%")}</div>
      </div>`);
    m.el.querySelector("#btnR").onclick = ()=>{ m.close(); currentLevel=1; showPaymentModal(() => { startLevel(); }); };
    m.el.querySelector("#btnLeader").onclick = ()=>{ m.close(); window.location.href = "leaderboard.html"; };
    m.el.querySelector("#btnMenu").onclick = ()=>{ m.close(); window.location.href = "index.html"; };
    startGameBtn.style.display = "block";
    mainMenuBtn.style.display = "block";
    leaderboardBtn.style.display = "block";
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