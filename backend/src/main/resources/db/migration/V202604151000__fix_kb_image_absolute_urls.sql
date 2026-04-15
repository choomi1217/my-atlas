-- Fix KB image URLs stored as absolute URLs by useImageUpload.ts
-- Convert http://localhost:XXXX/api/kb/images/ → /api/kb/images/
UPDATE knowledge_base
SET content = REGEXP_REPLACE(
  content, 'http://localhost:\d+(/api/kb/images/)', '\1', 'g'
)
WHERE content ~ 'http://localhost:\d+/api/kb/images/';

-- Fix production EC2 IP variant
UPDATE knowledge_base
SET content = REPLACE(content, 'http://3.34.154.147:8080/api/kb/images/', '/api/kb/images/')
WHERE content LIKE '%http://3.34.154.147:8080/api/kb/images/%';
