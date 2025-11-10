-- supabase/migrations/20251110191000_add_fts_to_posts.sql
-- === SỬA LỖI: Bổ sung cài đặt FTS Tiếng Việt ===

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
-- (Đổi từ '1.' trong file cũ thành '3.' ở file mới)
ALTER TABLE public.posts
ADD COLUMN fts tsvector;

-- 4. Tạo một HÀM (function) để tự động cập nhật cột 'fts'
-- (Sửa 'vietnamese' thành 'public.vietnamese' để rõ ràng hơn)
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
-- Đây là bước TỐI QUAN TRỌNG để tăng tốc độ tìm kiếm
CREATE INDEX posts_fts_idx ON public.posts USING GIN (fts);

-- 7. Cập nhật lại tất cả các hàng hiện có (chỉ chạy 1 lần)
-- (Sửa 'vietnamese' thành 'public.vietnamese')
UPDATE public.posts SET fts = 
    setweight(to_tsvector('public.vietnamese', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('public.vietnamese', COALESCE(motelName, '')), 'B') ||
    setweight(to_tsvector('public.vietnamese', COALESCE(description, '')), 'C');