// public/js/admin-guard.js
// Script này bảo vệ trang admin

(async () => {
  // Danh sách admin (giống hệt trong main.js)
  const ADMIN_EMAILS = [
      "phat30012005@gmail.com",
      "lethanhvy102005@gmail.com",
      "maib2308257@student.ctu.edu.vn",
      "ngab2308259@student.ctu.edu.vn",
      "tamb2308270@student.ctu.edu.vn"
  ];

  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    // 1. Nếu chưa đăng nhập
    alert('Bạn cần đăng nhập để truy cập trang này.');
    window.location.href = '/public/login.html';
    return; // Dừng script
  }

  if (!ADMIN_EMAILS.includes(session.user.email)) {
    // 2. Nếu đã đăng nhập nhưng không phải admin
    alert('Bạn không có quyền truy cập trang Quản trị.');
    window.location.href = '/public/index.html'; // Chuyển về trang chủ
    return; // Dừng script
  }
  
  // Nếu là admin, script không làm gì cả và trang admin tiếp tục tải
})();