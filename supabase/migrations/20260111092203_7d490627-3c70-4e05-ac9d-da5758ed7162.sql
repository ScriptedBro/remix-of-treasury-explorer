-- Add log_index column to support unique identification of on-chain logs
ALTER TABLE public.treasury_transactions
ADD COLUMN IF NOT EXISTS log_index integer;

-- Helpful index to prevent duplicates and speed up lookups
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_dedupe
ON public.treasury_transactions (treasury_id, tx_hash, event_type, log_index);
