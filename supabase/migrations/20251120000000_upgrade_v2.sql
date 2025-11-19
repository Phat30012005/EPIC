-- supabase/migrations/20251120000000_upgrade_v2.sql

-- ============================================================
-- 1. CẬP NHẬT BẢNG POSTS (Thêm cột status)
-- ============================================================
-- Thêm cột status với mặc định là 'PENDING' (Chờ duyệt)
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING';

-- [QUAN TRỌNG - CHỐNG LỖI DOMINO]
-- Cập nhật ngay tất cả các bài đăng HIỆN CÓ thành 'APPROVED'
-- Để tránh việc chạy code xong toàn bộ tin trên web biến mất.
UPDATE public.posts 
SET status = 'APPROVED' 
WHERE status = 'PENDING';

-- Tạo Index cho cột status để query nhanh hơn (Chuẩn bị cho Phân trang)
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);


-- ============================================================
-- 2. CẬP NHẬT BẢNG PROFILES (Thêm cột is_banned)
-- ============================================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;


-- ============================================================
-- 3. CẬP NHẬT RLS (BẢO MẬT ROW LEVEL SECURITY)
-- ============================================================
-- Xóa Policy cũ (quá lỏng lẻo: ai cũng xem được hết)
DROP POLICY IF EXISTS "Public can read posts" ON public.posts;

-- Tạo Policy mới:
-- Khách vãng lai: Chỉ xem được tin APPROVED.
-- Chủ bài đăng (Lessor): Xem được tin của chính mình (dù là PENDING hay REJECTED).
CREATE POLICY "Public can read approved posts" 
ON public.posts
FOR SELECT 
USING (
  status = 'APPROVED' 
  OR 
  (auth.uid() = user_id)
);

-- (Giữ nguyên các Policy Insert/Delete cũ, không cần sửa)