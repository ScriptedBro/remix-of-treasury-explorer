import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { POLICY_TREASURY_ABI } from "@/lib/contracts/abis";
import { decodeEventLog, formatUnits } from "viem";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getTreasuryStatus, type TreasuryStatus } from "@/lib/treasury-status";
import { useRecordTransaction, useTreasuryByAddress } from "@/hooks/useTreasuryDB";

interface UseTreasuryProps {
  address: `0x${string}`;
  tokenDecimals?: number;
  hasTransactions?: boolean;
  hasMigration?: boolean;
}

export function useTreasury({ address, tokenDecimals = 18, hasTransactions = false, hasMigration = false }: UseTreasuryProps) {
  const publicClient = usePublicClient();
  const [chainNow, setChainNow] = useState<number | null>(null);
  const { data: treasuryDB } = useTreasuryByAddress(address);
  const recordTransaction = useRecordTransaction();
  
  // Read treasury data
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "balance",
  });

  const { data: owner } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "owner",
  });

  const { data: token } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "token",
  });

  const { data: maxSpendPerPeriod } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "maxSpendPerPeriod",
  });

  const { data: periodSeconds } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "periodSeconds",
  });

  const { data: expiryTimestamp } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "expiryTimestamp",
  });

  const { data: migrationTarget } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "migrationTarget",
  });

  const { data: spentThisPeriod, refetch: refetchSpent } = useReadContract({
    address,
    abi: POLICY_TREASURY_ABI,
    functionName: "spentThisPeriod",
  });

  useEffect(() => {
    let cancelled = false;

    const fetchChainTime = async () => {
      if (!publicClient) return;
      try {
        const block = await publicClient.getBlock();
        if (cancelled) return;
        setChainNow(Number(block.timestamp));
      } catch {
        // ignore; fallback to local time
      }
    };

    fetchChainTime();

    const id = setInterval(fetchChainTime, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [publicClient]);

  // Write functions
  const { 
    writeContractAsync: writeSpendAsync, 
    data: spendHash,
    isPending: isSpendPending,
    reset: resetSpend
  } = useWriteContract();

  const { 
    writeContractAsync: writeMigrateAsync, 
    data: migrateHash,
    isPending: isMigratePending,
    reset: resetMigrate
  } = useWriteContract();

  const { 
    writeContractAsync: writeWithdrawAllAsync, 
    data: withdrawAllHash,
    isPending: isWithdrawAllPending,
    reset: resetWithdrawAll
  } = useWriteContract();

  // Transaction receipts
  const { isLoading: isSpendConfirming, isSuccess: isSpendSuccess } = useWaitForTransactionReceipt({
    hash: spendHash,
  });

  const { isLoading: isMigrateConfirming, isSuccess: isMigrateSuccess } = useWaitForTransactionReceipt({
    hash: migrateHash,
  });

  const { isLoading: isWithdrawAllConfirming, isSuccess: isWithdrawAllSuccess } = useWaitForTransactionReceipt({
    hash: withdrawAllHash,
  });

  // Refetch data after successful transactions
  useEffect(() => {
    if (isSpendSuccess) {
      refetchBalance();
      refetchSpent();
      toast.success("Spend transaction confirmed!");
      resetSpend();
    }
  }, [isSpendSuccess, refetchBalance, refetchSpent, resetSpend]);

  useEffect(() => {
    if (isMigrateSuccess) {
      refetchBalance();
      refetchSpent();
      toast.success("Migration transaction confirmed!");
      resetMigrate();
    }
  }, [isMigrateSuccess, refetchBalance, refetchSpent, resetMigrate]);

  useEffect(() => {
    if (isWithdrawAllSuccess) {
      refetchBalance();
      refetchSpent();
      toast.success("Withdrawal transaction confirmed!");
      resetWithdrawAll();
    }
  }, [isWithdrawAllSuccess, refetchBalance, refetchSpent, resetWithdrawAll]);

  useEffect(() => {
    const recordWithdrawAll = async () => {
      if (!isWithdrawAllSuccess || !withdrawAllHash) return;
      if (!publicClient || !treasuryDB) return;

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: withdrawAllHash });
        const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

        const withdrawLog = receipt.logs.find((l) => {
          try {
            const decoded = decodeEventLog({
              abi: POLICY_TREASURY_ABI,
              data: l.data,
              topics: l.topics,
            });
            return decoded.eventName === "WithdrawAll";
          } catch {
            return false;
          }
        });

        if (!withdrawLog) return;

        const decoded = decodeEventLog({
          abi: POLICY_TREASURY_ABI,
          data: withdrawLog.data,
          topics: withdrawLog.topics,
        });

        const to = String((decoded.args as any).to) as `0x${string}`;
        const operator = String((decoded.args as any).operator) as `0x${string}`;
        const amount = (decoded.args as any).amount as bigint;

        await recordTransaction.mutateAsync({
          treasury_id: treasuryDB.id,
          tx_hash: withdrawAllHash,
          event_type: "withdraw",
          from_address: address,
          to_address: to,
          amount: amount.toString(),
          block_number: Number(receipt.blockNumber),
          block_timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
          log_index: Number(withdrawLog.logIndex ?? 0),
        });
      } catch (e) {
        console.error("Failed to record withdrawAll transaction:", e);
      }
    };

    recordWithdrawAll();
  }, [address, isWithdrawAllSuccess, publicClient, recordTransaction, treasuryDB, withdrawAllHash]);

  // Functions
  const spend = async (to: `0x${string}`, amount: bigint) => {
    try {
      await writeSpendAsync({
        address,
        abi: POLICY_TREASURY_ABI,
        functionName: "spend",
        args: [to, amount],
      } as any);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const migrate = async () => {
    try {
      await writeMigrateAsync({
        address,
        abi: POLICY_TREASURY_ABI,
        functionName: "migrate",
      } as any);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const withdrawAll = async (to: `0x${string}`) => {
    try {
      await writeWithdrawAllAsync({
        address,
        abi: POLICY_TREASURY_ABI,
        functionName: "withdrawAll",
        args: [to],
      } as any);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const checkWhitelist = async (addr: `0x${string}`): Promise<boolean> => {
    if (!publicClient || !address) {
      return false;
    }
    try {
      const result = await publicClient.readContract({
        address,
        abi: POLICY_TREASURY_ABI,
        functionName: "isWhitelisted",
        args: [addr],
      });
      return result as boolean;
    } catch (error) {
      console.error("Error checking whitelist:", error);
      return false;
    }
  };

  // Calculate remaining allowance
  const remainingAllowance = maxSpendPerPeriod && spentThisPeriod
    ? maxSpendPerPeriod - spentThisPeriod
    : maxSpendPerPeriod;

  // Calculate period progress
  // When periodSeconds === 0n, period tracking is disabled, so progress is N/A
  const periodProgress = periodSeconds === 0n 
    ? -1 // Use -1 to indicate N/A
    : maxSpendPerPeriod && spentThisPeriod
    ? Number((spentThisPeriod * 100n) / maxSpendPerPeriod)
    : 0;

  // Calculate treasury status
  const status: TreasuryStatus = useMemo(() => {
    return getTreasuryStatus({
      balance: balance ?? 0n,
      expiryTimestamp: expiryTimestamp ? Number(expiryTimestamp) : 0,
      hasTransactions,
      hasMigration,
      now: chainNow ?? undefined,
    });
  }, [balance, expiryTimestamp, hasTransactions, hasMigration, chainNow]);

  return {
    // Data
    balance: balance ? formatUnits(balance, tokenDecimals) : "0",
    balanceRaw: balance,
    owner,
    token,
    maxSpendPerPeriod: maxSpendPerPeriod ? formatUnits(maxSpendPerPeriod, tokenDecimals) : "0",
    maxSpendPerPeriodRaw: maxSpendPerPeriod,
    periodSeconds: periodSeconds ? Number(periodSeconds) : 0,
    expiryTimestamp: expiryTimestamp ? Number(expiryTimestamp) : 0,
    migrationTarget,
    spentThisPeriod: spentThisPeriod ? formatUnits(spentThisPeriod, tokenDecimals) : "0",
    spentThisPeriodRaw: spentThisPeriod,
    remainingAllowance: remainingAllowance ? formatUnits(remainingAllowance, tokenDecimals) : "0",
    remainingAllowanceRaw: remainingAllowance,
    periodProgress,
    status,
    
    // Actions
    spend,
    migrate,
    withdrawAll,
    checkWhitelist,
    refetchBalance,
    refetchSpent,
    
    // Status
    isSpendPending: isSpendPending || isSpendConfirming,
    isMigratePending: isMigratePending || isMigrateConfirming,
    isWithdrawAllPending: isWithdrawAllPending || isWithdrawAllConfirming,
  };
}
