# Beacon Run

## Overview
**Beacon Run** is an engaging blockchain-based endless runner game built on the **Pharos Testnet** (an EVM-compatible blockchain).  
Players control a character sprinting across a dynamic beach landscape, collecting coins while dodging crashing waves to reach the lighthouse.  
Successful runs earn cryptocurrency rewards in **PHR tokens**, with gameplay tied directly to smart contract interactions for registration, entry fees, result submission, and reward claims.

The game emphasizes **skill, strategy, and blockchain integration**, allowing players to compete on a global leaderboard.  
Powered by **ethers.js** for wallet connections and smart contract calls, the game supports both **desktop and mobile browsers** via WalletConnect for seamless EVM wallet integration (e.g., MetaMask).  

---

## Features
- **Blockchain Integration**: Connect your wallet, pay a small entry fee (0.01 PHR), submit results on-chain, and claim rewards securely via smart contracts.  
- **Progressive Levels**: Three difficulty levels with increasing waves, faster spawns, and more coins.  
- **Rewards System**: Collect coins → Earn PHR tokens (100 coins = 1 PHR). Reach the lighthouse to unlock rewards.  
- **Leaderboard**: Track the top players globally by coins collected and completed runs.  
- **Mobile-Friendly**: On-screen touch controls + WalletConnect support.  
- **Immersive Audio/Visuals**: Background music, animations, and intro video.  
- **Testnet Ready**: Deployed on **Pharos Testnet** for low-cost, risk-free play.  

---

## How to Play
### Objective
Run from left to right, collect coins, dodge waves, and reach the lighthouse.  

### Winning
- Gather as many coins as possible.  
- Submit your score on-chain to claim **PHR rewards**.  
- If you’re hit by a wave, you lose progress but can restart.  

### Levels
- **Level 1**: Collect 10 coins.  
- Higher levels = faster waves, more coins, and harder difficulty.  

### Rewards
- **Coins → PHR Conversion** (e.g., 50 coins = 0.5 PHR).  
- Claim rewards after a successful run.  

---

## Getting Started

### 1. Visit the Game
Play directly in your browser (deployed site or local host).  

### 2. Connect Your Wallet
- **Desktop**: MetaMask or any EVM wallet. Switch to **Pharos Testnet** (Chain ID: `0xa8230` / 688688).  
- **Mobile**: Use WalletConnect → redirect to your wallet app.  

### 3. Register
Enter a nickname (3–32 characters) and confirm the transaction.  

### 4. Start Game
Pay the **entry fee (0.01 PHR)** to begin.  

### 5. Controls
- **Desktop**: Arrow Keys / WASD for movement, Space/Up/W to jump.  
- **Mobile**: On-screen buttons (Left, Right, Jump).  

### 6. Gameplay Loop
- Collect coins falling from the sky.  
- Dodge crashing waves.  
- Reach the lighthouse → finish the level.  
- Submit score on-chain & claim rewards.  

### 7. End Game
- Hit by a wave = restart from Level 1.  
- Check leaderboard to see your rank.  

---

## What You’ll Need
- **Wallet**: MetaMask or any EVM wallet.  
- **Pharos Testnet** RPC:  
  - RPC URL: `https://testnet.dplabs-internal.com`  
  - Explorer: [https://testnet.pharosscan.xyz](https://testnet.pharosscan.xyz)  
- **Test Tokens**: Use the faucet to claim free PHR.  

---

## Developer Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/beacon-run.git

# Install dependencies (not required: pure vanilla JS + ethers.js via CDN)
# Start local server
python -m http.server
```

### Update Smart Contract Config
- Edit `contract.js` → insert your deployed contract **address** & **ABI**.  

### Deploy Frontend
- Host on **GitHub Pages**, **Vercel**, or any static hosting.  

---

## Technologies
- **Frontend**: HTML5, CSS3, Vanilla JavaScript  
- **Blockchain**: ethers.js v5, WalletConnect v2  
- **Smart Contracts**: Solidity (Pharos Testnet)  
- **Media**: Custom images, music, and animations  

---

## Links
- **Pharos Testnet Explorer**: [Pharos Explorer](https://testnet.pharosscan.xyz)  
- **Faucet**: (link to faucet)  
- **Smart Contract**: (add deployed contract link)  
- **Twitter**: [@pharos_network](https://twitter.com/pharos_network) | [@Developer](https://twitter.com/)  

---

✨ Enjoy **Beacon Run** — collect, dodge, and earn tokens!  
For questions or feedback, open an **issue** on GitHub.  
