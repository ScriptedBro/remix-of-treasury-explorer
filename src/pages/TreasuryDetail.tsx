import { useParams, Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { Layout } from "@/components/layout/Layout";
import { TreasuryDetails } from "@/components/treasury/TreasuryDetails";
import { PeriodTracker } from "@/components/treasury/PeriodTracker";
import { SpendForm } from "@/components/treasury/SpendForm";
import { MigrationPanel } from "@/components/treasury/MigrationPanel";
import { WithdrawAllPanel } from "@/components/treasury/WithdrawAllPanel";
import { WhitelistViewer } from "@/components/treasury/WhitelistViewer";
import { TransactionList } from "@/components/treasury/TransactionList";
import { FundTreasuryForm } from "@/components/treasury/FundTreasuryForm";
import { StatusBadge } from "@/components/treasury/StatusBadge";
import { useTreasury } from "@/hooks/useTreasury";
import { 
  useTreasuryByAddress, 
  useTreasuryWhitelist, 
  useTreasuryTransactions,
  useTreasuryHasTransactions,
  useTreasuryHasMigration
} from "@/hooks/useTreasuryDB";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, AlertCircle, Wallet, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConnectButton } from "@/components/wallet/ConnectButton";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export default function TreasuryDetail() {
  const { address: treasuryAddress } = useParams<{ address: string }>();
  const { address: userAddress, isConnected } = useAccount();

  const { data: treasuryDB, isLoading: isLoadingDB } = useTreasuryByAddress(treasuryAddress);
  const { data: whitelist } = useTreasuryWhitelist(treasuryDB?.id);
  const { data: transactions, isLoading: isLoadingTx, refetch: refetchTransactions } = useTreasuryTransactions(treasuryDB?.id);
  
  // Get transaction status for status calculation
  const { data: hasTransactions = false } = useTreasuryHasTransactions(treasuryDB?.id);
  const { data: hasMigration = false } = useTreasuryHasMigration(treasuryDB?.id);

  const {
    balance,
    owner,
    token,
    maxSpendPerPeriod,
    periodSeconds,
    expiryTimestamp,
    migrationTarget,
    spentThisPeriod,
    remainingAllowance,
    periodProgress,
    status,
    spend,
    migrate,
    withdrawAll,
    isSpendPending,
    isMigratePending,
    isWithdrawAllPending,
    refetchBalance,
  } = useTreasury({
    address: treasuryAddress as `0x${string}`,
    hasTransactions,
    hasMigration,
  });

  const isOwner = userAddress?.toLowerCase() === owner?.toLowerCase();
  const isExpired = status === 'expired';
  const isUnfunded = status === 'unfunded';
  const isMigrated = status === 'migrated';

  const handleFundingComplete = () => {
    refetchBalance();
    refetchTransactions();
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
              Connect your wallet to view treasury details
            </CardDescription>
            <ConnectButton />
          </CardContent>
        </Card>
      </Layout>
    );
  }

  if (isLoadingDB) {
    return (
      <Layout>
        <LoadingSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {treasuryDB?.name || "Treasury"}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {treasuryAddress}
            </p>
          </div>
        </div>

        {/* Owner Alert */}
        {!isOwner && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You are viewing this treasury as a guest. Only the owner can execute spend transactions.
            </AlertDescription>
          </Alert>
        )}

        {/* Unfunded CTA */}
        {isUnfunded && (
          <Alert className="border-blue-500/20 bg-blue-500/5">
            <Wallet className="h-4 w-4 text-blue-500" />
            <AlertDescription className="flex items-center justify-between">
              <span>This treasury has no funds yet. Add MNEE to start using it.</span>
              <Button variant="outline" size="sm" className="ml-4" asChild>
                <Link to="#fund">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Funds
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Expired Alert */}
        {isExpired && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This treasury has expired and no longer accepts spending transactions.
            </AlertDescription>
          </Alert>
        )}

        {/* Migrated Alert */}
        {isMigrated && (
          <Alert className="border-blue-500/20 bg-blue-500/5">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription>
              This treasury has been migrated. Funds have been moved to the migration target.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="fund">Fund</TabsTrigger>
            <TabsTrigger value="spend">Spend</TabsTrigger>
            <TabsTrigger value="whitelist">Whitelist</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Treasury Details */}
              <TreasuryDetails
                address={treasuryAddress || ""}
                owner={owner || ""}
                token={token || ""}
                maxSpendPerPeriod={maxSpendPerPeriod}
                periodSeconds={periodSeconds}
                expiryTimestamp={expiryTimestamp}
                migrationTarget={migrationTarget || ""}
                balance={balance}
                name={treasuryDB?.name || undefined}
              />

              {/* Period Tracker */}
              <div className="space-y-6">
                <PeriodTracker
                  periodSeconds={periodSeconds}
                  maxSpendPerPeriod={maxSpendPerPeriod}
                  spentThisPeriod={spentThisPeriod}
                  remainingAllowance={remainingAllowance}
                  periodProgress={periodProgress}
                />

                {/* Migration Panel - Show when not expired */}
                {isOwner && migrationTarget && !isExpired && (
                  <MigrationPanel
                    migrationTarget={migrationTarget}
                    remainingAllowance={remainingAllowance}
                    balance={balance}
                    isExpired={false}
                    onMigrate={migrate}
                    isPending={isMigratePending}
                  />
                )}

                {/* Withdraw All Panel - Show when expired */}
                {isOwner && isExpired && (
                  <WithdrawAllPanel
                    balance={balance}
                    onWithdrawAll={withdrawAll}
                    isPending={isWithdrawAllPending}
                  />
                )}

                {/* Migration Panel for expired - allows full balance migration */}
                {isOwner && migrationTarget && isExpired && (
                  <MigrationPanel
                    migrationTarget={migrationTarget}
                    remainingAllowance={balance}
                    balance={balance}
                    isExpired={true}
                    onMigrate={migrate}
                    isPending={isMigratePending}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fund" id="fund">
            <div className="max-w-md">
              <FundTreasuryForm
                treasuryAddress={treasuryAddress as `0x${string}`}
                treasuryName={treasuryDB?.name || undefined}
                currentBalance={balance}
                status={status}
                onFundingComplete={handleFundingComplete}
              />
            </div>
          </TabsContent>

          <TabsContent value="spend">
            <div className="max-w-md">
              {isOwner ? (
                <SpendForm
                  treasuryAddress={treasuryAddress as `0x${string}`}
                  remainingAllowance={remainingAllowance}
                  periodSeconds={periodSeconds}
                  onSpendSuccess={() => {
                    refetchBalance();
                    refetchTransactions();
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                    <CardTitle className="text-lg mb-2">Owner Only</CardTitle>
                    <CardDescription>
                      Only the treasury owner can execute spend transactions.
                    </CardDescription>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="whitelist">
            <div className="max-w-md">
              <WhitelistViewer
                treasuryAddress={treasuryAddress as `0x${string}`}
                savedWhitelist={whitelist || []}
              />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <TransactionList
              transactions={transactions || []}
              isLoading={isLoadingTx}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
