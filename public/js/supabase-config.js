// public/js/supabase-config.js
// CẤU HÌNH PRODUCTION (CHẠY TRÊN MẠNG)

// 1. Dán URL dự án Supabase của bạn vào đây
const SUPABASE_URL = "https://utlqebvridpmsxpgbmcg.supabase.co";

// 2. Dán khóa 'anon' (public) của bạn vào đây
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0bHFlYnZyaWRwbXN4cGdibWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Mjg1NjUsImV4cCI6MjA3OTIwNDU2NX0.PIjL1FF3fViZhwuM7rELJXxDSVbCEKSz18m7CW_Xo7A";

// 3. Khởi tạo client
// (Giữ nguyên logic này để tránh lỗi 'cannot access before init')
const globalSupabase = window.supabase;
const { createClient } = globalSupabase;

// Ghi đè biến global supabase
supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("✅ Supabase CLIENT ĐÃ KẾT NỐI TỚI CLOUD!");
