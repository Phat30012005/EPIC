// public/js/supabase-config.js

// Lấy URL và Key từ Team Lead của bạn
const SUPABASE_URL = 'https://dqjjvfsoxuhaykomyzwe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxamp2ZnNveHVoYXlrb215endlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0MTU3NzEsImV4cCI6MjA3Nzk5MTc3MX0.GpLoCw9DuHSchofL7XMAlB8eWroJCm7AGWokkxFIVKQ';

// Khởi tạo một "client" (kết nối) Supabase duy nhất
// Chúng ta dùng "supabase" (chữ thường) để gọi trong các file khác
supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// In ra Console để kiểm tra xem đã kết nối thành công chưa
console.log('✅ Supabase ĐÃ KHỞI TẠO VÀ KẾT NỐI!');