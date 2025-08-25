const bgMusic = document.getElementById("bgMusic");
const musicBtn = document.getElementById("musicBtn");
const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const leaderBtn = document.getElementById("leaderBtn");
const walletStatus = document.getElementById("walletStatus");
const mobileHint = document.getElementById("mobileHint");
let provider, signer, contract, userAddress;

// ===== Modal for nickname =====
function nicknameModal(onSubmit) {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { 
    position: "fixed", inset: "0", display: "grid", placeItems: "center", 
    background: "rgba(0,0,0,.6)", zIndex: "9999"
  });
  wrap.innerHTML = `
    <div style="
      min-width: 320px;
      max-width: 90vw;
      background: rgba(10,12,25,.95);
      border: 2px solid #0ff;
      border-radius: 16px;
      padding: 18px;
      color: #0ff;
      font-family: 'Space Grotesk', sans-serif;
      box-shadow: 0 10px 40px rgba(0,255,255,.25);
      box-sizing: border-box;
      text-align: center;
    ">
      <h2>Enter Nickname</h2>
      <input id="nickInput" type="text" placeholder="3-32 characters"
        style="
          width: 100%;
          max-width: 100%;
          padding: 10px;
          border: 2px solid #0ff;
          background: #000;
          color: #0ff;
          border-radius: 8px;
          margin-bottom: 10px;
          box-sizing: border-box;
        ">
      <button id="submitNick" style="
          padding: 10px 20px;
          border: 2px solid #0ff;
          background: #000;
          color: #0ff;
          border-radius: 8px;
          cursor: pointer;
          box-sizing: border-box;
        ">Submit</button>
    </div>
  `;
  document.body.appendChild(wrap);
  const input = wrap.querySelector("#nickInput");
  const btn = wrap.querySelector("#submitNick");
  btn.onclick = () => {
    const nick = input.value.trim();
    if (nick.length >= 3 && nick.length <= 32) {
      onSubmit(nick);
      wrap.remove();
    } else {
      alert("Invalid nickname.");
    }
  };
  return { el: wrap };
}

// ===== Music =====
musicBtn.addEventListener("click", () => {
  if (bgMusic.paused) {
    bgMusic.play().catch(()=>{});
    musicBtn.textContent = " Music On";
  } else {
    bgMusic.pause();
    musicBtn.textContent = " Music Off";
  }
});

// ===== Leaderboard =====
leaderBtn.addEventListener("click", () => {
  window.location.href = "leaderboard.html";
});

// ===== Wallet connection + registration =====
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
      return;
    }
    provider = new ethers.providers.Web3Provider(provider);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, signer);
    const p = await contract.players(userAddress);
    if (!p.registered) {
      nicknameModal(async (nickname) => {
        try {
          const tx = await contract.registerPlayer(nickname, { gasLimit: 300000 });
          await tx.wait();
          walletStatus.textContent = `Connected: ${shortAddress(userAddress)} | Name: ${nickname}`;
          startBtn.disabled = false;
        } catch (regError) {
          console.error(regError);
          if (regError.message.includes("already registered") || 
              (regError.data && regError.data.message.includes("already registered"))) {
            walletStatus.textContent = `Connected: ${shortAddress(userAddress)} | Name: ${p.nickname}`;
            startBtn.disabled = false;
          } else {
            alert("Registration failed.");
          }
        }
      });
    } else {
      walletStatus.textContent = `Connected: ${shortAddress(userAddress)} | Name: ${p.nickname}`;
      startBtn.disabled = false;
    }
  } catch (e) {
    console.error(e);
    alert("Failed to connect: " + e.message + ". If you have multiple wallet extensions, disable all except one.");
  }
}

function shortAddress(addr) {
  return addr.slice(0,6) + "..." + addr.slice(-4);
}

connectBtn.addEventListener("click", connect);

// ===== Go to game =====
startBtn.addEventListener("click", async () => {
  if (!signer) { 
    alert("Connect wallet first!"); 
    return; 
  }
  window.location.href = "game.html";
});