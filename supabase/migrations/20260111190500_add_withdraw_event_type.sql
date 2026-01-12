-- Allow recording withdrawAll events
ALTER TABLE public.treasury_transactions
DROP CONSTRAINT IF EXISTS treasury_transactions_event_type_check;

ALTER TABLE public.treasury_transactions
ADD CONSTRAINT treasury_transactions_event_type_check
CHECK (
  event_type = ANY (ARRAY[
    'spend'::text,
    'migration'::text,
    'deposit'::text,
    'withdraw'::text
  ])
);
