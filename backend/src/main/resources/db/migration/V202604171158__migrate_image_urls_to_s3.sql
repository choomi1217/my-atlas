-- Migrate image URLs from local API paths to S3 CloudFront paths
-- /api/convention-images/xxx.png → /images/convention/xxx.png
-- /api/feature-images/xxx.png → /images/feature/xxx.png
-- /api/kb/images/xxx.png → /images/kb/xxx.png

UPDATE convention
SET image_url = REPLACE(image_url, '/api/convention-images/', '/images/convention/')
WHERE image_url LIKE '/api/convention-images/%';

UPDATE test_case_image
SET filename = REPLACE(filename, '/api/feature-images/', '/images/feature/')
WHERE filename LIKE '/api/feature-images/%';

UPDATE knowledge_base
SET content = REPLACE(content, '/api/kb/images/', '/images/kb/')
WHERE content LIKE '%/api/kb/images/%';
