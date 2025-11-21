-- supabase/migrations/20251122000000_chat_system.sql

-- 1. Tạo bảng lưu tin nhắn (Support Chat)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL CHECK (char_length(content) > 0),
    is_bot boolean DEFAULT false, -- true: Tin của Bot, false: Tin của User
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Bật Row Level Security (Bảo mật)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 3. Tạo Policies (Quy tắc ai được làm gì)
-- User chỉ được xem tin nhắn của chính mình
CREATE POLICY "Users can view their own chat history"
ON public.chat_messages
FOR SELECT
USING (auth.uid() = user_id);

-- User được phép gửi tin nhắn (nhưng không được giả danh Bot)
CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (
    auth.uid() = user_id 
    AND is_bot = false -- User không thể tự gửi tin nhắn với tư cách Bot
);

-- (Tùy chọn) Admin có thể xem tất cả tin nhắn để hỗ trợ
CREATE POLICY "Admins can view all chats"
ON public.chat_messages
FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- 4. KÍCH HOẠT REALTIME (QUAN TRỌNG CHO CHAT)
-- Cho phép Supabase gửi sự kiện realtime khi có tin nhắn mới
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;