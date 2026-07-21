UPDATE storage.objects SET metadata = jsonb_set(metadata, '{mimetype}', '"video/webm"') WHERE name ILIKE '%.webm';
UPDATE storage.objects SET metadata = jsonb_set(metadata, '{mimetype}', '"video/quicktime"') WHERE name ILIKE '%.mov';
UPDATE storage.objects SET metadata = jsonb_set(metadata, '{mimetype}', '"video/quicktime"') WHERE name ILIKE '%.MOV';
UPDATE storage.objects SET metadata = jsonb_set(metadata, '{mimetype}', '"image/heic"') WHERE name ILIKE '%.heic';
UPDATE storage.objects SET metadata = jsonb_set(metadata, '{mimetype}', '"image/heic"') WHERE name ILIKE '%.heif';
