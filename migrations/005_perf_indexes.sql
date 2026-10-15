-- Indexes for the per-scene and per-owner lookups that otherwise scan the whole table:
-- a scene's drawings, a user's characters, a character's jobs.
CREATE INDEX IF NOT EXISTS idx_drawing_scene ON drawing (sceneId);
CREATE INDEX IF NOT EXISTS idx_character_user ON character (userId);
CREATE INDEX IF NOT EXISTS idx_job_character ON job (CharacterId);
