import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PolicyTreasury ABI - only the events we need
const POLICY_TREASURY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "operator", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "periodIndex", type: "uint256" },
      { indexed: false, name: "remainingBalance", type: "uint256" },
    ],
    name: "Migration",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "operator", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "periodIndex", type: "uint256" },
    ],
    name: "Spend",
    type: "event",
  },
] as const;

// ERC20 Transfer event ABI for tracking funding
const ERC20_TRANSFER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;

// Compute event signatures (keccak256 hash of event signature)
function keccak256(data: Uint8Array): string {
  // Simple implementation for event signatures
  // In production, use a proper crypto library
  return "";
}

// Pre-computed event topic hashes
const EVENT_TOPICS = {
  Spend: "0x5d1d2caf5783ceec0d7e40fcc32a727c30e07e1ef8e7c10f4c8b2efd3f2a4a7d",
  Migration: "0x8b80bd19aea7b735bc6d75db8d6adbe18b28c30d62b3c1c8fa5238bd88c6d2f4",
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
};

interface SyncRequest {
  treasuryAddress: string;
  treasuryId: string;
  fromBlock?: number;
  rpcUrl?: string;
}

interface EventLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: string;
}

interface Block {
  timestamp: string;
}

// Decode uint256 from hex
function decodeUint256(hex: string): bigint {
  return BigInt(hex);
}

// Decode address from topic (remove padding)
function decodeAddress(topic: string): string {
  return "0x" + topic.slice(26).toLowerCase();
}

// Encode an address as a 32-byte topic value
function encodeAddressTopic(address: string): string {
  const normalized = address.toLowerCase().replace(/^0x/, "");
  return "0x" + normalized.padStart(64, "0");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { treasuryAddress, treasuryId, fromBlock, rpcUrl }: SyncRequest =
      await req.json();

    if (!treasuryAddress || !treasuryId) {
      return new Response(
        JSON.stringify({ error: "treasuryAddress and treasuryId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(treasuryAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid treasury address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use provided RPC URL or default
    const rpc = rpcUrl || "http://localhost:8545";

    const { data: treasuryRow, error: treasuryError } = await supabase
      .from("treasuries")
      .select("token_address")
      .eq("id", treasuryId)
      .single();

    if (treasuryError || !treasuryRow?.token_address) {
      return new Response(
        JSON.stringify({
          error: "Failed to resolve treasury token_address",
          details: treasuryError ? String(treasuryError.message || treasuryError) : "Missing token_address",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenAddress = String(treasuryRow.token_address).toLowerCase();

    // Get the latest synced block for this treasury
    const { data: lastTx } = await supabase
      .from("treasury_transactions")
      .select("block_number")
      .eq("treasury_id", treasuryId)
      .order("block_number", { ascending: false })
      .limit(1)
      .single();

    const startBlock = fromBlock || (lastTx?.block_number ? lastTx.block_number + 1 : 0);

    // Fetch current block number
    const blockNumResponse = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
    });
    const blockNumResult = await blockNumResponse.json();
    const currentBlock = parseInt(blockNumResult.result, 16);

    // Fetch Spend and Migration events from the treasury contract
    const logsResponse = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [
          {
            address: treasuryAddress,
            fromBlock: "0x" + startBlock.toString(16),
            toBlock: "0x" + currentBlock.toString(16),
            topics: [
              [EVENT_TOPICS.Spend, EVENT_TOPICS.Migration],
            ],
          },
        ],
        id: 2,
      }),
    });
    const logsResult = await logsResponse.json();

    // Fetch ERC20 Transfer events into this treasury address
    const transferLogsResponse = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [
          {
            address: tokenAddress,
            fromBlock: "0x" + startBlock.toString(16),
            toBlock: "0x" + currentBlock.toString(16),
            topics: [
              EVENT_TOPICS.Transfer,
              null,
              encodeAddressTopic(treasuryAddress),
            ],
          },
        ],
        id: 4,
      }),
    });
    const transferLogsResult = await transferLogsResponse.json();

    if (logsResult.error) {
      return new Response(
        JSON.stringify({ error: "RPC error fetching logs", details: logsResult.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (transferLogsResult.error) {
      return new Response(
        JSON.stringify({
          error: "RPC error fetching transfer logs",
          details: transferLogsResult.error,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const logs: EventLog[] = logsResult.result || [];
    const transferLogs: EventLog[] = transferLogsResult.result || [];
    const processedEvents: Array<{
      event_type: string;
      tx_hash: string;
      block_number: number;
      from_address: string;
      to_address: string;
      amount: string;
      period_index: number | null;
    }> = [];

    const blockTimestampCache = new Map<string, string>();

    async function getBlockTimestamp(blockNumberHex: string): Promise<string> {
      const cached = blockTimestampCache.get(blockNumberHex);
      if (cached) return cached;

      const blockResponse = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBlockByNumber",
          params: [blockNumberHex, false],
          id: 3,
        }),
      });
      const blockResult = await blockResponse.json();
      const block: Block = blockResult.result;
      const timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
      blockTimestampCache.set(blockNumberHex, timestamp);
      return timestamp;
    }

    // Process each treasury log
    for (const log of logs) {
      const blockNumber = parseInt(log.blockNumber, 16);
      const logIndex = parseInt(log.logIndex, 16);

      const timestamp = await getBlockTimestamp(log.blockNumber);

      const topic0 = log.topics[0];
      let eventType: string;
      let fromAddress: string;
      let toAddress: string;
      let amount: string;
      let periodIndex: number | null = null;

      if (topic0 === EVENT_TOPICS.Spend) {
        eventType = "spend";
        fromAddress = decodeAddress(log.topics[1]); // operator
        toAddress = decodeAddress(log.topics[2]); // to
        // data contains: amount (32 bytes) + periodIndex (32 bytes)
        amount = decodeUint256("0x" + log.data.slice(2, 66)).toString();
        periodIndex = Number(decodeUint256("0x" + log.data.slice(66, 130)));
      } else if (topic0 === EVENT_TOPICS.Migration) {
        eventType = "migration";
        fromAddress = decodeAddress(log.topics[1]); // operator
        toAddress = decodeAddress(log.topics[2]); // to (migration target)
        // data contains: amount (32 bytes) + periodIndex (32 bytes) + remainingBalance (32 bytes)
        amount = decodeUint256("0x" + log.data.slice(2, 66)).toString();
        periodIndex = Number(decodeUint256("0x" + log.data.slice(66, 130)));
      } else {
        continue; // Unknown event type
      }

      // Check if this transaction already exists
      const { data: existing } = await supabase
        .from("treasury_transactions")
        .select("id")
        .eq("tx_hash", log.transactionHash)
        .eq("treasury_id", treasuryId)
        .eq("log_index", logIndex)
        .eq("event_type", eventType)
        .single();

      if (!existing) {
        // Insert new transaction
        const { error: insertError } = await supabase
          .from("treasury_transactions")
          .insert({
            treasury_id: treasuryId,
            tx_hash: log.transactionHash,
            block_number: blockNumber,
            block_timestamp: timestamp,
            event_type: eventType,
            from_address: fromAddress,
            to_address: toAddress,
            amount: amount,
            period_index: periodIndex,
            log_index: logIndex,
          });

        if (insertError) {
          console.error("Error inserting transaction:", insertError);
        } else {
          processedEvents.push({
            event_type: eventType,
            tx_hash: log.transactionHash,
            block_number: blockNumber,
            from_address: fromAddress,
            to_address: toAddress,
            amount: amount,
            period_index: periodIndex,
          });
        }
      }
    }

    // Process each funding transfer log
    for (const log of transferLogs) {
      const blockNumber = parseInt(log.blockNumber, 16);
      const logIndex = parseInt(log.logIndex, 16);
      const timestamp = await getBlockTimestamp(log.blockNumber);

      const topic0 = log.topics[0];
      if (topic0 !== EVENT_TOPICS.Transfer) continue;

      const eventType = "fund";
      const fromAddress = decodeAddress(log.topics[1]);
      const toAddress = decodeAddress(log.topics[2]);
      const amount = decodeUint256(log.data).toString();

      const { data: existing } = await supabase
        .from("treasury_transactions")
        .select("id")
        .eq("tx_hash", log.transactionHash)
        .eq("treasury_id", treasuryId)
        .eq("log_index", logIndex)
        .eq("event_type", eventType)
        .single();

      if (!existing) {
        const { error: insertError } = await supabase
          .from("treasury_transactions")
          .insert({
            treasury_id: treasuryId,
            tx_hash: log.transactionHash,
            block_number: blockNumber,
            block_timestamp: timestamp,
            event_type: eventType,
            from_address: fromAddress,
            to_address: toAddress,
            amount: amount,
            period_index: null,
            log_index: logIndex,
          });

        if (insertError) {
          console.error("Error inserting transaction:", insertError);
        } else {
          processedEvents.push({
            event_type: eventType,
            tx_hash: log.transactionHash,
            block_number: blockNumber,
            from_address: fromAddress,
            to_address: toAddress,
            amount: amount,
            period_index: null,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedFrom: startBlock,
        syncedTo: currentBlock,
        eventsProcessed: processedEvents.length,
        events: processedEvents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
