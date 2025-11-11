-- supabase/migrations/20251111090000_add_reviews_table.sql
-- TẠO BẢNG 'reviews' VÀ CÁC CHÍNH SÁCH BẢO MẬT (RLS)

-- 1. Tạo bảng 'reviews'
CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Khóa ngoại: liên kết với user
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Khóa ngoại: liên kết với bài đăng
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    
    -- Dữ liệu đánh giá
    rating int NOT NULL CHECK (rating >= 1 AND rating <= 5), -- Bắt buộc 1-5 sao
    comment text NOT NULL CHECK (char_length(comment) > 0) -- Bắt buộc phải có bình luận
);

-- 2. (Rất quan trọng) Tạo ràng buộc 'UNIQUE'
-- Ngăn 1 user gửi 2 đánh giá cho cùng 1 bài đăng (chống spam)
ALTER TABLE public.reviews
ADD CONSTRAINT unique_user_post_review UNIQUE (user_id, post_id);

-- 3. Kích hoạt Row Level Security (RLS)
ALTER TABLE public.reviews
ENABLE ROW LEVEL SECURITY;

-- 4. Tạo các Policy (Chính sách bảo mật)

-- CHÍNH SÁCH 1: AI CŨNG CÓ THỂ XEM (SELECT)
CREATE POLICY "Public can read all reviews"
ON public.reviews
FOR SELECT
USING (true); -- true = cho phép

-- CHÍNH SÁCH 2: USER ĐÃ ĐĂNG NHẬP CÓ THỂ THÊM (INSERT)
CREATE POLICY "Users can insert their own reviews"
ON public.reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id); -- Chỉ cho phép nếu user_id == user ID của token

-- CHÍNH SÁCH 3: USER CÓ THỂ SỬA (UPDATE) ĐÁNH GIÁ CỦA MÌNH
CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- CHÍNH SÁCH 4: USER CÓ THỂ XÓA (DELETE) ĐÁNH GIÁ CỦA MÌNH
CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
USING (auth.uid() = user_id);