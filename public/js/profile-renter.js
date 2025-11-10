// public/js/profile-renter.js
// === ĐÃ REFACTOR (VAI TRÒ NGA - NGÀY 4) ===

/**
 * Hàm điền dữ liệu profile vào form
 * (Tách ra thành hàm riêng để dễ đọc)
 */
function populateProfileForm(profile) {
  // 1. Lấy các trường input
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const roleInput = document.getElementById("profile-role");
  const loadingDiv = document.getElementById("profile-loading");
  const profileForm = document.getElementById("profile-form");

  // 2. Điền thông tin vào form
  // (Dữ liệu profile trả về từ function 'get-user-profile')
  emailInput.value = profile.email || "Đang tải...";
  nameInput.value = profile.contactName || "";
  phoneInput.value = profile.phone || "";

  if (profile.role === "RENTER") {
    roleInput.value = "Người thuê";
  } else {
    roleInput.value = "Chưa xác định";
  }

  // 3. Hiển thị form và ẩn loading
  loadingDiv.style.display = "none";
  profileForm.style.display = "block";
}

/**
 * Hàm xử lý khi submit form
 */
async function handleProfileUpdate(e) {
  e.preventDefault();

  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const updateButton = document.getElementById("update-profile-btn");

  updateButton.disabled = true;
  updateButton.textContent = "Đang lưu...";

  const newName = nameInput.value;
  const newPhone = phoneInput.value;

  // 2. === REFACTOR: Gọi Edge Function "update-user-profile" ===
  // Thay thế cho 'supabase.auth.updateUser()'
  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST", // Method là POST (theo API_DOCS)
    body: {
      // Body là JSON (theo API_DOCS)
      contactName: newName,
      phone: newPhone,
    },
  });
  // === KẾT THÚC REFACTOR ===

  if (error) {
    alert("Cập nhật thất bại: " + error.message);
    console.error("Lỗi cập nhật:", error);
  } else {
    alert("Cập nhật hồ sơ thành công!");
    // Cập nhật lại form với dữ liệu mới (data.data là profile mới)
    populateProfileForm(data.data);
  }

  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}

/**
 * Hàm chạy chính khi DOM tải xong
 */
document.addEventListener("DOMContentLoaded", async () => {
  // 1. === REFACTOR: Gọi Edge Function "get-user-profile" ===
  // Thay thế cho 'supabase.auth.getUser()'
  console.log("Đang gọi get-user-profile...");
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET", // Method là GET (theo API_DOCS)
  });
  // === KẾT THÚC REFACTOR ===

  if (error) {
    console.error("Lỗi tải profile:", error);
    // auth-guard.js đã kiểm tra đăng nhập,
    // nên nếu lỗi ở đây, thường là lỗi 500
    alert("Không thể tải hồ sơ: " + error.message);
    document.getElementById("profile-loading").textContent = "Lỗi tải hồ sơ.";
    return;
  }

  // Lấy dữ liệu profile từ { data: { ...profile } }
  const userProfile = data.data;
  if (userProfile) {
    populateProfileForm(userProfile);
  }

  // 2. Gán sự kiện submit
  const profileForm = document.getElementById("profile-form");
  profileForm.addEventListener("submit", handleProfileUpdate);
});
