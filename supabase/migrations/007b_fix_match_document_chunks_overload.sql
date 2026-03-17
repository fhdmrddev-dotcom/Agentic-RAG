-- Migration 007b: Fix match_document_chunks function overload conflict
-- Run this if you ran 007_document_metadata.sql before this fix was added.
-- PostgREST cannot resolve ambiguity between the old and new function signatures.

DROP FUNCTION IF EXISTS public.match_document_chunks(vector, uuid, integer, float);
