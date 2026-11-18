-- Optional, disclosed single-player Mines simulation tile, never for PvP rooms.
ALTER TABLE auth_account_controls ADD COLUMN bomb_tile INTEGER CHECK(bomb_tile IS NULL OR bomb_tile BETWEEN 0 AND 24);
