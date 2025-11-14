-- supabase/migrations/20251115000000_add_roommate_bookmarks.sql
-- (Thêm bảng mới để lưu các tin "ở ghép")

-- Bảng (5): ROOMMATE_BOOKMARKS
CREATE TABLE public.roommate_bookmarks (
    bookmark_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    
    -- (Tham chiếu đến người dùng)
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, 
    
    -- (SỬA) Tham chiếu đến bảng 'roommate_postings'
    posting_id uuid NOT NULL REFERENCES public.roommate_postings(posting_id) ON DELETE CASCADE,
    
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Đảm bảo user không thể lưu 1 tin 2 lần
    CONSTRAINT unique_user_roommate_post_bookmark UNIQUE (user_id, posting_id)
);

-- Kích hoạt RLS
ALTER TABLE public.roommate_bookmarks ENABLE ROW LEVEL SECURITY;

-- Thêm Policies (RLS)
-- (Copy logic từ bảng 'bookmarks')
-- Chính sách này cho phép user:
-- 1. Tự TẠO (INSERT) bookmark
-- 2. Tự XEM (SELECT) bookmark CỦA MÌNH
-- 3. Tự XÓA (DELETE) bookmark CỦA MÌNH
CREATE POLICY "User can manage their own roommate bookmarks"
  ON public.roommate_bookmarks
  FOR ALL -- (Bao gồm SELECT, INSERT, DELETE, UPDATE)
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );