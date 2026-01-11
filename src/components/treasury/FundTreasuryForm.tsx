import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { MNEE_TOKEN_ADDRESS } from "@/lib/contracts/config";
import { TreasuryStatus } from "@/lib/treasury-status";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface FundTreasuryFormProps {
  treasuryAddress: `0x${string}`;
  treasuryName?: string;
  currentBalance: string;
  status: TreasuryStatus;
  onFundingComplete?: () => void;
}

export function FundTreasuryForm({ 
  treasuryAddress, 
  treasuryName,
  currentBalance,
  status,
  onFundingComplete 
}: FundTreasuryFormProps) {
  const { address: userAddress } = useAccount();
  const [amount, setAmount] = useState("");
  
  // Get user's MNEE balance
  const { data: userBalance, refetch: refetchBalance } = useReadContract({
    address: MNEE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
  });

  // Transfer function
  const { 
    writeContract: transfer, 
    data: transferHash,
    isPending: isTransferPending,
    error: transferError,
    reset: resetTransfer
  } = useWriteContract();

  // Wait for confirmation
  const { 
    isLoading: isConfirming, 
    isSuccess: isConfirmed 
  } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  // Handle successful funding
  useEffect(() => {
    if (isConfirmed) {
      toast.success(`Successfully funded treasury with ${amount} MNEE!`);
      setAmount("");
      refetchBalance();
      resetTransfer();
      onFundingComplete?.();
    }
  }, [isConfirmed, amount, refetchBalance, resetTransfer, onFundingComplete]);

  const formattedUserBalance = userBalance 
    ? formatUnits(userBalance, 18) 
    : "0";
  
  const numericUserBalance = parseFloat(formattedUserBalance);
  const numericAmount = parseFloat(amount) || 0;
  const hasInsufficientBalance = numericAmount > numericUserBalance;
  const isValidAmount = numericAmount > 0 && !hasInsufficientBalance;
  const isPending = isTransferPending || isConfirming;

  const handleFund = () => {
    if (!amount || !userAddress) return;
    
    const amountBigInt = parseUnits(amount, 18);
    
    transfer({
      address: MNEE_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [treasuryAddress, amountBigInt],
    } as any);
  };

  const handleMaxClick = () => {
    setAmount(formattedUserBalance);
  };

  const isExpired = status === 'expired';
  const isMigrated = status === 'migrated';
  const showWarning = isExpired || isMigrated;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Fund Treasury
        </CardTitle>
        <CardDescription>
          Transfer MNEE tokens to this treasury to enable spending
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Box */}
        <Alert className="border-blue-500/20 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm text-muted-foreground">
            Policies can exist without funds. Funding is optional and can happen at any time.
          </AlertDescription>
        </Alert>

        {/* Warning for expired/migrated */}
        {showWarning && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {isExpired 
                ? "This treasury has expired. Funding it now will not allow spending, but migration may still be possible."
                : "This treasury has been migrated. Any funds sent here may not be recoverable."}
            </AlertDescription>
          </Alert>
        )}

        {/* Current Balance Display */}
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Treasury Balance</span>
            <span className="text-lg font-semibold">
              {parseFloat(currentBalance).toLocaleString()} MNEE
            </span>
          </div>
        </div>

        {/* User Balance */}
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Your MNEE Balance</span>
          <span className={numericUserBalance === 0 ? "text-amber-500" : ""}>
            {numericUserBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} MNEE
          </span>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount to Fund</Label>
          <div className="flex gap-2">
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPending}
              min="0"
              step="any"
            />
            <Button 
              variant="outline" 
              onClick={handleMaxClick}
              disabled={isPending || numericUserBalance === 0}
            >
              Max
            </Button>
          </div>
          {hasInsufficientBalance && (
            <p className="text-sm text-destructive">
              Insufficient balance. You only have {numericUserBalance.toLocaleString()} MNEE.
            </p>
          )}
        </div>

        {/* Error Display */}
        {transferError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {transferError.message.includes("User rejected")
                ? "Transaction was rejected"
                : "Failed to transfer. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {/* Fund Button */}
        <Button 
          onClick={handleFund} 
          disabled={!isValidAmount || isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isConfirming ? "Confirming..." : "Transferring..."}
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Fund Treasury
            </>
          )}
        </Button>

        {/* Zero balance helper */}
        {numericUserBalance === 0 && (
          <p className="text-xs text-center text-muted-foreground">
            You don't have any MNEE tokens. Acquire some to fund this treasury.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
