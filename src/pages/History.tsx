import { useAccount } from "wagmi";
import { Layout } from "@/components/layout/Layout";
import { useAllTransactions } from "@/hooks/useTreasuryDB";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowUpRight, 
  ArrowRightLeft, 
  ArrowDownRight, 
  ExternalLink, 
  Search,
  Download,
  History as HistoryIcon,
  Wallet
} from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ConnectButton } from "@/components/wallet/ConnectButton";

const eventIcons = {
  spend: ArrowUpRight,
  migration: ArrowRightLeft,
  fund: ArrowDownRight,
};

const eventColors = {
  spend: "text-orange-500 bg-orange-500/10",
  migration: "text-amber-500 bg-amber-500/10",
  fund: "text-green-500 bg-green-500/10",
};

export default function History() {
  const { address, isConnected } = useAccount();
  const { data: transactions, isLoading } = useAllTransactions(address);
  
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    return transactions.filter((tx) => {
      const normalizedEventType = tx.event_type === "deposit" ? "fund" : tx.event_type;
      const matchesSearch = 
        tx.tx_hash.toLowerCase().includes(search.toLowerCase()) ||
        tx.to_address.toLowerCase().includes(search.toLowerCase()) ||
        tx.from_address.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = typeFilter === "all" || normalizedEventType === typeFilter;
      
      return matchesSearch && matchesType;
    });
  }, [transactions, search, typeFilter]);

  const exportToCSV = () => {
    if (!filteredTransactions.length) return;
    
    const headers = ["Date", "Type", "Amount", "To", "From", "Tx Hash", "Treasury"];
    const rows = filteredTransactions.map((tx) => [
      format(new Date(tx.block_timestamp), "yyyy-MM-dd HH:mm:ss"),
      tx.event_type,
      tx.amount,
      tx.to_address,
      tx.from_address,
      tx.tx_hash,
      (tx as any).treasuries?.address || "",
    ]);
    
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `treasury-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isConnected) {
    return (
      <Layout>
        <Card className="max-w-md mx-auto">
          <CardContent className="py-16 text-center">
            <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">Connect Your Wallet</CardTitle>
            <CardDescription className="mb-6">
              Connect your wallet to view transaction history
            </CardDescription>
            <ConnectButton />
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transaction History</h1>
            <p className="text-muted-foreground">
              View all transactions across your treasuries
            </p>
          </div>
          <Button variant="outline" onClick={exportToCSV} disabled={!filteredTransactions.length}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by address or tx hash..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="spend">Spend</SelectItem>
                  <SelectItem value="migration">Migration</SelectItem>
                  <SelectItem value="fund">Fund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Transaction List */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              {isLoading 
                ? "Loading transactions..." 
                : `${filteredTransactions.length} transaction${filteredTransactions.length !== 1 ? "s" : ""}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="rounded-full bg-muted p-4 w-fit mx-auto mb-4">
                  <HistoryIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium mb-2">No Transactions Found</p>
                <p className="text-muted-foreground">
                  {search || typeFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Your transaction history will appear here"}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {filteredTransactions.map((tx) => {
                    const eventType = tx.event_type === "deposit" ? "fund" : tx.event_type;
                    const Icon = eventIcons[eventType as keyof typeof eventIcons] || ArrowUpRight;
                    const colorClass = eventColors[eventType as keyof typeof eventColors] || "text-muted-foreground bg-muted";
                    const treasury = (tx as any).treasuries;

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${colorClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="capitalize">
                                {eventType}
                              </Badge>
                              <span className="font-semibold">
                                {parseFloat(tx.amount).toLocaleString()} MNEE
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span>To: {tx.to_address.slice(0, 8)}...{tx.to_address.slice(-6)}</span>
                              <span>•</span>
                              <span>{format(new Date(tx.block_timestamp), "MMM d, yyyy h:mm a")}</span>
                              {treasury && (
                                <>
                                  <span>•</span>
                                  <Link
                                    to={`/treasury/${treasury.address}`}
                                    className="text-primary hover:underline"
                                  >
                                    {treasury.name || treasury.address.slice(0, 8) + "..."}
                                  </Link>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <a
                          href={`https://etherscan.io/tx/${tx.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-background transition-colors"
                        >
                          <ExternalLink className="h-5 w-5" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
