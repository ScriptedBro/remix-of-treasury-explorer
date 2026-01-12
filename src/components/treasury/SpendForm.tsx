import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Send, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { parseUnits } from "viem";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from "wagmi";
import { POLICY_TREASURY_ABI } from "@/lib/contracts/abis";
import { useRecordTransaction, useTreasuryByAddress } from "@/hooks/useTreasuryDB";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SpendFormProps {
  treasuryAddress: `0x${string}`;
  remainingAllowance: string;
  treasuryBalance: string;
  periodSeconds?: number;
  tokenDecimals?: number;
  onSpendSuccess?: () => void;
}

export function SpendForm({ 
  treasuryAddress, 
  remainingAllowance,
  treasuryBalance,
  periodSeconds = 0,
  tokenDecimals = 18,
  onSpendSuccess,
}: SpendFormProps) {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amountValidationError = useMemo(() => {
    if (!amount) return null;
    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return "Please enter a valid amount greater than 0";

    const balanceNum = parseFloat(treasuryBalance);
    if (Number.isFinite(balanceNum) && amountNum > balanceNum) {
      return "Insufficient balance in treasury";
    }

    const allowanceNum = parseFloat(remainingAllowance);
    if (Number.isFinite(allowanceNum) && amountNum > allowanceNum) {
      const limitType = periodSeconds === 0 ? "per-call limit" : "period allowance";
      return `Amount exceeds remaining ${limitType} (${remainingAllowance})`;
    }

    return null;
  }, [amount, periodSeconds, remainingAllowance, treasuryBalance]);

  const { data: treasuryDB } = useTreasuryByAddress(treasuryAddress);
  const recordTransaction = useRecordTransaction();

  // Check if recipient is whitelisted
  const { data: isWhitelisted, isLoading: isCheckingWhitelist } = useReadContract({
    address: treasuryAddress,
    abi: POLICY_TREASURY_ABI,
    functionName: "isWhitelisted",
    args: [recipient as `0x${string}`],
    query: {
      enabled: recipient.length === 42 && recipient.startsWith("0x"),
    },
  });

  const {
    writeContract,
    data: spendHash,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: spendHash,
  });

  // Handle successful spend
  useEffect(() => {
    const recordSpendTransaction = async () => {
      if (!isConfirmed || !spendHash || !treasuryDB || !userAddress || !publicClient) return;

      try {
        const receipt = await publicClient.getTransactionReceipt({ hash: spendHash });
        const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });

        await recordTransaction.mutateAsync({
          treasury_id: treasuryDB.id,
          tx_hash: spendHash,
          event_type: "spend",
          from_address: treasuryAddress,
          to_address: recipient,
          amount: parseUnits(amount, tokenDecimals).toString(),
          block_number: Number(receipt.blockNumber),
          block_timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
        });

        queryClient.invalidateQueries({ queryKey: ["treasury-batch-data"] });

        toast.success(`Successfully sent ${amount} MNEE!`);
      } catch (err) {
        console.error("Failed to record spend transaction:", err);
        toast.success(`Successfully sent ${amount} MNEE!`);
      }

      setAmount("");
      setRecipient("");
      resetWrite();
      onSpendSuccess?.();
    };

    recordSpendTransaction();
  }, [isConfirmed, spendHash, treasuryDB, userAddress, amount, recipient, publicClient, treasuryAddress, recordTransaction, queryClient, resetWrite, onSpendSuccess, tokenDecimals]);

  const isPending = isWritePending || isConfirming;
  const isSubmitDisabled = isPending || isCheckingWhitelist || Boolean(amountValidationError);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate recipient
    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Please enter a valid Ethereum address");
      return;
    }

    if (amountValidationError) {
      setError(amountValidationError);
      return;
    }

    // Wait for whitelist check to complete if query is enabled
    if (recipient.length === 42 && recipient.startsWith("0x")) {
      if (isCheckingWhitelist) {
        setError("Checking whitelist status...");
        return;
      }
      if (isWhitelisted === false) {
        setError("Recipient is not whitelisted");
        return;
      }
    }

    try {
      const amountBigInt = parseUnits(amount, tokenDecimals);
      writeContract({
        address: treasuryAddress,
        abi: POLICY_TREASURY_ABI,
        functionName: "spend",
        args: [recipient as `0x${string}`, amountBigInt],
      } as any);
    } catch (err) {
      setError("Invalid amount format");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Spend Tokens
        </CardTitle>
        <CardDescription>
          Send tokens to a whitelisted recipient
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Treasury Balance</p>
            <p className="text-sm font-medium">
              {parseFloat(treasuryBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} MNEE
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="font-mono"
            />
            {recipient.length === 42 && (
              <p className={`text-xs ${
                isCheckingWhitelist 
                  ? "text-muted-foreground" 
                  : isWhitelisted 
                  ? "text-green-600" 
                  : "text-destructive"
              }`}>
                {isCheckingWhitelist 
                  ? "Checking..." 
                  : isWhitelisted 
                  ? "✓ Whitelisted" 
                  : "✗ Not whitelisted"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                MNEE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {periodSeconds === 0 ? "Per-call limit" : "Remaining allowance"}: {parseFloat(remainingAllowance).toLocaleString()} MNEE
            </p>

            {amountValidationError && (
              <p className="text-sm text-destructive">{amountValidationError}</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isConfirming ? "Confirming..." : "Processing..."}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Tokens
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
