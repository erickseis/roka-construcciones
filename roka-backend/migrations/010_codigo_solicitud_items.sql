-- Migration 009: Add codigo column to solicitud_items
-- Allows storing a manual SKU/code when material is not linked to catalog

ALTER TABLE solicitud_items
  ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
