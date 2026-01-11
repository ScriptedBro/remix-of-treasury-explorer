CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: treasuries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasuries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    address text NOT NULL,
    owner_address text NOT NULL,
    token_address text NOT NULL,
    max_spend_per_period text NOT NULL,
    period_seconds integer NOT NULL,
    expiry_timestamp bigint,
    migration_target text NOT NULL,
    name text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    chain_id integer DEFAULT 1 NOT NULL,
    deployment_tx_hash text
);


--
-- Name: treasury_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    treasury_id uuid NOT NULL,
    tx_hash text NOT NULL,
    event_type text NOT NULL,
    from_address text NOT NULL,
    to_address text NOT NULL,
    amount text NOT NULL,
    period_index integer,
    block_number bigint NOT NULL,
    block_timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT treasury_transactions_event_type_check CHECK ((event_type = ANY (ARRAY['spend'::text, 'migration'::text, 'deposit'::text])))
);


--
-- Name: treasury_whitelists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treasury_whitelists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    treasury_id uuid NOT NULL,
    address text NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: treasuries treasuries_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasuries
    ADD CONSTRAINT treasuries_address_key UNIQUE (address);


--
-- Name: treasuries treasuries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasuries
    ADD CONSTRAINT treasuries_pkey PRIMARY KEY (id);


--
-- Name: treasury_transactions treasury_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_pkey PRIMARY KEY (id);


--
-- Name: treasury_transactions treasury_transactions_tx_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_tx_hash_key UNIQUE (tx_hash);


--
-- Name: treasury_whitelists treasury_whitelists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_whitelists
    ADD CONSTRAINT treasury_whitelists_pkey PRIMARY KEY (id);


--
-- Name: treasury_whitelists treasury_whitelists_treasury_id_address_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_whitelists
    ADD CONSTRAINT treasury_whitelists_treasury_id_address_key UNIQUE (treasury_id, address);


--
-- Name: idx_treasuries_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasuries_owner ON public.treasuries USING btree (owner_address);


--
-- Name: idx_treasury_transactions_block; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transactions_block ON public.treasury_transactions USING btree (block_timestamp);


--
-- Name: idx_treasury_transactions_treasury; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treasury_transactions_treasury ON public.treasury_transactions USING btree (treasury_id);


--
-- Name: treasuries update_treasuries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_treasuries_updated_at BEFORE UPDATE ON public.treasuries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: treasury_transactions treasury_transactions_treasury_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_transactions
    ADD CONSTRAINT treasury_transactions_treasury_id_fkey FOREIGN KEY (treasury_id) REFERENCES public.treasuries(id) ON DELETE CASCADE;


--
-- Name: treasury_whitelists treasury_whitelists_treasury_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treasury_whitelists
    ADD CONSTRAINT treasury_whitelists_treasury_id_fkey FOREIGN KEY (treasury_id) REFERENCES public.treasuries(id) ON DELETE CASCADE;


--
-- Name: treasuries Anyone can create treasuries with valid data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create treasuries with valid data" ON public.treasuries FOR INSERT WITH CHECK (((address ~ '^0x[a-fA-F0-9]{40}$'::text) AND (owner_address ~ '^0x[a-fA-F0-9]{40}$'::text) AND (token_address ~ '^0x[a-fA-F0-9]{40}$'::text) AND (migration_target ~ '^0x[a-fA-F0-9]{40}$'::text)));


--
-- Name: treasury_whitelists Anyone can create whitelists with valid addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can create whitelists with valid addresses" ON public.treasury_whitelists FOR INSERT WITH CHECK ((address ~ '^0x[a-fA-F0-9]{40}$'::text));


--
-- Name: treasury_transactions Anyone can record transactions with valid data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can record transactions with valid data" ON public.treasury_transactions FOR INSERT WITH CHECK (((from_address ~ '^0x[a-fA-F0-9]{40}$'::text) AND (to_address ~ '^0x[a-fA-F0-9]{40}$'::text) AND (tx_hash ~ '^0x[a-fA-F0-9]{64}$'::text)));


--
-- Name: treasury_transactions Anyone can view transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view transactions" ON public.treasury_transactions FOR SELECT USING (true);


--
-- Name: treasuries Anyone can view treasuries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view treasuries" ON public.treasuries FOR SELECT USING (true);


--
-- Name: treasury_whitelists Anyone can view whitelists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view whitelists" ON public.treasury_whitelists FOR SELECT USING (true);


--
-- Name: treasuries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treasuries ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treasury_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: treasury_whitelists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treasury_whitelists ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;