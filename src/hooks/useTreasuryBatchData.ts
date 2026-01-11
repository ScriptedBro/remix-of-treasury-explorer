import { useReadContract } from "wagmi";
import { POLICY_TREASURY_ABI } from "@/lib/contracts/abis";
import { formatUnits } from "viem";
import type { Treasury } from "@/hooks/useTreasuryDB";

interface TreasuryOnChainData {
  address: string;
  balance: string;
  balanceRaw: bigint;
  spentThisPeriod: string;
  maxSpendPerPeriod: string;
  periodProgress: number;
}

// Hook for a single treasury's on-chain data
export function useSingleTreasuryData(treasuryAddress?: string) {
  const { data: balanceData, isLoading: balanceLoading } = useReadContract({
    address: treasuryAddress as `0x${string}`,
    abi: POLICY_TREASURY_ABI,
    functionName: 'balance',
    query: { enabled: !!treasuryAddress },
  });

  const { data: spentData, isLoading: spentLoading } = useReadContract({
    address: treasuryAddress as `0x${string}`,
    abi: POLICY_TREASURY_ABI,
    functionName: 'spentThisPeriod',
    query: { enabled: !!treasuryAddress },
  });

  const { data: maxSpendData, isLoading: maxSpendLoading } = useReadContract({
    address: treasuryAddress as `0x${string}`,
    abi: POLICY_TREASURY_ABI,
    functionName: 'maxSpendPerPeriod',
    query: { enabled: !!treasuryAddress },
  });

  const { data: periodSecondsData, isLoading: periodSecondsLoading } = useReadContract({
    address: treasuryAddress as `0x${string}`,
    abi: POLICY_TREASURY_ABI,
    functionName: 'periodSeconds',
    query: { enabled: !!treasuryAddress },
  });

  const balanceRaw = (balanceData as bigint) ?? 0n;
  const spentRaw = (spentData as bigint) ?? 0n;
  const maxSpendRaw = (maxSpendData as bigint) ?? 0n;
  const periodSeconds = periodSecondsData ? Number(periodSecondsData) : 0;

  // When periodSeconds === 0, period tracking is disabled, so progress is N/A
  const periodProgress = periodSeconds === 0 
    ? -1 // Use -1 to indicate N/A
    : maxSpendRaw > 0n 
    ? Number((spentRaw * 100n) / maxSpendRaw) 
    : 0;

  const data: TreasuryOnChainData | undefined = treasuryAddress ? {
    address: treasuryAddress,
    balance: formatUnits(balanceRaw, 18),
    balanceRaw,
    spentThisPeriod: formatUnits(spentRaw, 18),
    maxSpendPerPeriod: formatUnits(maxSpendRaw, 18),
    periodProgress,
  } : undefined;

  return {
    data,
    isLoading: balanceLoading || spentLoading || maxSpendLoading || periodSecondsLoading,
  };
}

// For batch data, we now use individual hooks per treasury via a component wrapper
export function useTreasuryBatchData(treasuries: Treasury[] | undefined) {
  // This hook now returns a placeholder - use TreasuryCardWithData component instead
  // which handles individual data fetching per card
  const treasuryDataMap = new Map<string, TreasuryOnChainData>();
  
  return { data: treasuryDataMap, isLoading: false, refetch: () => {} };
}
