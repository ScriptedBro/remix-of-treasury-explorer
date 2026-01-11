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

      const checks = await Promise.all(
        rows.map(async (t) => {
          try {
            const code = await publicClient.getBytecode({
              address: String(t.address) as `0x${string}`,
            });
            return { id: String(t.id), code };
          } catch {
            // If the RPC call fails, do NOT delete (assume not stale)
            return { id: String(t.id), code: undefined };
          }
        })
      );

      const staleTreasuryIds = checks
        .filter((c) => c.code === "0x")
        .map((c) => c.id);

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
