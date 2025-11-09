// public/js/supabase-config.js
// CẤU HÌNH ĐỂ CHẠY LOCAL (NGÀY 2)
// === ĐÃ SỬA LỖI "Cannot access 'supabase' before initialization" ===

// === KHÓA PRODUCTION (TẠM ẨN ĐI) ===
// const SUPABASE_URL = 'https://dqjjvfsoxuhaykomyzwe.supabase.co';
// const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxamp2ZnNveHVoYXlrb215endlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MTU3NzEsImV4cCI6MjA3Nzk5MTc3MX0.GpLoCw9DuHSchofL7XMAlB8eWroJCm7AGWokkxFIVKQ';

// === KHÓA LOCAL (BẮT BUỘC DÙNG KHI TEST VỚI 'supabase start') ===
// URL này được cung cấp khi bạn chạy 'supabase start'
const SUPABASE_URL = "http://127.0.0.1:54321";
// Đây là key anon MẶC ĐỊNH cho local, an toàn để sử dụng
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIZDAiLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// === PHẦN SỬA LỖI ===
// 1. Lấy hàm 'createClient' từ thư viện 'supabase' global (đã được tải từ CDN)
// Dùng 'globalSupabase' để tránh xung đột tên
const globalSupabase = window.supabase;
const { createClient } = globalSupabase;

// 2. Khởi tạo client VÀ GHI ĐÈ biến global 'supabase'
// KHÔNG DÙNG 'const' hay 'let' để đảm bảo ta đang thay đổi biến global,
// chứ không phải tạo ra một biến local mới.
supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// === KẾT THÚC PHẦN SỬA LỖI ===

// In ra Console để kiểm tra xem đã kết nối thành công chưa
console.log("✅ Supabase CLIENT INSTANCE ĐÃ KHỞI TẠO (LOCAL)!");
