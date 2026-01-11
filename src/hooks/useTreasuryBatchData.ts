import { useQueries } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { POLICY_TREASURY_ABI } from "@/lib/contracts/abis";
import { formatUnits } from "viem";
import type { Treasury } from "@/hooks/useTreasuryDB";

export interface TreasuryOnChainData {
  address: string;
  balance: string;
  balanceRaw: bigint;
  spentThisPeriod: string;
  maxSpendPerPeriod: string;
  periodProgress: number;
}

// Hook for a single treasury's on-chain data
export function useSingleTreasuryData(treasuryAddress?: string) {
  const publicClient = usePublicClient();

  const queries = useQueries({
    queries: [
      {
        queryKey: ["treasury-balance", treasuryAddress],
        queryFn: async () => {
          if (!publicClient || !treasuryAddress) return 0n;
          return publicClient.readContract({
            address: treasuryAddress as `0x${string}`,
            abi: POLICY_TREASURY_ABI,
            functionName: "balance",
          });
        },
        enabled: !!treasuryAddress && !!publicClient,
      },
      {
        queryKey: ["treasury-spentThisPeriod", treasuryAddress],
        queryFn: async () => {
          if (!publicClient || !treasuryAddress) return 0n;
          return publicClient.readContract({
            address: treasuryAddress as `0x${string}`,
            abi: POLICY_TREASURY_ABI,
            functionName: "spentThisPeriod",
          });
        },
        enabled: !!treasuryAddress && !!publicClient,
      },
      {
        queryKey: ["treasury-maxSpendPerPeriod", treasuryAddress],
        queryFn: async () => {
          if (!publicClient || !treasuryAddress) return 0n;
          return publicClient.readContract({
            address: treasuryAddress as `0x${string}`,
            abi: POLICY_TREASURY_ABI,
            functionName: "maxSpendPerPeriod",
          });
        },
        enabled: !!treasuryAddress && !!publicClient,
      },
      {
        queryKey: ["treasury-periodSeconds", treasuryAddress],
        queryFn: async () => {
          if (!publicClient || !treasuryAddress) return 0n;
          return publicClient.readContract({
            address: treasuryAddress as `0x${string}`,
            abi: POLICY_TREASURY_ABI,
            functionName: "periodSeconds",
          });
        },
        enabled: !!treasuryAddress && !!publicClient,
      },
    ],
  });

  const [balanceQuery, spentQuery, maxSpendQuery, periodSecondsQuery] = queries;
  const isLoading = queries.some((q) => q.isLoading);

  const balanceRaw = (balanceQuery.data as bigint) ?? 0n;
  const spentRaw = (spentQuery.data as bigint) ?? 0n;
  const maxSpendRaw = (maxSpendQuery.data as bigint) ?? 0n;
  const periodSeconds = periodSecondsQuery.data ? Number(periodSecondsQuery.data) : 0;

  const periodProgress =
    periodSeconds === 0
      ? -1
      : maxSpendRaw > 0n
      ? Number((spentRaw * 100n) / maxSpendRaw)
      : 0;

  const data: TreasuryOnChainData | undefined = treasuryAddress
    ? {
        address: treasuryAddress,
        balance: formatUnits(balanceRaw, 18),
        balanceRaw,
        spentThisPeriod: formatUnits(spentRaw, 18),
        maxSpendPerPeriod: formatUnits(maxSpendRaw, 18),
        periodProgress,
      }
    : undefined;

  return {
    data,
    isLoading,
  };
}

// Batch hook that fetches on-chain data for all treasuries
export function useTreasuryBatchData(treasuries: Treasury[] | undefined) {
  const publicClient = usePublicClient();

  // Create queries for each treasury
  const queries = useQueries({
    queries: (treasuries ?? []).map((treasury) => ({
      queryKey: ["treasury-batch-data", treasury.address],
      queryFn: async (): Promise<TreasuryOnChainData> => {
        if (!publicClient) {
          return {
            address: treasury.address,
            balance: "0",
            balanceRaw: 0n,
            spentThisPeriod: "0",
            maxSpendPerPeriod: "0",
            periodProgress: 0,
          };
        }

        const [balance, spentThisPeriod, maxSpendPerPeriod, periodSeconds] =
          await Promise.all([
            publicClient.readContract({
              address: treasury.address as `0x${string}`,
              abi: POLICY_TREASURY_ABI,
              functionName: "balance",
            }),
            publicClient.readContract({
              address: treasury.address as `0x${string}`,
              abi: POLICY_TREASURY_ABI,
              functionName: "spentThisPeriod",
            }),
            publicClient.readContract({
              address: treasury.address as `0x${string}`,
              abi: POLICY_TREASURY_ABI,
              functionName: "maxSpendPerPeriod",
            }),
            publicClient.readContract({
              address: treasury.address as `0x${string}`,
              abi: POLICY_TREASURY_ABI,
              functionName: "periodSeconds",
            }),
          ]);

        const balanceRaw = balance as bigint;
        const spentRaw = spentThisPeriod as bigint;
        const maxSpendRaw = maxSpendPerPeriod as bigint;
        const periodSecs = Number(periodSeconds);

        const periodProgress =
          periodSecs === 0
            ? -1
            : maxSpendRaw > 0n
            ? Number((spentRaw * 100n) / maxSpendRaw)
            : 0;

        return {
          address: treasury.address,
          balance: formatUnits(balanceRaw, 18),
          balanceRaw,
          spentThisPeriod: formatUnits(spentRaw, 18),
          maxSpendPerPeriod: formatUnits(maxSpendRaw, 18),
          periodProgress,
        };
      },
      enabled: !!publicClient && !!treasury.address,
      staleTime: 10_000, // Consider fresh for 10s
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);

  // Build a map of address -> on-chain data
  const dataMap = new Map<string, TreasuryOnChainData>();
  queries.forEach((query) => {
    if (query.data) {
      dataMap.set(query.data.address.toLowerCase(), query.data);
    }
  });

  const refetch = () => {
    queries.forEach((q) => q.refetch());
  };

  return { data: dataMap, isLoading, refetch };
}
