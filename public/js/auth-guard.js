// public/js/auth-guard.js
// Script này chạy ngay lập tức để bảo vệ trang
// Nó phải được tải SAU supabase-config.js

(async () => {
  // Lấy session hiện tại (rất nhanh vì đọc từ localStorage)
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    // Nếu không có session (chưa đăng nhập)
    alert('Bạn cần đăng nhập để truy cập trang này.');
    // Chuyển hướng về trang đăng nhập
    window.location.href = '/public/login.html';
  }
})();