CREATE OR REPLACE FUNCTION public.match_posts_smart(
  p_keyword text DEFAULT NULL,
  p_min_price bigint DEFAULT NULL,
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
    AND (p_min_price IS NULL OR price >= p_min_price)
    AND (p_max_price IS NULL OR price <= p_max_price)
    AND (
      -- Nếu không có từ khóa hoặc từ khóa rỗng -> Bỏ qua lọc text
      p_keyword IS NULL OR trim(p_keyword) = ''
      OR
      -- Tìm kiếm thông minh (ILIKE)
      title ILIKE '%' || p_keyword || '%'
      OR
      "motelName" ILIKE '%' || p_keyword || '%'
      OR
      ward ILIKE '%' || p_keyword || '%'
      OR
      address_detail ILIKE '%' || p_keyword || '%'
    )
  ORDER BY created_at DESC
  LIMIT p_limit;
END;
$$;