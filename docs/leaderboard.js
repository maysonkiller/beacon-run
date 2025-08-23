(async function(){
  const tblBody = document.querySelector("#tbl tbody");
  const tabAll = document.getElementById("tabAll");
  const tabTop = document.getElementById("tabTop");

  // провайдер только для чтения через RPC (без кошелька)
  const rpc = window.PHAROS.rpcUrls[0];
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, provider);

  let rows = [];
  try {
    const data = await contract.getAllPlayersData();
    const [addrs, nicks, totalCoinsArr, totalRewardArr, completedAllArr] = data;

    rows = addrs.map((a,i)=>({
      addr:a,
      nick:nicks[i],
      coins: Number(totalCoinsArr[i].toString()),
      rewardPHR: Number(ethers.utils.formatEther(totalRewardArr[i] || 0)),
      top: completedAllArr[i]
    }));

    // сортируем по монетам, убыв
    rows.sort((x,y)=> y.coins - x.coins);
  } catch(e) {
    console.error(e);
    alert("Failed to load leaderboard");
  }

  function short(a){ return a.slice(0,6) + "..." + a.slice(-4); }

  function render(filterTop=false) {
    tblBody.innerHTML = "";
    const list = filterTop ? rows.filter(r=>r.top) : rows;
    list.forEach((r,idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${r.nick || "-"}</td>
        <td class="addr" title="${r.addr}">${short(r.addr)}</td>
        <td>${r.coins}</td>
        <td>${r.rewardPHR.toFixed(4)}</td>
        <td>${r.top ? "Completed all 3" : "-"}</td>`;
      tblBody.appendChild(tr);
    });
  }

  tabAll.onclick = () => { tabAll.classList.add("active"); tabTop.classList.remove("active"); render(false); };
  tabTop.onclick = () => { tabTop.classList.add("active"); tabAll.classList.remove("active"); render(true); };

  render(false);
})();