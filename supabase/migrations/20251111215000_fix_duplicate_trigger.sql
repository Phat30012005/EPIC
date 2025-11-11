-- supabase/migrations/20251111215000_fix_duplicate_trigger.sql
-- File này xóa trigger "on_user_created" bị trùng lặp
-- (trigger này được tạo trong file ...105022_remote_commit.sql)

DROP TRIGGER IF EXISTS on_user_created ON auth.users;