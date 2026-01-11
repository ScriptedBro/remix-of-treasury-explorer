import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Coins, 
  User, 
  Shield, 
  Clock, 
  ArrowRightLeft,
  ExternalLink,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

interface TreasuryDetailsProps {
  address: string;
  owner: string;
  token: string;
  maxSpendPerPeriod: string;
  periodSeconds: number;
  expiryTimestamp: number;
  migrationTarget: string;
  balance: string;
  name?: string;
}

export function TreasuryDetails({
  address,
  owner,
  token,
  maxSpendPerPeriod,
  periodSeconds,
  expiryTimestamp,
  migrationTarget,
  balance,
  name,
}: TreasuryDetailsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isExpired = expiryTimestamp > 0 && Date.now() / 1000 > expiryTimestamp;
  const expiryDate = expiryTimestamp > 0 ? new Date(expiryTimestamp * 1000) : null;

  const AddressField = ({ label, value, icon: Icon }: { label: string; value: string; icon: any }) => (
    <div className="flex items-start justify-between py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="text-sm font-mono">
          {value.slice(0, 8)}...{value.slice(-6)}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => copyToClipboard(value, label)}
        >
          {copiedField === label ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
        <a
          href={`https://etherscan.io/address/${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Treasury Details
          </CardTitle>
          <Badge variant={isExpired ? "destructive" : "secondary"}>
            {isExpired ? "Expired" : "Active"}
          </Badge>
        </div>
        {name && <p className="text-lg font-medium">{name}</p>}
      </CardHeader>
      <CardContent className="space-y-1">
        <AddressField label="Treasury" value={address} icon={Shield} />
        <Separator />
        <AddressField label="Owner" value={owner} icon={User} />
        <Separator />
        <AddressField label="Token" value={token} icon={Coins} />
        <Separator />
        <AddressField label="Migration Target" value={migrationTarget} icon={ArrowRightLeft} />
        <Separator />
        
        {/* Non-address fields */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span className="text-sm">Balance</span>
          </div>
          <span className="font-semibold">
            {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} MNEE
          </span>
        </div>
        <Separator />

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span className="text-sm">Max Spend / Period</span>
          </div>
          <span className="font-medium">
            {parseFloat(maxSpendPerPeriod).toLocaleString()} MNEE
          </span>
        </div>
        <Separator />

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Period Duration</span>
          </div>
          <span className="font-medium">
            {periodSeconds === 0
              ? "No period (per-call limit)"
              : periodSeconds < 3600
              ? `${periodSeconds / 60} minutes`
              : periodSeconds < 86400
              ? `${periodSeconds / 3600} hours`
              : `${periodSeconds / 86400} days`}
          </span>
        </div>
        <Separator />

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Expiry</span>
          </div>
          <span className={`font-medium ${isExpired ? "text-destructive" : ""}`}>
            {expiryDate ? format(expiryDate, "PPpp") : "No expiry"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
