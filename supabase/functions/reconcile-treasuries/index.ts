import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReconcileRequest {
  ownerAddress: string;
  chainId: number;
  staleTreasuryIds: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { ownerAddress, chainId, staleTreasuryIds }: ReconcileRequest = await req.json();

    if (!ownerAddress || !/^0x[a-fA-F0-9]{40}$/.test(ownerAddress)) {
      return new Response(JSON.stringify({ error: "Invalid ownerAddress" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(chainId)) {
      return new Response(JSON.stringify({ error: "Invalid chainId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(staleTreasuryIds)) {
      return new Response(JSON.stringify({ error: "staleTreasuryIds must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedIds = staleTreasuryIds.map(String).filter(Boolean);

    let deletedCount = 0;

    if (requestedIds.length > 0) {
      // Only delete treasuries that match this owner+chainId (defense-in-depth)
      const { data: deletable, error: lookupError } = await supabase
        .from("treasuries")
        .select("id")
        .eq("owner_address", ownerAddress.toLowerCase())
        .eq("chain_id", chainId)
        .in("id", requestedIds);

      if (lookupError) {
        return new Response(
          JSON.stringify({ error: "Failed to verify treasuries", details: lookupError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const deletableIds = (deletable || []).map((r) => String(r.id));

      if (deletableIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("treasuries")
          .delete()
          .in("id", deletableIds);

        if (deleteError) {
          return new Response(
            JSON.stringify({
              error: "Failed to delete stale treasuries",
              details: deleteError.message,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        deletedCount = deletableIds.length;
      }
    }

    return new Response(
      JSON.stringify({
        chainId,
        ownerAddress: ownerAddress.toLowerCase(),
        scanned: requestedIds.length,
        deleted: deletedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Unexpected error", details: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
