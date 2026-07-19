-- migrations/20260719_create_wager_tables.sql
-- Postgres migration for P2P Wager System

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Wager status enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wager_status') THEN
        CREATE TYPE wager_status AS ENUM (
          'draft','pending_approval','awaiting_payment','awaiting_funding','funded',
          'active','live','awaiting_settlement','settled','cancelled','refunded',
          'disputed','terminated'
        );
    END IF;
END$$;

-- Core tables
CREATE TABLE IF NOT EXISTS wager_challenges (
  id BIGSERIAL PRIMARY KEY,
  challenger_id BIGINT NOT NULL,
  opponent_id BIGINT NOT NULL,
  match_provider VARCHAR(128),
  match_id VARCHAR(128),
  league VARCHAR(128),
  bet_category VARCHAR(64),
  bet_type VARCHAR(64),
  stake NUMERIC(18,2) NOT NULL,
  total_pot NUMERIC(18,2) GENERATED ALWAYS AS (stake*2) STORED,
  platform_fee NUMERIC(18,2) DEFAULT 0,
  agreement TEXT,
  match_start TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wagers (
  id BIGSERIAL PRIMARY KEY,
  wager_uuid UUID DEFAULT gen_random_uuid() NOT NULL,
  challenge_id BIGINT REFERENCES wager_challenges(id) ON DELETE CASCADE,
  status wager_status DEFAULT 'pending_approval',
  acceptance_date TIMESTAMP WITH TIME ZONE,
  funding_deadline TIMESTAMP WITH TIME ZONE,
  kickoff_time TIMESTAMP WITH TIME ZONE,
  total_pot NUMERIC(18,2) NOT NULL,
  platform_fee NUMERIC(18,2) DEFAULT 0,
  potential_prize NUMERIC(18,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wager_participants (
  id BIGSERIAL PRIMARY KEY,
  wager_id BIGINT REFERENCES wagers(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  stake NUMERIC(18,2) NOT NULL,
  payment_status VARCHAR(32) DEFAULT 'pending', -- pending/paid/verified/rejected
  wallet_credit_tx_id VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wager_payments (
  id BIGSERIAL PRIMARY KEY,
  wager_id BIGINT REFERENCES wagers(id) ON DELETE CASCADE,
  participant_id BIGINT REFERENCES wager_participants(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  payment_method VARCHAR(64),
  external_reference VARCHAR(256),
  status VARCHAR(32) DEFAULT 'pending', -- pending/received/verified/rejected
  received_at TIMESTAMP WITH TIME ZONE,
  verified_by BIGINT,
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS wager_rounds (
  id BIGSERIAL PRIMARY KEY,
  wager_id BIGINT REFERENCES wagers(id) ON DELETE CASCADE,
  round_index INT,
  round_score JSONB DEFAULT '{}'::jsonb,
  winner_user_id BIGINT,
  duration_seconds INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wager_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  wager_id BIGINT REFERENCES wagers(id) ON DELETE CASCADE,
  admin_id BIGINT,
  action VARCHAR(128) NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wager_disputes (
  id BIGSERIAL PRIMARY KEY,
  wager_id BIGINT REFERENCES wagers(id) ON DELETE CASCADE,
  opened_by BIGINT NOT NULL,
  status VARCHAR(32) DEFAULT 'open',
  reason TEXT,
  evidence JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Wallet transactions ledger for wagers (simple ledger to start)
CREATE TABLE IF NOT EXISTS wager_wallet_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  wager_id BIGINT,
  type VARCHAR(32) NOT NULL, -- credit, debit, payout, reversal
  amount NUMERIC(18,2) NOT NULL,
  reference VARCHAR(256),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wagers_status ON wagers(status);
CREATE INDEX IF NOT EXISTS idx_wagers_uuid ON wagers(wager_uuid);
CREATE INDEX IF NOT EXISTS idx_wager_participants_user ON wager_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_wager_payments_status ON wager_payments(status);
