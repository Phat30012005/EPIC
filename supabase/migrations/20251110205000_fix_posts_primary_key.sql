-- supabase/migrations/20251110205000_fix_posts_primary_key.sql
    -- SỬA LỖI: Thay đổi Primary Key của bảng 'posts' từ (title, id) thành (id)

    -- 1. (AN TOÀN) Xóa Khóa Chính tổng hợp (composite key) CŨ
    -- (Dùng 'IF EXISTS' để tránh lỗi nếu đã xóa)
    ALTER TABLE public.posts
    DROP CONSTRAINT IF EXISTS posts_pkey;

    -- 2. (AN TOÀN) Thêm Khóa Chính MỚI chỉ trên cột 'id'
    -- (Trước tiên, đảm bảo 'id' chưa phải là pkey - mặc dù bước 1 đã drop)
    ALTER TABLE public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);