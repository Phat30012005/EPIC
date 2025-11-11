-- === FILE MÓNG NHÀ "XỊN" (ĐÃ DỌN SẠCH 100%) ===
-- (File: ...105022_remote_commit.sql)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

-- Mấy cái "linh tinh" (Extensions)
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

-- =================================================================
-- HÀM "handle_new_user" (Hàm này "xịn" rồi, giữ nguyên)
-- =================================================================
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$BEGIN
INSERT INTO public.profiles (id, full_name, phone_number, role, email)
VALUES (
  NEW.id, 
  NEW.raw_user_meta_data->>'contactName',
  NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'role',
    NEW.email
  );
  RETURN NEW;
END;$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";
-- =================================================================

SET default_tablespace = '';
SET default_table_access_method = "heap";

-- === TẠO BẢNG "posts" ===
CREATE TABLE IF NOT EXISTS "public"."posts" (
    "title" "text" NOT NULL,
    "motelName" "text" NOT NULL,
    "price" bigint,
    "area" numeric,
    "rooms" integer,
    "ward" "text",
    "address" "text",
    "description" "text",
    "highlights" "text"[] NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"(),
    "room_type" "text",
    "email" "text",
    "contactName" "text",
    "phone" "text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "image_url" "text"[] NOT NULL
);
ALTER TABLE "public"."posts" OWNER TO "postgres";

-- === TẠO BẢNG "profiles" ===
CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone_number" "text",
    "role" "text",
    "full_name" "text",
    "email" "text"
);
ALTER TABLE "public"."profiles" OWNER TO "postgres";

-- === KHÓA CHÍNH (ĐÃ SỬA LỖI) ===
-- (KHÓA CHÍNH "posts" PHẢI LÀ "id" CHỨ KHÔNG PHẢI "title, id")
ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

-- === (BỔ SUNG) KHÓA NGOẠI (Rất quan trọng) ===
-- (Nối "profiles" với "auth.users" -> Ai xóa "auth" thì "profile" bay)
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- (Nối "posts" với "profiles" -> Ai xóa "profile" thì "post" bay)
ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
-- ==================================================

-- === POLICY (Chính sách) CHO BẢNG "posts" ===
-- (Tui dọn dẹp, bỏ 2 cái "dư" và "mâu thuẫn" của ný)
ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow LESSOR to insert" ON "public"."posts" FOR INSERT 
  WITH CHECK ((( SELECT "profiles"."role"
    FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'LESSOR'::"text"));

CREATE POLICY "Allow owners to delete" ON "public"."posts" 
  FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Allow public read access" ON "public"."posts" 
  FOR SELECT USING (true);

-- === POLICY (Chính sách) CHO BẢNG "profiles" ===
-- (Tui XÓA SẠCH mấy cái Policy "lỗi" của ný trong file này)
-- (Vì ný đã có 4 Policy "xịn" ở file "save" MỚI NHẤT rồi!)
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
-- (Để file "save" mới nhất của ný lo 4 cái Policy "xịn" kia)

-- ==================================================
-- (Mấy cái "GRANT" linh tinh - Giữ nguyên)
-- ==================================================
ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
-- ==================================================

-- === TRIGGER (Kích hoạt) ===
-- (Trigger này "xịn", giữ nguyên)
CREATE TRIGGER on_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === POLICY CHO STORAGE (Bucket) ===
-- (Mấy cái này "xịn", giữ nguyên)
CREATE POLICY "Allow public read"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
USING (((bucket_id = 'post-images'::text) AND ((storage.foldername(name))[1] = 'public'::text)));

CREATE POLICY "Allow public upload"
  ON "storage"."objects"
  AS PERMISSIVE
  FOR INSERT
  TO PUBLIC
WITH CHECK (((bucket_id = 'post-images'::text) AND (storage.extension(name) = ANY (ARRAY['png'::text, 'jpg'::text, 'jpeg'::text, 'webp'::text])) AND ((storage.foldername(name))[1] = 'public'::text)));

-- === HẾT FILE ===