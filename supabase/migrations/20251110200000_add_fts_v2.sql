-- === FILE MIGRATION V2 (AN TOÀN & ĐÃ SỬA LỖI "motelName") ===

-- 1. Kích hoạt extension 'unaccent' (Giúp bỏ dấu)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Xóa cấu hình 'vietnamese' cũ (nếu có) để tạo lại
DROP TEXT SEARCH CONFIGURATION IF EXISTS public.vietnamese;

-- 3. Tạo cấu hình 'vietnamese' mới
CREATE TEXT SEARCH CONFIGURATION public.vietnamese (COPY = pg_catalog.simple);

ALTER TEXT SEARCH CONFIGURATION public.vietnamese
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, simple;

-- 4. (AN TOÀN) Thêm cột 'fts' (nếu chưa có)
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS fts tsvector;

-- 5. (AN TOÀN) Tạo HÀM (dùng 'OR REPLACE')
-- (SỬA LỖI: Thêm dấu "..." cho NEW."motelName")
CREATE OR REPLACE FUNCTION update_posts_fts_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fts :=
        setweight(to_tsvector('public.vietnamese', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('public.vietnamese', COALESCE(NEW."motelName", '')), 'B') || -- <--- SỬA Ở ĐÂY
        setweight(to_tsvector('public.vietnamese', COALESCE(NEW.description, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. (AN TOÀN) Xóa Trigger cũ (nếu có) trước khi tạo
DROP TRIGGER IF EXISTS posts_fts_update_trigger ON public.posts;

-- 7. (AN TOÀN) Tạo Trigger mới
CREATE TRIGGER posts_fts_update_trigger
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION update_posts_fts_column();

-- 8. (AN TOÀN) Xóa Index cũ (nếu có) trước khi tạo
DROP INDEX IF EXISTS public.posts_fts_idx;

-- 9. (AN TOÀN) Tạo Index mới
CREATE INDEX posts_fts_idx ON public.posts USING GIN (fts);

-- 10. (AN TOÀN) Cập nhật lại tất cả các hàng hiện có
-- (SỬA LỖI: Thêm dấu "..." cho "motelName")
UPDATE public.posts SET fts = 
    setweight(to_tsvector('public.vietnamese', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('public.vietnamese', COALESCE("motelName", '')), 'B') || -- <--- SỬA Ở ĐÂY
    setweight(to_tsvector('public.vietnamese', COALESCE(description, '')), 'C')
WHERE fts IS NULL; -- Chỉ cập nhật những hàng chưa có FTS