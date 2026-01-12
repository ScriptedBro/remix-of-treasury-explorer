import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpRight, ArrowRightLeft, ArrowDownRight, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import type { TreasuryTransaction } from "@/hooks/useTreasuryDB";
import { formatUnits } from "viem";

interface TransactionListProps {
  transactions: TreasuryTransaction[];
  isLoading?: boolean;
}

const eventIcons = {
  spend: ArrowUpRight,
  migration: ArrowRightLeft,
  fund: ArrowDownRight,
  withdraw: ArrowDownRight,
};

const eventColors = {
  spend: "text-orange-500",
  migration: "text-amber-500",
  fund: "text-green-500",
  withdraw: "text-red-500",
};

function formatMneeAmount(amount: unknown) {
  try {
    return formatUnits(BigInt(String(amount || "0")), 18);
  } catch {
    return "0";
  }
}

export function TransactionList({ transactions, isLoading }: TransactionListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} recorded
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transactions yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {transactions.map((tx) => {
                const eventType = tx.event_type === "deposit" ? "fund" : tx.event_type;
                const Icon = eventIcons[eventType as keyof typeof eventIcons] || ArrowUpRight;
                const colorClass = eventColors[eventType as keyof typeof eventColors] || "text-muted-foreground";

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-background ${colorClass}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {eventType}
                          </Badge>
                          <span className="text-sm font-medium">
                            {parseFloat(formatMneeAmount(tx.amount)).toLocaleString()} MNEE
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>To: {tx.to_address.slice(0, 8)}...{tx.to_address.slice(-6)}</span>
                          <span>•</span>
                          <span>{format(new Date(tx.block_timestamp), "MMM d, h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://etherscan.io/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary p-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
