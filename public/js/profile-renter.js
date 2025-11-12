// public/js/profile-renter.js
// === ĐÃ CẬP NHẬT (NGÀY 6) ĐỂ THÊM LOGIC "TIN ĐÃ LƯU" ===

// ===========================================
// PHẦN XỬ LÝ HỒ SƠ (Giữ nguyên)
// ===========================================
// [THAY THẾ HÀM NÀY]
function populateProfileForm(profile) {
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const roleInput = document.getElementById("profile-role");
  const loadingDiv = document.getElementById("profile-loading");
  const profileForm = document.getElementById("profile-form");

  // (SỬA LỖI: Đọc 'full_name' và 'phone_number' từ CSDL)
  emailInput.value = profile.email || "Đang tải...";
  nameInput.value = profile.full_name || ""; // <--- SỬA
  phoneInput.value = profile.phone_number || ""; // <--- SỬA

  if (profile.role === "RENTER") {
    roleInput.value = "Người thuê";
  } else {
    roleInput.value = "Chưa xác định";
  }

  loadingDiv.style.display = "none";
  profileForm.style.display = "block";
}

// [THAY THẾ HÀM NÀY]
async function handleProfileUpdate(e) {
  e.preventDefault();
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const updateButton = document.getElementById("update-profile-btn");

  updateButton.disabled = true;
  updateButton.textContent = "Đang lưu...";

  const newName = nameInput.value;
  const newPhone = phoneInput.value;

  // (SỬA LỖI: Gửi JSON khớp với Backend V2)
  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST",
    body: {
      full_name: newName, // <--- SỬA
      phone_number: newPhone, // <--- SỬA
    },
  });

  if (error) {
    alert("Cập nhật thất bại: " + error.message);
    console.error("Lỗi cập nhật:", error);
  } else {
    alert("Cập nhật hồ sơ thành công!");
    // (SỬA LỖI LOGIC: 'data' trả về là profile)
    populateProfileForm(data);
  }

  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}
// ===========================================
// PHẦN MỚI (NGÀY 6): XỬ LÝ TIN ĐÃ LƯU
// ===========================================

/**
 * Render danh sách tin đã lưu
 * @param {Array} bookmarks - Mảng bookmarks từ API (chứa 'posts')
 */
function renderSavedPosts(bookmarks) {
  const postsList = document.getElementById("saved-posts-list");
  const loadingDiv = document.getElementById("saved-posts-loading");

  postsList.innerHTML = ""; // Xóa

  if (!bookmarks || bookmarks.length === 0) {
    loadingDiv.textContent = "Bạn chưa lưu tin nào.";
    return;
  }

  loadingDiv.style.display = "none"; // Ẩn loading

  bookmarks.forEach((bookmark) => {
    // API trả về { id, created_at, posts: {...} }
    const post = bookmark.posts;

    // Xử lý nếu tin gốc đã bị xóa
    if (!post) {
      postsList.innerHTML += `<p class="text-muted">Một tin đã lưu không còn tồn tại (có thể đã bị xóa).</p>`;
      return;
    }

    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded";
    postDiv.innerHTML = `
      <div>
        <a href="/public/chitiet.html?id=${
          post.id
        }" class="fw-bold text-primary" target="_blank">${post.title}</a>
        <p class="mb-0 text-muted">${post.price.toLocaleString()} đ/tháng - ${
      post.ward
    }</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-post-btn" data-id="${
          post.id
        }">
          Bỏ lưu
        </button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });

  // Gán sự kiện cho các nút "Bỏ lưu"
  addUnsaveListeners();
}

/**
 * Gán sự kiện click cho các nút "Bỏ lưu"
 */
function addUnsaveListeners() {
  const postsList = document.getElementById("saved-posts-list");

  postsList.querySelectorAll(".unsave-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const postId = e.target.dataset.id;

      showConfirm("Bạn có chắc muốn bỏ lưu tin này?", async () => {
        // Gọi API 'remove-bookmark'
        const { data, error } = await callEdgeFunction("remove-bookmark", {
          method: "DELETE",
          params: { post_id: postId }, // Gửi ID qua query param
        });

        if (error) {
          alert("Lỗi khi bỏ lưu: " + error.message);
        } else {
          alert("Bỏ lưu thành công!");
          // Xóa phần tử khỏi UI
          e.target.closest(".d-flex").remove();
        }
      });
    });
  });
}

/**
 * Tải danh sách tin đã lưu của user
 */
async function loadSavedPosts() {
  const { data, error } = await callEdgeFunction("get-user-bookmarks", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải tin đã lưu:", error);
    document.getElementById("saved-posts-loading").textContent =
      "Lỗi khi tải tin đã lưu.";
  } else {
    // data.data là mảng [ { id, posts: {...} }, ... ]
    renderSavedPosts(data.data);
  }
}

// ===========================================
// HÀM CHẠY CHÍNH (ĐÃ CẬP NHẬT)
// ===========================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Tải Profile (Giữ nguyên)
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải profile:", error);
    alert("Không thể tải hồ sơ: " + error.message);
    document.getElementById("profile-loading").textContent = "Lỗi tải hồ sơ.";
    return;
  }

  const userProfile = data.data;
  if (userProfile) {
    populateProfileForm(userProfile);
  }

  // 2. Gán sự kiện submit (Giữ nguyên)
  const profileForm = document.getElementById("profile-form");
  profileForm.addEventListener("submit", handleProfileUpdate);

  // 3. === PHẦN MỚI (NGÀY 6): Tải tin đã lưu ===
  await loadSavedPosts();
});
