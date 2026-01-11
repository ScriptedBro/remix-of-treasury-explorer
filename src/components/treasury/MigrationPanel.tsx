import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { ArrowRightLeft, Loader2, ExternalLink } from "lucide-react";

interface MigrationPanelProps {
  migrationTarget: string;
  remainingAllowance: string;
  balance: string;
  isExpired?: boolean;
  onMigrate: () => void;
  isPending: boolean;
}

export function MigrationPanel({
  migrationTarget,
  remainingAllowance,
  balance,
  isExpired = false,
  onMigrate,
  isPending,
}: MigrationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  // When expired, allow full balance migration (bypass period limits)
  const migrateAmount = isExpired 
    ? parseFloat(balance)
    : Math.min(parseFloat(remainingAllowance), parseFloat(balance));

  const handleMigrate = () => {
    onMigrate();
    setIsOpen(false);
  };

  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600">
          <ArrowRightLeft className="h-5 w-5" />
          Migration
        </CardTitle>
        <CardDescription>
          {isExpired 
            ? "Transfer all funds to the pre-approved migration target (expired treasury)"
            : "Transfer funds to the pre-approved migration target"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 space-y-2">
          <p className="text-sm text-muted-foreground">Migration Target</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono">
              {migrationTarget.slice(0, 10)}...{migrationTarget.slice(-8)}
            </code>
            <a
              href={`https://etherscan.io/address/${migrationTarget}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount to migrate</span>
          <span className="font-semibold">
            {migrateAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} MNEE
          </span>
        </div>

        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              disabled={isPending || migrateAmount <= 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Migrate Funds
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Migration</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  This will transfer <strong>{migrateAmount.toLocaleString()} MNEE</strong> to the migration target:
                </p>
                <code className="block text-xs p-2 bg-muted rounded">
                  {migrationTarget}
                </code>
                {isExpired ? (
                  <p className="text-amber-600">
                    This treasury has expired. All funds will be transferred (period limits bypassed).
                  </p>
                ) : (
                  <p className="text-amber-600">
                    This action follows the same spending rules and period limits.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleMigrate}>
                Confirm Migration
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
