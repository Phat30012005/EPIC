-- supabase/migrations/20251110191000_add_fts_to_posts.sql
-- File này thiết lập Full-Text Search (FTS) cho tiếng Việt

-- 1. Thêm một cột 'fts' (Full-Text Search) vào bảng 'posts'
-- Cột này sẽ lưu trữ phiên bản "đã xử lý" của text để tìm kiếm
ALTER TABLE public.posts
ADD COLUMN fts tsvector;

-- 2. Tạo một HÀM (function) để tự động cập nhật cột 'fts'
-- Hàm này sẽ lấy title, motelName, và description,
-- gộp chúng lại và chuyển thành 'tsvector'
CREATE OR REPLACE FUNCTION update_posts_fts_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fts :=
        setweight(to_tsvector('vietnamese', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('vietnamese', COALESCE(NEW.motelName, '')), 'B') ||
        setweight(to_tsvector('vietnamese', COALESCE(NEW.description, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Tạo một TRIGGER (kích hoạt)
-- Trigger này sẽ tự động gọi hàm 'update_posts_fts_column'
-- MỖI KHI một bài đăng được TẠO MỚI (INSERT) hoặc CẬP NHẬT (UPDATE)
CREATE TRIGGER posts_fts_update_trigger
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION update_posts_fts_column();

-- 4. Tạo một INDEX (chỉ mục) GIN trên cột 'fts'
-- Đây là bước TỐI QUAN TRỌNG để tăng tốc độ tìm kiếm
CREATE INDEX posts_fts_idx ON public.posts USING GIN (fts);

-- 5. Cập nhật lại tất cả các hàng hiện có (chỉ chạy 1 lần)
-- (Nếu bạn đã có dữ liệu trong bảng 'posts', lệnh này sẽ cập nhật FTS cho chúng)
UPDATE public.posts SET fts = 
    setweight(to_tsvector('vietnamese', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('vietnamese', COALESCE(motelName, '')), 'B') ||
    setweight(to_tsvector('vietnamese', COALESCE(description, '')), 'C');