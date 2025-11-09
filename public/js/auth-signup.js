// public/js/auth-signup.js
// NỘI DUNG ĐÚNG CHO TRANG ĐĂNG KÝ
// === ĐÃ REFACTOR ĐỂ GỌI EDGE FUNCTION (NGÀY 2) ===

document.addEventListener("DOMContentLoaded", () => {
  const signInForm = document.getElementById("form-signin");

  if (signInForm) {
    signInForm.addEventListener("submit", async (event) => {
      event.preventDefault(); // Ngăn form tải lại trang

      // Lấy giá trị từ các trường
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirm-password").value;
      const contactName = document.getElementById("contactName").value;
      const phone = document.getElementById("phone").value;
      const selectedRoleInput = document.querySelector(
        'input[name="role"]:checked'
      );

      // 1. Kiểm tra mật khẩu có khớp không
      if (password !== confirmPassword) {
        alert("Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại.");
        return; // Dừng hàm
      }

      // 2. Kiểm tra đã chọn vai trò chưa
      if (!selectedRoleInput) {
        alert("Vui lòng chọn vai trò của bạn (Người cho thuê / Người thuê).");
        return; // Dừng hàm
      }

      const role = selectedRoleInput.value; // Lấy giá trị (LESSOR hoặc RENTER)

      // 3. === REFACTOR: Gọi Edge Function "user-signup" ===
      try {
        // Lấy URL của function từ supabase config
        const functionUrl = supabase.functions.url + "/user-signup";

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            password: password,
            contactName: contactName,
            phone: phone,
            role: role,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          // Nếu server trả về lỗi (vd: 400, 500)
          throw new Error(
            responseData.error || "Lỗi không xác định từ máy chủ"
          );
        }

        // Xử lý thành công
        console.log(
          "Đăng ký thành công (qua Edge Function):",
          responseData.data
        );
        alert("Đăng ký thành công! Vui lòng kiểm tra email để xác thực.");
        // Tự động chuyển về trang đăng nhập
        window.location.href = "/public/login.html";
      } catch (error) {
        // Bắt lỗi từ fetch hoặc lỗi (throw) ở trên
        console.error("Lỗi khi gọi Edge Function user-signup:", error.message);
        alert("Đăng ký thất bại: " + error.message);
      }
      // === KẾT THÚC REFACTOR ===
    });
  } else {
    console.error("Không tìm thấy #form-signin");
  }
});
