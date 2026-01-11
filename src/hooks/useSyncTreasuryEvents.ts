import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SyncParams {
  treasuryAddress: string;
  treasuryId: string;
  fromBlock?: number;
  rpcUrl?: string;
}

interface SyncResult {
  success: boolean;
  syncedFrom: number;
  syncedTo: number;
  eventsProcessed: number;
  events: Array<{
    event_type: string;
    tx_hash: string;
    block_number: number;
    from_address: string;
    to_address: string;
    amount: string;
    period_index: number | null;
  }>;
}

export function useSyncTreasuryEvents() {
  return useMutation({
    mutationFn: async (params: SyncParams): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke("sync-treasury-events", {
        body: params,
      });

      if (error) {
        throw new Error(error.message || "Failed to sync treasury events");
      }

      if (!data.success) {
        throw new Error(data.error || "Sync failed");
      }

      return data as SyncResult;
    },
    onSuccess: (data) => {
      if (data.eventsProcessed > 0) {
        toast.success(`Synced ${data.eventsProcessed} new events from blocks ${data.syncedFrom} to ${data.syncedTo}`);
      } else {
        toast.info("No new events to sync");
      }
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });
}
