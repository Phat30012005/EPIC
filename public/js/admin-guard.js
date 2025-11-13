// public/js/admin-guard.js
(async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    if (window.showAlert) {
      window.showAlert("Bạn cần đăng nhập để truy cập trang này.");
    } else {
      alert("Bạn cần đăng nhập để truy cập trang này.");
    }
    window.location.href = "/public/login.html";
    return;
  }

  const role = session.user.user_metadata.role;

  if (role !== "ADMIN") {
    // Sửa: Dùng showAlert thay vì alert()
    if (window.showAlert) {
      window.showAlert("Bạn không có quyền truy cập trang Quản trị.");
    } else {
      alert("Bạn không có quyền truy cập trang Quản trị.");
    }
    window.location.href = "/public/index.html";
    return;
  }
})();
