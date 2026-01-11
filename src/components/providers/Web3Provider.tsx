import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { forkedMainnet } from "@/lib/wagmi";
import { injected, metaMask, coinbaseWallet, safe } from "wagmi/connectors";

const queryClient = new QueryClient();

// Create config for local development with multiple wallet options
const config = createConfig({
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

interface Web3ProviderProps {
  children: React.ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
