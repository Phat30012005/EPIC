-- supabase/migrations/20251110210000_add_bookmarks_table.sql
    -- TẠO BẢNG 'bookmarks' VÀ KÍCH HOẠT RLS

    -- 1. Tạo bảng 'bookmarks'
    CREATE TABLE public.bookmarks (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        
        -- Khóa ngoại: liên kết với user
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        
        -- Khóa ngoại: liên kết với bài đăng
        post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE
    );

    -- 2. (Rất quan trọng) Tạo một ràng buộc 'UNIQUE'
    -- Ngăn user lưu cùng 1 bài đăng 2 lần
    ALTER TABLE public.bookmarks
    ADD CONSTRAINT unique_user_post_bookmark UNIQUE (user_id, post_id);

    -- 3. Kích hoạt Row Level Security (RLS)
    ALTER TABLE public.bookmarks
    ENABLE ROW LEVEL SECURITY;

    -- 4. Tạo Policy cho RLS
    -- User chỉ có thể xem, thêm, xóa bookmark CỦA CHÍNH MÌNH
    CREATE POLICY "User can manage their own bookmarks"
    ON public.bookmarks
    FOR ALL -- (Áp dụng cho SELECT, INSERT, UPDATE, DELETE)
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);