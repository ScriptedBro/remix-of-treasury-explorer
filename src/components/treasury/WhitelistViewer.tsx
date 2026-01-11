import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Search, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useReadContract } from "wagmi";
import { POLICY_TREASURY_ABI } from "@/lib/contracts/abis";
import type { TreasuryWhitelist } from "@/hooks/useTreasuryDB";

interface WhitelistViewerProps {
  treasuryAddress: `0x${string}`;
  savedWhitelist?: TreasuryWhitelist[];
}

export function WhitelistViewer({ treasuryAddress, savedWhitelist = [] }: WhitelistViewerProps) {
  const [checkAddress, setCheckAddress] = useState("");

  const { data: isWhitelisted, isFetching } = useReadContract({
    address: treasuryAddress,
    abi: POLICY_TREASURY_ABI,
    functionName: "isWhitelisted",
    args: [checkAddress as `0x${string}`],
    query: {
      enabled: checkAddress.length === 42 && checkAddress.startsWith("0x"),
    },
  });

  const showResult = checkAddress.length === 42 && checkAddress.startsWith("0x");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Whitelist
        </CardTitle>
        <CardDescription>
          Check if an address is whitelisted for receiving funds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Check Address */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter address to check (0x...)"
            value={checkAddress}
            onChange={(e) => setCheckAddress(e.target.value)}
            className="font-mono"
          />
          <Button variant="outline" size="icon" disabled={!showResult}>
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Result */}
        {showResult && !isFetching && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            isWhitelisted ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
          }`}>
            {isWhitelisted ? (
              <>
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Address is whitelisted</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Address is NOT whitelisted</span>
              </>
            )}
          </div>
        )}

        {/* Saved Whitelist */}
        {savedWhitelist.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Known Addresses</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedWhitelist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex flex-col">
                    {item.label && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                    <code className="text-xs text-muted-foreground font-mono">
                      {item.address.slice(0, 10)}...{item.address.slice(-8)}
                    </code>
                  </div>
                  <Badge variant="secondary">Whitelisted</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
