export type TreasuryStatus = 'unfunded' | 'active' | 'exhausted' | 'expired' | 'migrated';

export interface TreasuryStatusData {
  balance: bigint;
  expiryTimestamp: number;
  hasTransactions: boolean;
  hasMigration: boolean;
  migrationTarget?: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export function getTreasuryStatus(data: TreasuryStatusData): TreasuryStatus {
  const now = Math.floor(Date.now() / 1000);
  
  // Check if migrated (migration target is set to non-zero and has been executed)
  if (data.hasMigration) {
    return 'migrated';
  }
  
  // Check if expired
  if (data.expiryTimestamp > 0 && now > data.expiryTimestamp) {
    return 'expired';
  }
  
  // Check if unfunded (never had any balance/transactions)
  if (data.balance === 0n && !data.hasTransactions) {
    return 'unfunded';
  }
  
  // Check if exhausted (had funds but now empty)
  if (data.balance === 0n && data.hasTransactions) {
    return 'exhausted';
  }
  
  // Otherwise it's active
  return 'active';
}

export function getStatusLabel(status: TreasuryStatus): string {
  switch (status) {
    case 'unfunded':
      return 'Unfunded';
    case 'active':
      return 'Active';
    case 'exhausted':
      return 'Exhausted';
    case 'expired':
      return 'Expired';
    case 'migrated':
      return 'Migrated';
  }
}

export function getStatusDescription(status: TreasuryStatus): string {
  switch (status) {
    case 'unfunded':
      return 'This treasury has never been funded. Add MNEE to start using it.';
    case 'active':
      return 'Treasury is funded and ready for spending.';
    case 'exhausted':
      return 'Treasury balance has been fully spent.';
    case 'expired':
      return 'Treasury has expired and cannot accept new transactions.';
    case 'migrated':
      return 'Funds have been migrated to another address.';
  }
}
