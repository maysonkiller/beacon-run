# 🌌 Beacon Run

**Beacon Run** is a decentralized Web3 game running on the **Pharos Network** (EVM-compatible blockchain).  
Players compete by collecting coins and completing levels, while rewards are automatically managed by a smart contract.

---

## 🎮 Gameplay
1. Connect your crypto wallet (MetaMask or any other EVM-compatible wallet).  
2. Register with a unique nickname.  
3. Pay the entry fee to start the game.  
4. Collect coins, avoid obstacles, and reach the lighthouse to complete levels.  
5. Earn rewards in PHRS tokens based on your performance.

---

## 🛠 Features
- Fully decentralized game logic via smart contracts.  
- Automatic reward distribution.  
- Leaderboard tracking all registered players.  
- Multi-level challenges with increasing difficulty.  
- Background music and animated gameplay.

---

## 🔗 Network & Contract
- **Blockchain:** Pharos Testnet  
- **Contract Name:** `BeaconRun.sol`  
- **Contract Address:** `0xcFF46730Ef32b7dd94B6F55Ac1A678bD9c9904FB`  
- **Smart Contract Functions:**  
  - `registerPlayer(nickname)` – register a new player  
  - `startGame()` – start a game (requires entry fee)  
  - `submitResult(coins, level, reachedLighthouse)` – submit game result  
  - `claimReward()` – claim earned rewards  
  - `getAllPlayersData()` – fetch all registered players and stats  

---

## ⚡ Installation & Play
1. Clone the repository:  
   ```bash
   git clone https://github.com/yourusername/beacon-run.git
