-- supabase/migrations/20251125000000_advanced_search.sql

-- Hàm tìm kiếm chuyên sâu V3 (Kết hợp FTS và Lọc Giá)
CREATE OR REPLACE FUNCTION public.match_posts_advanced(
  p_keyword text DEFAULT NULL,
  p_max_price bigint DEFAULT NULL,
  p_limit int DEFAULT 5
)
RETURNS SETOF public.posts
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.posts
  WHERE 
    status = 'APPROVED'
    AND (
      -- 1. Lọc theo Giá (Nếu user không nhập giá -> p_max_price là NULL -> Bỏ qua điều kiện này)
      (p_max_price IS NULL OR price <= p_max_price)
    )
    AND (
      -- 2. Lọc theo Từ khóa (Nếu user không nhập từ khóa -> p_keyword là NULL -> Bỏ qua)
      (p_keyword IS NULL OR char_length(trim(p_keyword)) = 0)
      OR
      -- Dùng Full-Text Search (Thông minh hơn ILIKE nhiều: tự bỏ dấu, tự khớp từ gần đúng)
      (fts @@ websearch_to_tsquery('public.vietnamese', p_keyword))
      OR
      -- Fallback: Tìm chính xác trong tên đường hoặc phường (cho các từ viết tắt lạ)
      (address_detail ILIKE '%' || p_keyword || '%')
      OR
      (ward ILIKE '%' || p_keyword || '%')
    )
  ORDER BY 
    created_at DESC
  LIMIT p_limit;
END;
$$;