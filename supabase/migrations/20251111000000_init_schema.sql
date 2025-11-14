-- supabase/migrations/20251111000000_init_schema.sql
-- FILE MÓNG NHÀ (V5 - SỬA LỖI FK CỦA REVIEWS VÀ BOOKMARKS)

-- === PHẦN 1: EXTENSIONS ===
CREATE EXTENSION IF NOT EXISTS unaccent;

-- === PHẦN 2: TÌM KIẾM (CÀI ĐẶT) ===
CREATE TEXT SEARCH CONFIGURATION public.vietnamese (COPY = pg_catalog.simple);
ALTER TEXT SEARCH CONFIGURATION public.vietnamese
    ALTER MAPPING FOR hword, hword_part, word
    WITH unaccent, simple;


-- === PHẦN 3: TẠO BẢNG ===

-- Bảng (1): PROFILES (PHẢI TẠO TRƯỚC)
CREATE TABLE public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text,
    full_name text,
    phone_number text,
    role text,
    avatar_url text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Bảng (2): POSTS
CREATE TABLE public.posts (
    post_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,

    title text NOT NULL,
    "motelName" text NOT NULL,
    description text,
    price bigint,
    area numeric,
    rooms integer,
    room_type text,

    ward text,
    address_detail text,
    image_urls text[] NOT NULL,
    highlights text[]
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Bảng (3): BOOKMARKS (SỬA LỖI V5)
CREATE TABLE public.bookmarks (
    bookmark_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    -- (SỬA LỖI: Tham chiếu trực tiếp tới public.profiles(id))
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, 
    post_id uuid NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unique_user_post_bookmark UNIQUE (user_id, post_id)
);
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Bảng (4): REVIEWS (SỬA LỖI V5)
CREATE TABLE public.reviews (
    review_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    -- (SỬA LỖI: Tham chiếu trực tiếp tới public.profiles(id))
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, 
    post_id uuid NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text NOT NULL CHECK (char_length(comment) > 0),
    CONSTRAINT unique_user_post_review UNIQUE (user_id, post_id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Bảng (5): ROOMMATE_POSTINGS (CHO TÍNH NĂNG Ở GHÉP)
CREATE TABLE public.roommate_postings (
    posting_id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,

    title text NOT NULL,
    description text,
    posting_type text, -- 'OFFERING' hoặc 'SEEKING'
    ward text NOT NULL,
    price bigint NOT NULL,
    gender_preference text, -- 'Nam', 'Nữ', 'Không yêu cầu'
    status text DEFAULT 'OPEN'::text -- 'OPEN' hoặc 'CLOSED'
);
ALTER TABLE public.roommate_postings ENABLE ROW LEVEL SECURITY;

-- === PHẦN 4: TRIGGER (TỰ ĐỘNG SAO CHÉP USER MỚI) ===
-- (Không thay đổi)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone_number, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data ->> 'contactName',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'role'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- === PHẦN 5: POLICIES (QUY TẮC BẢO MẬT RLS) ===
-- (Không thay đổi, các policy 'auth.uid() = user_id' vẫn đúng)

-- Policies cho PROFILES:
CREATE POLICY "Public can read profiles" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policies cho POSTS:
CREATE POLICY "Public can read posts" ON public.posts
  FOR SELECT USING (true);
CREATE POLICY "LESSORs can insert posts" ON public.posts
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'LESSOR'
  );
CREATE POLICY "Users can delete their own posts" ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

-- Policies cho BOOKMARKS:
CREATE POLICY "User can manage their own bookmarks" ON public.bookmarks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies cho REVIEWS:
CREATE POLICY "Public can read reviews" ON public.reviews
  FOR SELECT USING (true);
CREATE POLICY "RENTERs can insert reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'RENTER'
  );
CREATE POLICY "Users can update their own reviews" ON public.reviews
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); 
CREATE POLICY "Users can delete their own reviews" ON public.reviews
  FOR DELETE USING (auth.uid() = user_id);

-- Policies cho ROOMMATE_POSTINGS:
CREATE POLICY "Public can read roommate postings" ON public.roommate_postings
  FOR SELECT USING (true);

CREATE POLICY "RENTERs can insert roommate postings" ON public.roommate_postings
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'RENTER'
  );

CREATE POLICY "Users/Admins can delete roommate postings" ON public.roommate_postings
  FOR DELETE USING (
    (auth.uid() = user_id) OR
    ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'::text)
  );

-- === PHẦN 6: TÌM KIẾM (ÁP DỤNG) ===
-- (Không thay đổi)

ALTER TABLE public.posts
ADD COLUMN fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('public.vietnamese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('public.vietnamese', coalesce("motelName", '')), 'B') ||
    setweight(to_tsvector('public.vietnamese', coalesce(description, '')), 'C')
) STORED;

CREATE OR REPLACE FUNCTION public.search_posts_v2(search_term text)
RETURNS SETOF posts
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.posts
    WHERE
        public.posts.fts @@ websearch_to_tsquery('public.vietnamese', search_term)
    ORDER BY
        ts_rank(public.posts.fts, websearch_to_tsquery('public.vietnamese', search_term)) DESC;
END;
$$;

CREATE INDEX posts_fts_idx ON public.posts USING GIN (fts);


-- === PHẦN 7: STORAGE POLICIES ===
-- (Không thay đổi)

-- === TẠO BUCKET (TỰ ĐỘNG) ===
-- (Tên 'post-images' phải khớp với các policy bên dưới và code function của bạn)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING; -- Bỏ qua nếu bucket đã tồn tại

CREATE POLICY "Allow public read on post-images"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
USING (
  (bucket_id = 'post-images'::text) AND
  ((storage.foldername(name))[1] = 'public'::text)
);

CREATE POLICY "Allow public upload on post-images"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR INSERT
  TO PUBLIC
WITH CHECK (
  (bucket_id = 'post-images'::text) AND
  (storage.extension(name) = ANY (ARRAY['png'::text, 'jpg'::text, 'jpeg'::text, 'webp'::text])) AND
  ((storage.foldername(name))[1] = 'public'::text)
);