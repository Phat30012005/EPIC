// public/js/auth-guard.js
(async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session) {
    // Sửa: Dùng showAlert thay vì alert()
    if (window.showAlert) {
      window.showAlert("Bạn cần đăng nhập để truy cập trang này.");
    } else {
      alert("Bạn cần đăng nhập để truy cập trang này.");
    }
    // Chuyển hướng về trang đăng nhập
    window.location.href = "/login.html";
  }
})();
