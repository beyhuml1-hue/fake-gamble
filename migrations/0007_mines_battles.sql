-- Standalone multiplayer Mines Battles, independent of the removed Club.
-- No wager, currency exchange, or impact on local Play USD balances.
CREATE TABLE IF NOT EXISTS mines_battle_rooms (
 id TEXT PRIMARY KEY,
 host_id TEXT NOT NULL REFERENCES auth_users(id),
 guest_id TEXT REFERENCES auth_users(id),
 host_label TEXT NOT NULL,
 guest_label TEXT,
 host_mines INTEGER NOT NULL CHECK(host_mines BETWEEN 0 AND 33554431),
 guest_mines INTEGER CHECK(guest_mines BETWEEN 0 AND 33554431),
 host_revealed INTEGER NOT NULL DEFAULT 0 CHECK(host_revealed BETWEEN 0 AND 33554431),
 guest_revealed INTEGER NOT NULL DEFAULT 0 CHECK(guest_revealed BETWEEN 0 AND 33554431),
 host_score INTEGER NOT NULL DEFAULT 0 CHECK(host_score BETWEEN 0 AND 8),
 guest_score INTEGER NOT NULL DEFAULT 0 CHECK(guest_score BETWEEN 0 AND 8),
 host_busted INTEGER NOT NULL DEFAULT 0 CHECK(host_busted IN (0,1)),
 guest_busted INTEGER NOT NULL DEFAULT 0 CHECK(guest_busted IN (0,1)),
 status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN('waiting','active','finished','cancelled','expired')),
 winner_id TEXT REFERENCES auth_users(id),
 end_reason TEXT,
 created_ms INTEGER NOT NULL,
 started_ms INTEGER,
 ends_ms INTEGER NOT NULL,
 finished_ms INTEGER,
 CHECK(guest_id IS NULL OR host_id <> guest_id)
);
CREATE INDEX IF NOT EXISTS mines_battle_recent ON mines_battle_rooms(created_ms DESC);
CREATE INDEX IF NOT EXISTS mines_battle_active ON mines_battle_rooms(status, ends_ms);
CREATE UNIQUE INDEX IF NOT EXISTS mines_battle_one_waiting_host ON mines_battle_rooms(host_id) WHERE status='waiting';
