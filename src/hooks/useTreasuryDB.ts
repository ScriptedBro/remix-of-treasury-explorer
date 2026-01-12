import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useChainId, usePublicClient } from "wagmi";

export type Treasury = Tables<"treasuries">;
export type TreasuryInsert = TablesInsert<"treasuries">;
export type TreasuryTransaction = Tables<"treasury_transactions">;
export type TreasuryWhitelist = Tables<"treasury_whitelists">;

// Fetch all treasuries for an owner
export function useTreasuries(ownerAddress?: string) {
  const chainId = useChainId();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["treasuries", ownerAddress, chainId],
    queryFn: async () => {
      let query = supabase
        .from("treasuries")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (ownerAddress) {
        query = query.eq("owner_address", ownerAddress.toLowerCase());
      }

      query = query.eq("chain_id", chainId);
      
      const { data, error } = await query;
      if (error) throw error;

      const treasuries = data || [];

      // On-chain reconciliation: filter out treasuries that do not exist on the currently connected chain
      const bytecodes = await Promise.all(
        treasuries.map(async (t) => {
          try {
            const code = await publicClient.getBytecode({
              address: t.address as `0x${string}`,
            });
            return { id: t.id, code };
          } catch {
            return { id: t.id, code: undefined };
          }
        })
      );

      const bytecodeById = new Map(bytecodes.map((b) => [b.id, b.code] as const));

      return treasuries.filter((t) => {
        const code = bytecodeById.get(t.id);
        return !!code && code !== "0x";
      });
    },
    enabled: !!ownerAddress && !!publicClient,
  });
}

// Fetch a single treasury by address
export function useTreasuryByAddress(address?: string) {
  const chainId = useChainId();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["treasury", address, chainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasuries")
        .select("*")
        .eq("address", address?.toLowerCase() || "")
        .eq("chain_id", chainId)
        .maybeSingle();
      
      if (error) throw error;

      if (!data) return data;

      // On-chain reconciliation: if the contract doesn't exist on this chain, treat it as missing
      try {
        const code = await publicClient.getBytecode({
          address: data.address as `0x${string}`,
        });
        if (!code || code === "0x") return null;
      } catch {
        return null;
      }

      return data;
    },
    enabled: !!address && !!publicClient,
  });
}

// Fetch treasury whitelist
export function useTreasuryWhitelist(treasuryId?: string) {
  return useQuery({
    queryKey: ["treasury-whitelist", treasuryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasury_whitelists")
        .select("*")
        .eq("treasury_id", treasuryId || "")
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!treasuryId,
  });
}

// Fetch treasury transactions
export function useTreasuryTransactions(treasuryId?: string) {
  return useQuery({
    queryKey: ["treasury-transactions", treasuryId],
    queryFn: async () => {
      let query = supabase
        .from("treasury_transactions")
        .select("*, treasuries(address, name)")
        .order("block_timestamp", { ascending: false });
      
      if (treasuryId) {
        query = query.eq("treasury_id", treasuryId);
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });
}

// Check if treasury has any transactions
export function useTreasuryHasTransactions(treasuryId?: string) {
  return useQuery({
    queryKey: ["treasury-has-transactions", treasuryId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("treasury_transactions")
        .select("*", { count: 'exact', head: true })
        .eq("treasury_id", treasuryId || "");
      
      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: !!treasuryId,
  });
}

// Check if treasury has migration event
export function useTreasuryHasMigration(treasuryId?: string) {
  return useQuery({
    queryKey: ["treasury-has-migration", treasuryId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("treasury_transactions")
        .select("*", { count: 'exact', head: true })
        .eq("treasury_id", treasuryId || "")
        .eq("event_type", "migrate");
      
      if (error) throw error;
      return (count || 0) > 0;
    },
    enabled: !!treasuryId,
  });
}

// Fetch all transactions (for history page)
export function useAllTransactions(ownerAddress?: string) {
  return useQuery({
    queryKey: ["all-transactions", ownerAddress],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treasury_transactions")
        .select("*, treasuries!inner(address, name, owner_address)")
        .eq("treasuries.owner_address", ownerAddress?.toLowerCase() || "")
        .order("block_timestamp", { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data;
    },
    enabled: !!ownerAddress,
  });
}

// Create a new treasury record
export function useCreateTreasury() {
  const queryClient = useQueryClient();
  const chainId = useChainId();
  
  return useMutation({
    mutationFn: async (treasury: TreasuryInsert) => {
      const payload = {
        ...treasury,
        address: treasury.address.toLowerCase(),
        owner_address: treasury.owner_address.toLowerCase(),
        token_address: treasury.token_address.toLowerCase(),
        migration_target: treasury.migration_target.toLowerCase(),
        chain_id: chainId,
      };

      const { data, error } = await supabase
        .from("treasuries")
        .upsert(payload, {
          onConflict: "address",
          ignoreDuplicates: true,
        })
        .select()
        .maybeSingle();

      if (error && (error as any).code !== "23505") throw error;
      if (data) return data;

      const { data: existing, error: existingError } = await supabase
        .from("treasuries")
        .select("*")
        .eq("address", payload.address)
        .maybeSingle();

      if (existingError) throw existingError;
      if (!existing) throw new Error("Failed to create or load treasury record from database");
      return existing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
    },
  });
}

// Add whitelist addresses
export function useAddWhitelistAddresses() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ treasuryId, addresses }: { treasuryId: string; addresses: { address: string; label?: string }[] }) => {
      const records = addresses.map(a => ({
        treasury_id: treasuryId,
        address: a.address.toLowerCase(),
        label: a.label,
      }));
      
      const { data, error } = await supabase
        .from("treasury_whitelists")
        .insert(records)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["treasury-whitelist", variables.treasuryId] });
    },
  });
}

// Record a transaction
export function useRecordTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tx: TablesInsert<"treasury_transactions">) => {
      const { data, error } = await supabase
        .from("treasury_transactions")
        .insert({
          ...tx,
          from_address: tx.from_address.toLowerCase(),
          to_address: tx.to_address.toLowerCase(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["treasury-transactions", variables.treasury_id] });
      queryClient.invalidateQueries({ queryKey: ["all-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["treasury-has-transactions", variables.treasury_id] });
      queryClient.invalidateQueries({ queryKey: ["treasury-has-migration", variables.treasury_id] });
    },
  });
}

// Update treasury metadata
export function useUpdateTreasury() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Treasury> }) => {
      const { data, error } = await supabase
        .from("treasuries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasuries"] });
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
    },
  });
}
