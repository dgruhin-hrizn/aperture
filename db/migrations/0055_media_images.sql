-- Migration: 0055_media_images
-- Description: Create media_images table for custom library/collection/playlist images

CREATE TABLE media_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Type: 'library', 'collection', 'playlist'
  entity_type TEXT NOT NULL CHECK (entity_type IN ('library', 'collection', 'playlist')),
  
  -- Reference ID (provider_library_id, collection_id, or playlist_id)
  entity_id TEXT NOT NULL,
  
  -- Image type for this entity (Primary, Backdrop, Banner, etc.)
  image_type TEXT NOT NULL DEFAULT 'Primary',
  
  -- Is this the admin-set default?
  is_default BOOLEAN NOT NULL DEFAULT false,
  
  -- User who uploaded (null for admin defaults)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- File path relative to uploads folder
  file_path TEXT NOT NULL,
  
  -- Original filename
  original_filename TEXT,
  
  -- MIME type
  mime_type TEXT NOT NULL,
  
  -- Dimensions
  width INTEGER,
  height INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX idx_media_images_entity ON media_images(entity_type, entity_id);
CREATE INDEX idx_media_images_user ON media_images(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_media_images_default ON media_images(entity_type, entity_id, is_default) WHERE is_default = true;

-- Unique constraint: one default per entity+image_type combination
CREATE UNIQUE INDEX idx_media_images_unique_default 
  ON media_images(entity_type, entity_id, image_type) 
  WHERE is_default = true;

-- Unique constraint: one user override per entity+image_type+user combination
CREATE UNIQUE INDEX idx_media_images_unique_user 
  ON media_images(entity_type, entity_id, image_type, user_id) 
  WHERE user_id IS NOT NULL;

-- Apply updated_at trigger
CREATE TRIGGER trigger_media_images_updated_at
  BEFORE UPDATE ON media_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE media_images IS 'Custom images for libraries, collections, and playlists';
COMMENT ON COLUMN media_images.entity_type IS 'Type of entity: library, collection, or playlist';
COMMENT ON COLUMN media_images.entity_id IS 'ID of the entity in the media server';
COMMENT ON COLUMN media_images.image_type IS 'Emby/Jellyfin image type: Primary, Backdrop, Banner, etc.';
COMMENT ON COLUMN media_images.is_default IS 'Admin-set default image (vs user override)';
COMMENT ON COLUMN media_images.file_path IS 'Path to image file relative to uploads directory';


