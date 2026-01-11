import { useState, useEffect } from "react";
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
  periodSeconds?: number;
  tokenDecimals?: number;
  onSpendSuccess?: () => void;
}

export function SpendForm({ 
  treasuryAddress, 
  remainingAllowance,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate recipient
    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Please enter a valid Ethereum address");
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount greater than 0");
      return;
    }

    if (amountNum > parseFloat(remainingAllowance)) {
      const limitType = periodSeconds === 0 ? "per-call limit" : "period allowance";
      setError(`Amount exceeds remaining ${limitType} (${remainingAllowance})`);
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
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                MNEE
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {periodSeconds === 0 ? "Per-call limit" : "Remaining allowance"}: {parseFloat(remainingAllowance).toLocaleString()} MNEE
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isPending || isCheckingWhitelist}>
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
