// leaderboard.js
(async function(){
  const tblBody = document.querySelector("#tbl tbody");
  const tabAll = document.getElementById("tabAll");
  const tabTop = document.getElementById("tabTop");

  // провайдер только для чтения через RPC (без кошелька)
  const rpc = window.PHAROS.rpcUrls[0];
  const provider = new ethers.providers.JsonRpcProvider(rpc);
  const contract = new ethers.Contract(window.BeaconRun_ADDRESS, window.BeaconRun_ABI, provider);

  let rows = [];
  let currentPage = 1;
  const pageSize = 20; // По 20 на страницу
  let currentFilterTop = false;

  try {
    const addrs = await contract.getAllPlayers();

    // Fetch data for each player individually
    for (const addr of addrs) {
      const p = await contract.players(addr);
      rows.push({
        addr: addr,
        nick: p.nickname,
        coins: Number(p.totalCoins.toString()),
        rewardPHR: Number(ethers.utils.formatEther(p.totalReward || 0)),
        top: p.completedAll
      });
    }

    // сортируем по монетам, убыв
    rows.sort((x,y)=> y.coins - x.coins);
  } catch(e) {
    console.error(e);
    alert("Failed to load leaderboard");
  }

  function short(a){ return a.slice(0,6) + "..." + a.slice(-4); }

  function render(filterTop=false, page=1) {
    currentFilterTop = filterTop;
    currentPage = page;
    tblBody.innerHTML = "";
    const list = filterTop ? rows.filter(r=>r.top) : rows;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedList = list.slice(start, end);
    paginatedList.forEach((r,idx)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${start + idx + 1}</td>
        <td>${r.nick || "-"}</td>
        <td class="addr" title="${r.addr}">${short(r.addr)}</td>
        <td>${r.coins}</td>
        <td>${r.rewardPHR.toFixed(4)}</td>
        <td>${r.top ? "Completed all 3" : "-"}</td>`;
      tblBody.appendChild(tr);
    });

    // Добавляем пагинацию
    const pagination = document.createElement("div");
    pagination.style.textAlign = "center";
    pagination.style.marginTop = "10px";
    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Previous";
    prevBtn.disabled = page <= 1;
    prevBtn.onclick = () => render(filterTop, page - 1);
    prevBtn.style.marginRight = "10px";
    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.disabled = end >= list.length;
    nextBtn.onclick = () => render(filterTop, page + 1);
    pagination.appendChild(prevBtn);
    pagination.appendChild(nextBtn);
    tblBody.parentNode.appendChild(pagination); // Добавляем после таблицы
  }

  tabAll.onclick = () => { tabAll.classList.add("active"); tabTop.classList.remove("active"); render(false, 1); };
  tabTop.onclick = () => { tabTop.classList.add("active"); tabAll.classList.remove("active"); render(true, 1); };

  render(false, 1);
})();