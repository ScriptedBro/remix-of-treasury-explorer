import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { usePublicClient } from "wagmi";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Layout } from "@/components/layout/Layout";
import { TreasuryCard } from "@/components/treasury/TreasuryCard";
import { useTreasuries, useAllTransactions } from "@/hooks/useTreasuryDB";
import { useTreasuryBatchData } from "@/hooks/useTreasuryBatchData";
import { useReconcileTreasuries } from "@/hooks/useReconcileTreasuries";
import { getTreasuryStatus, type TreasuryStatus } from "@/lib/treasury-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Vault, TrendingUp, Clock, Wallet, CheckCircle2, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_FILTERS = [
  { value: 'all', label: 'All', icon: Vault },
  { value: 'active', label: 'Active', icon: CheckCircle2 },
  { value: 'unfunded', label: 'Unfunded', icon: Wallet },
  { value: 'exhausted', label: 'Exhausted', icon: AlertTriangle },
  { value: 'expired', label: 'Expired', icon: Clock },
  { value: 'migrated', label: 'Migrated', icon: ArrowRightLeft },
] as const;

interface DashboardStatsProps {
  treasuryCount: number;
  activeCount: number;
  totalBalance: string;
}

function DashboardStats({ treasuryCount, activeCount, totalBalance }: DashboardStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Treasuries</CardTitle>
          <Vault className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{treasuryCount}</div>
          <p className="text-xs text-muted-foreground">Treasuries under your control</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {parseFloat(totalBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} MNEE
          </div>
          <p className="text-xs text-muted-foreground">Combined treasury balances</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Treasuries</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeCount}</div>
          <p className="text-xs text-muted-foreground">Funded and ready for spending</p>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Vault className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="mb-2">No Treasuries Yet</CardTitle>
        <CardDescription className="max-w-sm mb-6">
          Deploy your first PolicyTreasury to start managing funds with immutable on-chain spending rules.
        </CardDescription>
        <Link to="/deploy">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Deploy Treasury
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ConnectWalletPrompt() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Wallet className="h-8 w-8 text-muted-foreground" />
        </div>
        <CardTitle className="mb-2">Connect Your Wallet</CardTitle>
        <CardDescription className="max-w-sm mb-6">
          Connect your wallet to view and manage your PolicyTreasury contracts.
        </CardDescription>
        <ConnectButton />
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [chainNow, setChainNow] = useState<number | null>(null);
  const reconcileTreasuries = useReconcileTreasuries();
  const lastReconciledKeyRef = useRef<string | null>(null);
  const { data: treasuries, isLoading } = useTreasuries(address);
  const { data: batchData, isLoading: isBatchLoading } = useTreasuryBatchData(treasuries);
  const { data: allTransactions } = useAllTransactions(address);
  
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (!isConnected || !address) return;
    if (reconcileTreasuries.isPending) return;

    const key = `${address.toLowerCase()}:${chainId}`;
    if (lastReconciledKeyRef.current === key) return;
    lastReconciledKeyRef.current = key;

    reconcileTreasuries.mutate({ ownerAddress: address, chainId });
  }, [address, chainId, isConnected, reconcileTreasuries]);

  useEffect(() => {
    let cancelled = false;

    const fetchChainTime = async () => {
      if (!publicClient) return;
      try {
        const block = await publicClient.getBlock();
        if (cancelled) return;
        setChainNow(Number(block.timestamp));
      } catch {
        // ignore; fallback to local time inside getTreasuryStatus
      }
    };

    fetchChainTime();
    const id = setInterval(fetchChainTime, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [publicClient]);

  // Calculate status for each treasury and aggregate stats
  const { treasuriesWithStatus, statusCounts, totalBalance, activeCount } = useMemo(() => {
    if (!treasuries) {
      return { 
        treasuriesWithStatus: [], 
        statusCounts: {} as Record<string, number>,
        totalBalance: "0",
        activeCount: 0
      };
    }

    // Build a set of treasury IDs that have transactions
    const treasuryTransactionMap = new Map<string, { hasTransactions: boolean; hasMigration: boolean }>();
    
    if (allTransactions) {
      allTransactions.forEach((tx) => {
        const existing = treasuryTransactionMap.get(tx.treasury_id) || { hasTransactions: false, hasMigration: false };
        existing.hasTransactions = true;
        if (tx.event_type === 'migrate') {
          existing.hasMigration = true;
        }
        treasuryTransactionMap.set(tx.treasury_id, existing);
      });
    }

    let totalBalanceNum = 0;
    let activeNum = 0;
    const counts: Record<string, number> = {
      all: 0,
      active: 0,
      unfunded: 0,
      exhausted: 0,
      expired: 0,
      migrated: 0,
    };

    const withStatus = treasuries.map((treasury) => {
      const onChainData = batchData.get(treasury.address.toLowerCase());
      const txInfo = treasuryTransactionMap.get(treasury.id) || { hasTransactions: false, hasMigration: false };
      
      const balanceRaw = onChainData?.balanceRaw ?? 0n;
      const balance = onChainData?.balance ?? "0";
      
      totalBalanceNum += parseFloat(balance);

      const status = getTreasuryStatus({
        balance: balanceRaw,
        expiryTimestamp: treasury.expiry_timestamp || 0,
        hasTransactions: txInfo.hasTransactions,
        hasMigration: txInfo.hasMigration,
        now: chainNow ?? undefined,
      });

      counts.all++;
      counts[status]++;
      
      if (status === 'active') {
        activeNum++;
      }

      return {
        treasury,
        balance,
        spentThisPeriod: onChainData?.spentThisPeriod ?? "0",
        periodProgress: onChainData?.periodProgress ?? 0,
        status,
      };
    });

    return {
      treasuriesWithStatus: withStatus,
      statusCounts: counts,
      totalBalance: totalBalanceNum.toString(),
      activeCount: activeNum,
    };
  }, [treasuries, batchData, allTransactions, chainNow]);

  // Filter treasuries by status
  const filteredTreasuries = useMemo(() => {
    if (statusFilter === 'all') {
      return treasuriesWithStatus;
    }
    return treasuriesWithStatus.filter((t) => t.status === statusFilter);
  }, [treasuriesWithStatus, statusFilter]);

  const isDataLoading = isLoading || isBatchLoading;

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your PolicyTreasury contracts
            </p>
          </div>
          {isConnected && (
            <Link to="/deploy">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Deploy Treasury
              </Button>
            </Link>
          )}
        </div>

        {!isConnected ? (
          <ConnectWalletPrompt />
        ) : (
          <>
            {/* Stats */}
            <DashboardStats 
              treasuryCount={treasuries?.length || 0} 
              activeCount={activeCount}
              totalBalance={totalBalance}
            />

            {/* Treasury List */}
            <div className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Your Treasuries</h2>
                
                {/* Status Filter */}
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList className="h-auto flex-wrap">
                    {STATUS_FILTERS.map((filter) => (
                      <TabsTrigger 
                        key={filter.value} 
                        value={filter.value}
                        className="text-xs"
                      >
                        {filter.label}
                        {statusCounts[filter.value] > 0 && (
                          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                            {statusCounts[filter.value]}
                          </span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              
              {isDataLoading ? (
                <LoadingSkeleton />
              ) : filteredTreasuries.length === 0 ? (
                statusFilter === 'all' ? (
                  <EmptyState />
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">
                        No {statusFilter} treasuries found.
                      </p>
                    </CardContent>
                  </Card>
                )
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTreasuries.map(({ treasury, balance, spentThisPeriod, periodProgress, status }) => (
                    <TreasuryCard
                      key={treasury.id}
                      treasury={treasury}
                      balance={balance}
                      spentThisPeriod={spentThisPeriod}
                      periodProgress={periodProgress}
                      status={status}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
