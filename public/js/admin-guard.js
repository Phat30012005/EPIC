// public/js/admin-guard.js
(async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    alert("Bạn cần đăng nhập để truy cập trang này.");
    window.location.href = "/public/login.html";
    return;
  }

  // Gọi API check role chuẩn từ Database
  // (Lưu ý: callEdgeFunction phải có sẵn từ api-client.js)
  try {
    const { data: profile, error: profileError } = await callEdgeFunction(
      "get-user-profile",
      { method: "GET" }
    );

    if (profileError || !profile || profile.role !== "ADMIN") {
      alert("Bạn không có quyền truy cập trang Quản trị.");
      window.location.href = "/public/index.html";
      return;
    }

    // Nếu là ADMIN thì không làm gì cả (cho phép ở lại trang)
    console.log("Admin access granted.");
  } catch (err) {
    console.error("Lỗi kiểm tra quyền admin:", err);
    window.location.href = "/public/index.html";
  }
})();
