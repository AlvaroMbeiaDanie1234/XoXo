UPDATE public.posts SET content_url = REPLACE(content_url, 'https://vuyscgfbwhmqydeznphi.supabase.co', 'http://localhost:8000') WHERE content_url LIKE '%vuyscgfbwhmqydeznphi.supabase.co%';
UPDATE public.posts SET thumbnail_url = REPLACE(thumbnail_url, 'https://vuyscgfbwhmqydeznphi.supabase.co', 'http://localhost:8000') WHERE thumbnail_url LIKE '%vuyscgfbwhmqydeznphi.supabase.co%';

UPDATE public.profiles SET avatar_url = REPLACE(avatar_url, 'https://vuyscgfbwhmqydeznphi.supabase.co', 'http://localhost:8000') WHERE avatar_url LIKE '%vuyscgfbwhmqydeznphi.supabase.co%';

UPDATE public.messages SET file_url = REPLACE(file_url, 'https://vuyscgfbwhmqydeznphi.supabase.co', 'http://localhost:8000') WHERE file_url LIKE '%vuyscgfbwhmqydeznphi.supabase.co%';

UPDATE public.stories SET media_url = REPLACE(media_url, 'https://vuyscgfbwhmqydeznphi.supabase.co', 'http://localhost:8000') WHERE media_url LIKE '%vuyscgfbwhmqydeznphi.supabase.co%';

UPDATE public.system_announcements SET image_url = REPLACE(image_url, 'https://vuyscgfbwhmqydeznphi.supabase.co', 'http://localhost:8000') WHERE image_url LIKE '%vuyscgfbwhmqydeznphi.supabase.co%';
