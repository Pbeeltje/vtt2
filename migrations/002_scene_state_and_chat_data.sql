-- Table-wide settings, e.g. the scene the DM made active for players ('activeSceneId').
CREATE TABLE IF NOT EXISTS app_setting (
	Key TEXT PRIMARY KEY,
	Value TEXT
);

-- GET /api/characters used to insert an empty inventory row (ItemId NULL) per character
-- on every read. They hold nothing; inventory rows now always point at an item.
DELETE FROM inventory WHERE ItemId IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_character_item ON inventory (CharacterId, ItemId);

-- Structured payload for chat messages, e.g. the individual dice of a server-side roll (JSON).
ALTER TABLE chatmessage ADD COLUMN Data TEXT;
