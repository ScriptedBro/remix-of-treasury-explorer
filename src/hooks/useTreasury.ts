import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from "wagmi";
import { POLICY_TREASURY_ABI } from "@/lib/contracts/abis";
import { formatUnits } from "viem";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { getTreasuryStatus, type TreasuryStatus } from "@/lib/treasury-status";

interface UseTreasuryProps {
  address: `0x${string}`;
  tokenDecimals?: number;
  hasTransactions?: boolean;
  hasMigration?: boolean;
}

export function useTreasury({ address, tokenDecimals = 18, hasTransactions = false, hasMigration = false }: UseTreasuryProps) {
  const publicClient = usePublicClient();
  
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

  // Write functions
  const { 
    writeContract: writeSpend, 
    data: spendHash,
    isPending: isSpendPending,
    reset: resetSpend
  } = useWriteContract();

  const { 
    writeContract: writeMigrate, 
    data: migrateHash,
    isPending: isMigratePending,
    reset: resetMigrate
  } = useWriteContract();

  const { 
    writeContract: writeWithdrawAll, 
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

  // Functions
  const spend = (to: `0x${string}`, amount: bigint) => {
    writeSpend({
      address,
      abi: POLICY_TREASURY_ABI,
      functionName: "spend",
      args: [to, amount],
    } as any);
  };

  const migrate = () => {
    writeMigrate({
      address,
      abi: POLICY_TREASURY_ABI,
      functionName: "migrate",
    } as any);
  };

  const withdrawAll = (to: `0x${string}`) => {
    writeWithdrawAll({
      address,
      abi: POLICY_TREASURY_ABI,
      functionName: "withdrawAll",
      args: [to],
    } as any);
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
    });
  }, [balance, expiryTimestamp, hasTransactions, hasMigration]);

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
