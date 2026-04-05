-- Migration: 0105_remove_watching_strm_libraries
-- Description: Remove per-user Shows You Watch virtual STRM library rows and obsolete symlink setting

DELETE FROM strm_libraries WHERE library_type = 'watching';

DELETE FROM system_settings WHERE key = 'watching_library_use_symlinks';
