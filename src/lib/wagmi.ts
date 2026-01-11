import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, metaMask, coinbaseWallet, safe } from "wagmi/connectors";

// Define the forked mainnet chain
export const forkedMainnet = defineChain({
  id: 1,
  name: "Forked Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://localhost:8545"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://etherscan.io",
    },
  },
});

export const config = createConfig({
  chains: [forkedMainnet],
  connectors: [
    injected({ shimDisconnect: true }),
    metaMask(),
    coinbaseWallet({ appName: "Treasury Manager" }),
    safe(),
  ],
  transports: {
    [forkedMainnet.id]: http(),
  },
});
