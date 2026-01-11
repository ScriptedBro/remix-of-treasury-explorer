import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePublicClient } from "wagmi";

interface ReconcileParams {
  ownerAddress: string;
  chainId: number;
}

interface ReconcileResult {
  chainId: number;
  ownerAddress: string;
  scanned: number;
  deleted: number;
}

export function useReconcileTreasuries() {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();

  return useMutation({
    mutationFn: async (params: ReconcileParams): Promise<ReconcileResult> => {
      if (!publicClient) {
        throw new Error("Missing public client");
      }

      const { data: treasuries, error: listError } = await supabase
        .from("treasuries")
        .select("id,address")
        .eq("owner_address", params.ownerAddress.toLowerCase())
        .eq("chain_id", params.chainId);

      if (listError) {
        throw new Error(listError.message || "Failed to list treasuries");
      }

      const rows = treasuries || [];

      // If no treasuries, nothing to reconcile
      if (rows.length === 0) {
        return {
          chainId: params.chainId,
          ownerAddress: params.ownerAddress.toLowerCase(),
          scanned: 0,
          deleted: 0,
        };
      }

      const checks = await Promise.all(
        rows.map(async (t) => {
          try {
            const code = await publicClient.getBytecode({
              address: String(t.address) as `0x${string}`,
            });
            return { id: String(t.id), code, success: true };
          } catch {
            // If the RPC call fails, do NOT delete (assume not stale)
            return { id: String(t.id), code: undefined, success: false };
          }
        })
      );

      // Safety check: if ALL treasuries appear stale (code === "0x"),
      // this likely indicates an RPC/network mismatch (e.g., local fork vs prod RPC).
      // In this case, skip deletion to avoid wiping the entire list.
      const successfulChecks = checks.filter((c) => c.success);
      const staleChecks = successfulChecks.filter((c) => c.code === "0x");
      const hasContractChecks = successfulChecks.filter((c) => c.code && c.code !== "0x");

      // If we got results but ALL of them are stale, likely network mismatch - abort
      if (successfulChecks.length > 0 && staleChecks.length === successfulChecks.length) {
        console.warn(
          "[reconcile] All treasuries appear stale - possible RPC/network mismatch. Skipping deletion."
        );
        return {
          chainId: params.chainId,
          ownerAddress: params.ownerAddress.toLowerCase(),
          scanned: rows.length,
          deleted: 0,
        };
      }

      // Only mark as stale if we verified at least one treasury has valid bytecode
      // This ensures we're connected to the right network before deleting anything
      const staleTreasuryIds = hasContractChecks.length > 0
        ? staleChecks.map((c) => c.id)
        : [];

      const { data, error } = await supabase.functions.invoke("reconcile-treasuries", {
        body: {
          ownerAddress: params.ownerAddress,
          chainId: params.chainId,
          staleTreasuryIds,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to reconcile treasuries");
      }

      return data as ReconcileResult;
    },
    onSuccess: (data) => {
      if (data.deleted > 0) {
        toast.info(`Removed ${data.deleted} stale treasur${data.deleted === 1 ? "y" : "ies"} from the database`);
      }
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
    },
    onError: (error: Error) => {
      toast.error(`Reconcile failed: ${error.message}`);
    },
  });
}
