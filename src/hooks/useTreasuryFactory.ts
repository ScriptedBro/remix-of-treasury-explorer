import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { TREASURY_FACTORY_ABI } from "@/lib/contracts/abis";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/config";
import { parseUnits } from "viem";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { decodeEventLog } from "viem";

interface CreateTreasuryParams {
  maxSpendPerPeriod: string;
  periodSeconds: number;
  whitelist: `0x${string}`[];
  expiryTimestamp: number;
  migrationTarget: `0x${string}`;
  tokenDecimals?: number;
}

export function useTreasuryFactory() {
  const [deployedAddress, setDeployedAddress] = useState<`0x${string}` | null>(null);

  const { 
    writeContract, 
    data: hash,
    isPending,
    error,
    reset
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess,
    data: receipt
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Extract deployed treasury address from transaction logs
  useEffect(() => {
    if (isSuccess && receipt) {
      try {
        const deployLog = receipt.logs.find((log) => {
          try {
            const decoded = decodeEventLog({
              abi: TREASURY_FACTORY_ABI,
              data: log.data,
              topics: log.topics,
            }) as { eventName: string };
            return decoded.eventName === "TreasuryDeployed";
          } catch {
            return false;
          }
        });

        if (deployLog) {
          const decoded = decodeEventLog({
            abi: TREASURY_FACTORY_ABI,
            data: deployLog.data,
            topics: deployLog.topics,
          }) as { eventName: string; args: { treasury: `0x${string}` } };
          if (decoded.eventName === "TreasuryDeployed") {
            setDeployedAddress(decoded.args.treasury);
            toast.success("Treasury deployed successfully!");
          }
        }
      } catch (err) {
        console.error("Failed to decode deploy event:", err);
      }
    }
  }, [isSuccess, receipt]);

  const createTreasury = ({
    maxSpendPerPeriod,
    periodSeconds,
    whitelist,
    expiryTimestamp,
    migrationTarget,
    tokenDecimals = 18,
  }: CreateTreasuryParams) => {
    const maxSpendBigInt = parseUnits(maxSpendPerPeriod, tokenDecimals);
    
    writeContract({
      address: CONTRACT_ADDRESSES.TREASURY_FACTORY,
      abi: TREASURY_FACTORY_ABI,
      functionName: "createTreasury",
      args: [{
        maxSpendPerPeriod: maxSpendBigInt,
        periodSeconds: BigInt(periodSeconds),
        whitelist,
        expiryTimestamp: BigInt(expiryTimestamp),
        migrationTarget,
      }],
    } as any);
  };

  const resetFactory = () => {
    reset();
    setDeployedAddress(null);
  };

  return {
    createTreasury,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    hash,
    deployedAddress,
    reset: resetFactory,
  };
}
