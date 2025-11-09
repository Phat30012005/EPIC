// public/js/auth-login.js
// NỘI DUNG ĐÚNG CHO TRANG ĐĂNG NHẬP
// === ĐÃ REFACTOR ĐỂ GỌI EDGE FUNCTION (NGÀY 2) ===

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("form-login");

  if (!loginForm) {
    console.error("Lỗi: Không tìm thấy #form-login trong login.html");
    return;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Lấy nút submit và input
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    // Lấy giá trị
    const email = emailInput.value;
    const password = passwordInput.value;

    // Vô hiệu hóa nút để tránh click đúp
    submitButton.disabled = true;
    submitButton.textContent = "ĐANG TẢI...";

    // === REFACTOR: Gọi Edge Function "user-login" ===
    try {
      // Dùng fetch để gọi Edge Function "user-login"
      const functionUrl = supabase.functions.url + "/user-login";

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Lỗi từ Edge Function (vd: 400 - sai mật khẩu)
        throw new Error(responseData.error || "Lỗi đăng nhập");
      }

      // === SỬA LỖI (Auth session missing): ===
      // Backend trả về { data: { user, session } }
      // Chúng ta cần truyền responseData.data.session vào hàm setSession
      const { data, error: sessionError } = await supabase.auth.setSession(
        responseData.data.session
      );

      if (sessionError) {
        // Lỗi này xảy ra ở phía client
        throw new Error("Lỗi khi lưu session: " + sessionError.message);
      }

      console.log("Đăng nhập thành công (qua Edge Function):", data.user.email);
      alert("Đăng nhập thành công! Đang chuyển về trang chủ...");
      // Chuyển hướng về trang chủ
      window.location.href = "/public/index.html";
    } catch (exception) {
      // Bắt tất cả các lỗi (từ fetch, setSession, hoặc throw)
      console.error("Lỗi hệ thống khi đăng nhập:", exception);
      alert("Đã xảy ra lỗi: " + exception.message);
    } finally {
      // Kích hoạt lại nút dù thành công hay thất bại
      submitButton.disabled = false;
      submitButton.textContent = "Đăng nhập";
    }
    // === KẾT THÚC REFACTOR ===
  });
});
