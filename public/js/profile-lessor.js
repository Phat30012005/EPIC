// public/js/profile-lessor.js
// === ĐÃ REFACTOR (VAI TRÒ NGA - NGÀY 4) ===

// ===========================================
// PHẦN XỬ LÝ HỒ SƠ (Giống profile-renter.js)
// ===========================================

/**
 * Hàm điền dữ liệu profile vào form
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
  emailInput.value = profile.email || "Đang tải...";
  nameInput.value = profile.contactName || "";
  phoneInput.value = profile.phone || "";

  if (profile.role === "LESSOR") {
    roleInput.value = "Người cho thuê";
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
  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST",
    body: {
      contactName: newName,
      phone: newPhone,
    },
  });
  // === KẾT THÚC REFACTOR ===

  if (error) {
    alert("Cập nhật thất bại: " + error.message);
  } else {
    alert("Cập nhật hồ sơ thành công!");
    populateProfileForm(data.data);
  }

  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}

// ===========================================
// PHẦN XỬ LÝ TIN ĐĂNG (Dành riêng cho chủ trọ)
// ===========================================

/**
 * Hàm render danh sách tin đăng của chủ trọ
 */
function renderMyPosts(posts) {
  const postsList = document.getElementById("my-posts-list");
  const loadingDiv = document.getElementById("my-posts-loading");

  postsList.innerHTML = ""; // Xóa

  if (!posts || posts.length === 0) {
    loadingDiv.textContent = "Bạn chưa đăng tin nào.";
    return;
  }

  loadingDiv.style.display = "none"; // Ẩn loading

  posts.forEach((post) => {
    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded";
    postDiv.innerHTML = `
            <div>
                <a href="/public/chitiet.html?id=${
                  post.id
                }" class="fw-bold text-primary" target="_blank">${
      post.title
    }</a>
                <p class="mb-0 text-muted">${post.price.toLocaleString()} đ/tháng - ${
      post.ward
    }</p>
            </div>
            <div>
                <button class"btn btn-sm btn-danger delete-post-btn" data-id="${
                  post.id
                }">Xóa</button>
            </div>
        `;
    postsList.appendChild(postDiv);
  });

  // Thêm sự kiện cho tất cả các nút xóa
  addDeleteListeners();
}

/**
 * Hàm gán sự kiện cho các nút xóa
 */
function addDeleteListeners() {
  const postsList = document.getElementById("my-posts-list");

  postsList.querySelectorAll(".delete-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;

      // Sử dụng hàm confirm tùy chỉnh (từ main.js)
      showConfirm("Bạn có chắc muốn xóa tin này?", async () => {
        // === REFACTOR: Gọi Edge Function "delete-post" ===
        // Thay thế cho 'supabase.from('posts').delete()'
        const { data, error } = await callEdgeFunction("delete-post", {
          method: "DELETE", // Method là DELETE (theo API_DOCS)
          params: { id: id }, // Gửi ID qua query param (theo API_DOCS)
        });
        // === KẾT THÚC REFACTOR ===

        if (error) {
          alert("Lỗi khi xóa: " + error.message);
        } else {
          alert("Xóa thành công!");
          // Xóa phần tử khỏi UI mà không cần tải lại trang
          e.target.closest(".d-flex").remove();
        }
      });
    });
  });
}

/**
 * Hàm tải tin đăng của người dùng
 */
async function loadMyPosts() {
  // === REFACTOR: Gọi Edge Function "get-lessor-posts" ===
  // Thay thế cho 'supabase.from('posts').select().eq('user_id', ...)'
  const { data, error } = await callEdgeFunction("get-lessor-posts", {
    method: "GET",
  });
  // === KẾT THÚC REFACTOR ===

  if (error) {
    console.error("Lỗi tải tin đăng:", error);
    document.getElementById("my-posts-loading").textContent =
      "Lỗi khi tải tin đăng.";
  } else {
    // data.data là mảng bài đăng
    renderMyPosts(data.data);
  }
}

// ===========================================
// HÀM CHẠY CHÍNH
// ===========================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. === REFACTOR: Gọi Edge Function "get-user-profile" ===
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET",
  });
  // === KẾT THÚC REFACTOR ===

  if (error) {
    console.error("Lỗi tải profile:", error);
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

  // 3. === PHẦN MỚI: Tải tin đăng của chủ trọ ===
  await loadMyPosts();
});
