/* =======================================
   --- FILE: public/js/auth-reset.js ---
   ======================================= */

document.addEventListener("DOMContentLoaded", () => {
  // --- LOGIC 1: TRANG QUÊN MẬT KHẨU (forgot-password.html) ---
  const forgotForm = document.getElementById("form-forgot");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = forgotForm.querySelector("button");
      const email = document.getElementById("forgot-email").value;

      btn.disabled = true;
      btn.textContent = "Đang gửi...";

      try {
        // Gửi mail reset password
        // redirectTo: URL mà người dùng sẽ được chuyển đến khi click link trong mail
        const redirectUrl = window.location.origin + "/update-password.html";

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });

        if (error) throw error;

        alert("Đã gửi link khôi phục! Vui lòng kiểm tra email của bạn.");
      } catch (error) {
        console.error(error);
        alert("Lỗi: " + error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Gửi link khôi phục";
      }
    });
  }

  // --- LOGIC 2: TRANG CẬP NHẬT MẬT KHẨU (update-password.html) ---
  const updatePassForm = document.getElementById("form-update-pass");
  if (updatePassForm) {
    // Khi vào trang này, Supabase tự động phát hiện token trên URL và đăng nhập session
    // Ta chỉ cần gọi updateUser để đổi pass

    updatePassForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = updatePassForm.querySelector("button");
      const newPass = document.getElementById("new-password").value;
      const confirmPass = document.getElementById("confirm-new-password").value;

      if (newPass !== confirmPass) {
        alert("Mật khẩu nhập lại không khớp!");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Đang lưu...";

      try {
        const { error } = await supabase.auth.updateUser({
          password: newPass,
        });

        if (error) throw error;

        alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");

        // Đăng xuất khỏi session tạm này để bắt user đăng nhập lại cho an toàn
        await supabase.auth.signOut();
        window.location.href = "/login.html";
      } catch (error) {
        console.error(error);
        alert("Lỗi đổi mật khẩu: " + error.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Lưu mật khẩu";
      }
    });
  }
});
