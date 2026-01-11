import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Wallet, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WithdrawAllPanelProps {
  balance: string;
  onWithdrawAll: (to: `0x${string}`) => void;
  isPending: boolean;
}

export function WithdrawAllPanel({
  balance,
  onWithdrawAll,
  isPending,
}: WithdrawAllPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleWithdraw = () => {
    setError(null);

    // Validate recipient
    if (!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Please enter a valid Ethereum address");
      return;
    }

    onWithdrawAll(recipient as `0x${string}`);
    setIsOpen(false);
    setRecipient("");
  };

  return (
    <Card className="border-red-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <Wallet className="h-5 w-5" />
          Withdraw All Funds
        </CardTitle>
        <CardDescription>
          This treasury has expired. Withdraw all funds to any address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This treasury has expired. You can withdraw all remaining funds to any address.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg bg-muted p-4 space-y-2">
          <p className="text-sm text-muted-foreground">Available Balance</p>
          <p className="text-2xl font-semibold">
            {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} MNEE
          </p>
        </div>

        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full border-red-500/50 text-red-600 hover:bg-red-500/10"
              disabled={isPending || parseFloat(balance) <= 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Withdrawing...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Withdraw All Funds
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Withdraw All Funds</AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  This will transfer <strong>{parseFloat(balance).toLocaleString()} MNEE</strong> to the address you specify.
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="withdraw-recipient">Recipient Address</Label>
                  <Input
                    id="withdraw-recipient"
                    placeholder="0x..."
                    value={recipient}
                    onChange={(e) => {
                      setRecipient(e.target.value);
                      setError(null);
                    }}
                    className="font-mono"
                  />
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </div>

                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This action cannot be undone. Make sure the recipient address is correct.
                  </AlertDescription>
                </Alert>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setRecipient("");
                setError(null);
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleWithdraw}
                disabled={!recipient || !recipient.match(/^0x[a-fA-F0-9]{40}$/) || isPending}
              >
                Confirm Withdrawal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
