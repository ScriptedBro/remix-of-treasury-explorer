import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRightLeft,
  Circle
} from "lucide-react";
import { type TreasuryStatus, getStatusLabel } from "@/lib/treasury-status";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: TreasuryStatus;
  size?: 'sm' | 'default';
  showIcon?: boolean;
}

const statusConfig: Record<TreasuryStatus, {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: typeof Wallet;
  className: string;
}> = {
  unfunded: {
    variant: 'secondary',
    icon: Wallet,
    className: 'bg-muted text-muted-foreground',
  },
  active: {
    variant: 'default',
    icon: CheckCircle2,
    className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  },
  exhausted: {
    variant: 'outline',
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  expired: {
    variant: 'destructive',
    icon: Clock,
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  migrated: {
    variant: 'outline',
    icon: ArrowRightLeft,
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
};

export function StatusBadge({ status, size = 'default', showIcon = true }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        config.className,
        size === 'sm' && 'text-xs px-2 py-0.5'
      )}
    >
      {showIcon && (
        <Icon className={cn(
          "mr-1",
          size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
        )} />
      )}
      {getStatusLabel(status)}
    </Badge>
  );
}
