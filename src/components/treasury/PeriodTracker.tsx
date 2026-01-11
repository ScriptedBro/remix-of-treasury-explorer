import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Wallet, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface PeriodTrackerProps {
  periodSeconds: number;
  maxSpendPerPeriod: string;
  spentThisPeriod: string;
  remainingAllowance: string;
  periodProgress: number;
}

export function PeriodTracker({
  periodSeconds,
  maxSpendPerPeriod,
  spentThisPeriod,
  remainingAllowance,
  periodProgress,
}: PeriodTrackerProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (periodSeconds === 0) return;

    const calculateTimeRemaining = () => {
      const now = Math.floor(Date.now() / 1000);
      const currentPeriodStart = Math.floor(now / periodSeconds) * periodSeconds;
      const nextPeriodStart = currentPeriodStart + periodSeconds;
      const secondsRemaining = nextPeriodStart - now;

      const hours = Math.floor(secondsRemaining / 3600);
      const minutes = Math.floor((secondsRemaining % 3600) / 60);
      const seconds = secondsRemaining % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    };

    setTimeRemaining(calculateTimeRemaining());
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [periodSeconds]);

  const periodLabel = periodSeconds === 0
    ? "No period (per-call limit)"
    : periodSeconds < 3600
    ? `${periodSeconds / 60} minute period`
    : periodSeconds < 86400
    ? `${periodSeconds / 3600} hour period`
    : `${periodSeconds / 86400} day period`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Spending Period
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Period Info */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{periodLabel}</span>
          {periodSeconds > 0 && (
            <span className="text-sm font-medium text-primary">
              Resets in {timeRemaining}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {periodSeconds === 0 ? (
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded-full flex items-center justify-center">
              <span className="text-xs text-muted-foreground">N/A (per-call limit)</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>No period tracking</span>
              <span>Per-call limit applies</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Progress value={periodProgress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{periodProgress.toFixed(1)}% used</span>
              <span>{(100 - periodProgress).toFixed(1)}% remaining</span>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1 text-center p-3 bg-muted/50 rounded-lg">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {periodSeconds === 0 ? "Max/Call" : "Max/Period"}
            </p>
            <p className="text-sm font-semibold">
              {parseFloat(maxSpendPerPeriod).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1 text-center p-3 bg-muted/50 rounded-lg">
            <Wallet className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {periodSeconds === 0 ? "N/A" : "Spent"}
            </p>
            <p className="text-sm font-semibold">
              {periodSeconds === 0 ? "—" : parseFloat(spentThisPeriod).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1 text-center p-3 bg-primary/10 rounded-lg">
            <Wallet className="h-4 w-4 mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">
              {periodSeconds === 0 ? "Per-Call Limit" : "Available"}
            </p>
            <p className="text-sm font-semibold text-primary">
              {parseFloat(remainingAllowance).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
