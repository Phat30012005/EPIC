// public/js/supabase-config.js

// === KHÓA PRODUCTION (TẠM ẨN ĐI) ===
// const SUPABASE_URL = 'https://dqjjvfsoxuhaykomyzwe.supabase.co';
// const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxamp2ZnNveHVoYXlrb215endlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MTU3NzEsImV4cCI6MjA3Nzk5MTc3MX0.GpLoCw9DuHSchofL7XMAlB8eWroJCm7AGWokkxFIVKQ';

// === KHÓA LOCAL (DÙNG ĐỂ TEST VỚI 'supabase start') ===
const SUPABASE_URL = "http://127.0.0.1:54321"; // Đây là URL của máy chủ Supabase local
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"; // Đây là key anon MẶC ĐỊNH cho local

// Khởi tạo một "client" (kết nối) Supabase duy nhất
supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// In ra Console để kiểm tra xem đã kết nối thành công chưa
console.log("✅ Supabase ĐÃ KHỞI TẠO VÀ KẾT NỐI (LOCAL)!");
