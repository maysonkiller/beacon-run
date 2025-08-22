// network.js (unified chain config, fixed chainId comment, RPC and explorer consistent)
window.PHAROS = {
    chainId: '0xa8230', // 688688 decimal
    chainName: 'Pharos Testnet',
    nativeCurrency: { name: 'Pharos', symbol: 'PHRS', decimals: 18 },
    rpcUrls: ['https://testnet.dplabs-internal.com'],
    blockExplorerUrls: ['https://testnet.pharosscan.xyz']
};

// Подключение к Pharos Testnet
window.ensurePharos = async function() {
    if (!window.ethereum) throw new Error('No wallet installed');

    const hex = window.PHAROS.chainId;
    try {
        // Переключаем на сеть Pharos
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hex }]
        });
    } catch (e) {
        if (e.code === 4902) {
            // Добавляем сеть, если её нет
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [window.PHAROS]
            });
        } else {
            throw e;
        }
    }
};