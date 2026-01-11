import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Wallet, Clock, ArrowRight, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { Treasury } from "@/hooks/useTreasuryDB";
import { StatusBadge } from "./StatusBadge";
import { type TreasuryStatus } from "@/lib/treasury-status";

interface TreasuryCardProps {
  treasury: Treasury;
  balance?: string;
  spentThisPeriod?: string;
  periodProgress?: number;
  status?: TreasuryStatus;
}

export function TreasuryCard({ 
  treasury, 
  balance = "0", 
  spentThisPeriod = "0",
  periodProgress = 0,
  status = 'unfunded'
}: TreasuryCardProps) {
  const expiryDate = treasury.expiry_timestamp
    ? new Date(treasury.expiry_timestamp * 1000)
    : null;

  const periodLabel = treasury.period_seconds === 0
    ? "No period limit"
    : treasury.period_seconds < 3600
    ? `${treasury.period_seconds / 60} min period`
    : treasury.period_seconds < 86400
    ? `${treasury.period_seconds / 3600}h period`
    : `${treasury.period_seconds / 86400}d period`;

  const isUnfunded = status === 'unfunded';
  const isExpired = status === 'expired';
  const isExhausted = status === 'exhausted';

  return (
    <Link to={`/treasury/${treasury.address}`}>
      <Card className="group hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors">
                {treasury.name || `Treasury ${treasury.address.slice(0, 8)}...`}
              </CardTitle>
              <p className="text-xs text-muted-foreground font-mono">
                {treasury.address.slice(0, 10)}...{treasury.address.slice(-8)}
              </p>
            </div>
            <StatusBadge status={status} size="sm" />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Balance */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-xl font-semibold">
                {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} MNEE
              </p>
            </div>
          </div>

          {/* CTA for unfunded treasuries */}
          {isUnfunded && (
            <Button variant="outline" size="sm" className="w-full" asChild>
              <span>
                <Plus className="mr-2 h-4 w-4" />
                Add Funds to Activate
              </span>
            </Button>
          )}

          {/* Exhausted warning */}
          {isExhausted && (
            <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md p-2 text-center">
              Balance depleted - add funds to continue spending
            </div>
          )}

          {/* Period Progress - only show if not unfunded */}
          {!isUnfunded && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{periodLabel}</span>
                {treasury.period_seconds === 0 ? (
                  <span className="font-medium text-muted-foreground">Per-call limit</span>
                ) : (
                  <span className="font-medium">
                    {parseFloat(spentThisPeriod).toLocaleString()} / {parseFloat(treasury.max_spend_per_period).toLocaleString()}
                  </span>
                )}
              </div>
              {treasury.period_seconds === 0 ? (
                <div className="h-2 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">N/A</span>
                </div>
              ) : (
                <Progress value={periodProgress >= 0 ? periodProgress : 0} className="h-2" />
              )}
            </div>
          )}

          {/* Expiry */}
          {expiryDate && !isExpired && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Expires {formatDistanceToNow(expiryDate, { addSuffix: true })}</span>
            </div>
          )}

          {/* Arrow indicator */}
          <div className="flex justify-end pt-2">
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
