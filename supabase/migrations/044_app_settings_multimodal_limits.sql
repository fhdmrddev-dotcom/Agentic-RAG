-- Migration 044: app_settings multimodal limit columns (Phase 071 lays the CONTRACT;
-- Phase 072 RAG-MM-LIFT-01 actually USES these in multimodal_service).
--
-- Defaults: 100 vision calls + 4 MB per b64 chunk — raised from the current
-- _MAX_VISION_CALLS=20 / _MAX_B64_BYTES=512KB module constants (Phase 072 swaps
-- the constants for these column reads).

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS multimodal_max_vision_calls integer DEFAULT 100,
  ADD COLUMN IF NOT EXISTS multimodal_max_b64_bytes_kb integer DEFAULT 4096;
