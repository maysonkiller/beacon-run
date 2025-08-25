// script.js
const bgMusic = document.getElementById("bgMusic");
const musicBtn = document.getElementById("musicBtn");
const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const leaderBtn = document.getElementById("leaderBtn");
const walletStatus = document.getElementById("walletStatus");
const mobileHint = document.getElementById("mobileHint");
let provider, signer, contract, userAddress;

const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile && mobileHint) {
  mobileHint.style.display = 'block';
}

function nicknameModal(onSubmit) {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, { 
    position: "fixed", inset: "0", display: "grid", placeItems: "center", 
    background: "rgba(0,0,0,.6)", zIndex: "9999",
    padding: isMobile ? "10px" : "20px"
  });
  wrap.innerHTML = `
    <div style="
      min-width: ${isMobile ? '280px' : '320px'};
      max-width: ${isMobile ? '95vw' : '90vw'};
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
    </div>`;
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

musicBtn.addEventListener("click", () => {
  if (bgMusic.paused) {
    bgMusic.play().catch(() => {});
    musicBtn.textContent = "Music On";
  } else {
    bgMusic.pause();
    musicBtn.textContent = "Music Off";
  }
});

leaderBtn.addEventListener("click", () => {
  window.location.href = "leaderboard.html";
});

async function connect() {
  try {
    if (isMobile) {
      if (typeof window.EthereumProvider === 'undefined') {
        console.error("EthereumProvider not loaded");
        alert("Please open this game in a browser or wallet app that supports WalletConnect (e.g., MetaMask, Trust Wallet). If using Telegram/Discord, tap 'Open in Browser' and try again.");
        return;
      }
      const wcProvider = await window.EthereumProvider.init({
        projectId: "f3a4411a5d6201d00fd86817d41b64e8",
        chains: [parseInt(window.PHAROS.chainId, 16)],
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
        console.log("WalletConnect URI:", uri);
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
          console.log("WalletConnect connected");
        });
      });

      await wcProvider.enable();
      provider = new ethers.providers.Web3Provider(wcProvider);
    } else {
      if (!window.ethereum) {
        alert("Install an EVM-compatible wallet like MetaMask!");
        return;
      }
      await window.ensurePharos();
      provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
    }
    signer = provider.getSigner();
    userAddress = await signer.getAddress();
    contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, signer);
    const p = await contract.players(userAddress);
    if (!p.registered) {
      nicknameModal(async (nickname) => {
        try {
          const tx = await contract.registerPlayer(nickname, { gasLimit: 300000 });
          await tx.wait();
          alert(`Registered: ${nickname}`);
          walletStatus.textContent = `Connected: ${shortAddress(userAddress)} | Name: ${nickname}`;
          startBtn.disabled = false;
        } catch (regError) {
          console.error("Registration error:", regError);
          if (regError.message.includes("already registered") || 
              (regError.data && regError.data.message.includes("already registered"))) {
            alert("You are already registered. Welcome back!");
            walletStatus.textContent = `Connected: ${shortAddress(userAddress)} | Name: ${p.nickname}`;
            startBtn.disabled = false;
          } else {
            alert("Registration failed: " + regError.message);
          }
        }
      });
    } else {
      alert(`Welcome back, ${p.nickname}!`);
      walletStatus.textContent = `Connected: ${shortAddress(userAddress)} | Name: ${p.nickname}`;
      startBtn.disabled = false;
    }
  } catch (e) {
    console.error("Connect error:", e);
    alert("Failed to connect wallet. Please ensure your wallet app is installed and try again.");
  }
}

function shortAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

connectBtn.addEventListener("click", connect);

startBtn.addEventListener("click", async () => {
  if (!signer) {
    alert("Connect wallet first!");
    return;
  }
  window.location.href = "game.html";
});