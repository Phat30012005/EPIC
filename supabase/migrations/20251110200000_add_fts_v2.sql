-- supabase/migrations/20251110200000_add_fts_v2.sql
-- PHIÊN BẢN 2 - SỬA LỖI FTS TIẾNG VIỆT

-- 1. Kích hoạt extension 'unaccent' (Quan trọng)
-- (Giúp bỏ dấu tiếng Việt, vd: "trọ" -> "tro", "rẻ" -> "re")
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Tạo một cấu hình tìm kiếm 'vietnamese' mới
-- (Bằng cách copy cấu hình 'simple' và thêm 'unaccent' vào)
CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS public.vietnamese (COPY = pg_catalog.simple);
ALTER TEXT SEARCH CONFIGURATION public.vietnamese
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, simple;

-- === KẾT THÚC SỬA LỖI ===


-- 3. Thêm một cột 'fts' (Full-Text Search) vào bảng 'posts'
ALTER TABLE public.posts
ADD COLUMN fts tsvector;

-- 4. Tạo một HÀM (function) để tự động cập nhật cột 'fts'
CREATE OR REPLACE FUNCTION update_posts_fts_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fts :=
        setweight(to_tsvector('public.vietnamese', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('public.vietnamese', COALESCE(NEW.motelName, '')), 'B') ||
        setweight(to_tsvector('public.vietnamese', COALESCE(NEW.description, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Tạo một TRIGGER (kích hoạt)
CREATE TRIGGER posts_fts_update_trigger
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION update_posts_fts_column();

-- 6. Tạo một INDEX (chỉ mục) GIN trên cột 'fts'
CREATE INDEX posts_fts_idx ON public.posts USING GIN (fts);

-- 7. Cập nhật lại tất cả các hàng hiện có (chỉ chạy 1 lần)
UPDATE public.posts SET fts = 
    setweight(to_tsvector('public.vietnamese', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('public.vietnamese', COALESCE(motelName, '')), 'B') ||
    setweight(to_tsvector('public.vietnamese', COALESCE(description, '')), 'C');