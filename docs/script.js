const bgMusic = document.getElementById("bgMusic");
const musicBtn = document.getElementById("musicBtn");
const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const leaderBtn = document.getElementById("leaderBtn");

let provider, signer, contract, userAddress;

// ===== Музыка =====
musicBtn.addEventListener("click", () => {
  if (bgMusic.paused) {
    bgMusic.play().catch(()=>{});
    musicBtn.textContent = "🎵 Music On";
  } else {
    bgMusic.pause();
    musicBtn.textContent = "🎵 Music Off";
  }
});

// ===== Лидерборд =====
leaderBtn.addEventListener("click", () => {
  window.location.href = "/leaderboard.html";
});

// ===== Подключение кошелька + регистрация =====
async function connect() {
  if (!window.ethereum) { alert("Install MetaMask!"); return; }
  await ensurePharos(); // добавить/переключить сеть Pharos

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  userAddress = await signer.getAddress();
  contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, signer);

  try {
    const p = await contract.players(userAddress);
    if (!p.registered) {
      const nickname = prompt("Enter a nickname (3–32 chars):");
      if (!nickname || nickname.trim().length < 3 || nickname.trim().length > 32) {
        alert("Invalid nickname.");
        return;
      }
      const tx = await contract.registerPlayer(nickname.trim());
      await tx.wait();
      alert(`Registered: ${nickname.trim()}`);
    } else {
      alert(`Welcome back, ${p.nickname}!`);
    }
    startBtn.disabled = false;
  } catch (e) {
    console.error(e);
    alert("Failed to connect/verify player.");
  }
}

connectBtn.addEventListener("click", connect);

// ===== Переход в игру =====
startBtn.addEventListener("click", async () => {
  if (!signer) { alert("Connect wallet first!"); return; }
  // просто переходим в game.html; оплата взимается на сцене игры при нажатии её Start
  const url = new URL("/game.html", window.location.origin);
  window.location.href = url.toString();
});
