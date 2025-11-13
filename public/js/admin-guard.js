// public/js/admin-guard.js
// Script này bảo vệ trang admin
// (ĐÃ SỬA: Check 'role' thay vì email)

(async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    // 1. Nếu chưa đăng nhập
    alert("Bạn cần đăng nhập để truy cập trang này.");
    window.location.href = "/public/login.html";
    return; // Dừng script
  }

  // Lấy vai trò từ metadata (đã được lưu khi đăng nhập/đăng ký)
  const role = session.user.user_metadata.role;

  if (role !== "ADMIN") {
    // 2. Nếu đã đăng nhập nhưng không phải admin
    alert("Bạn không có quyền truy cập trang Quản trị.");
    window.location.href = "/public/index.html"; // Chuyển về trang chủ
    return; // Dừng script
  }

  // Nếu là admin, script không làm gì cả và trang admin tiếp tục tải
})();
