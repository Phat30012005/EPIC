/* =======================================
   --- FILE: public/js/profile-lessor.js ---
   (PHIÊN BẢN V4 - HỖ TRỢ UPLOAD AVATAR)
   ======================================= */

// ===========================================
// PHẦN 1: HỒ SƠ (Profile)
// ===========================================
function populateProfileForm(profile) {
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const roleInput = document.getElementById("profile-role");
  const loadingDiv = document.getElementById("profile-loading");
  const profileForm = document.getElementById("profile-form");
  const avatarPreview = document.getElementById("avatar-preview");

  emailInput.value = profile.email || "Đang tải...";
  nameInput.value = profile.full_name || "";
  phoneInput.value = profile.phone_number || "";
  roleInput.value =
    profile.role === "LESSOR" ? "Người cho thuê" : "Chưa xác định";

  // Hiển thị Avatar nếu có
  if (profile.avatar_url) {
    avatarPreview.src = profile.avatar_url;
  }

  loadingDiv.style.display = "none";
  profileForm.style.display = "block";
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const updateButton = document.getElementById("update-profile-btn");
  updateButton.disabled = true;
  updateButton.textContent = "Đang tải lên..."; // Đổi text để báo đang upload ảnh

  const newName = document.getElementById("profile-name").value;
  const newPhone = document.getElementById("profile-phone").value;
  const avatarInput = document.getElementById("avatar-input");

  // === DÙNG FORMDATA ĐỂ GỬI FILE ===
  const formData = new FormData();
  formData.append("full_name", newName);
  formData.append("phone_number", newPhone);

  if (avatarInput.files.length > 0) {
    formData.append("avatar", avatarInput.files[0]);
  }

  // Gọi API (api-client.js tự động xử lý FormData)
  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST",
    body: formData,
  });

  if (error) {
    alert("Cập nhật thất bại: " + error.message);
  } else {
    alert("Cập nhật hồ sơ thành công!");
    // Reload để hiển thị ảnh mới từ server (tránh cache cũ)
    window.location.reload();
  }
  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}

// ===========================================
// PHẦN 2: QUẢN LÝ TIN ĐĂNG CỦA TÔI
// ===========================================
function renderMyPosts(posts) {
  const postsList = document.getElementById("my-posts-list");
  const loadingDiv = document.getElementById("my-posts-loading");
  postsList.innerHTML = "";

  if (!posts || posts.length === 0) {
    loadingDiv.textContent = "Bạn chưa đăng tin nào.";
    return;
  }
  loadingDiv.style.display = "none";

  posts.forEach((post) => {
    const price = Utils.formatCurrencyShort(post.price);
    const date = Utils.formatDate(post.created_at);

    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded bg-white mb-2 shadow-sm";
    postDiv.innerHTML = `
      <div>
        <a href="/public/chitiet.html?id=${
          post.id || post.post_id
        }" class="fw-bold text-primary text-decoration-none" target="_blank">
          ${post.title}
        </a>
        <p class="mb-0 text-muted small">${price}/tháng - ${post.ward}</p>
        <p class="mb-0 text-muted small fst-italic">Đăng ngày: ${date}</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger delete-post-btn" data-id="${
          post.id || post.post_id
        }">
          <i class="fa-solid fa-trash"></i> Xóa
        </button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });

  addDeleteListeners();
}

function addDeleteListeners() {
  document.querySelectorAll(".delete-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const id = button.dataset.id;
      showConfirm("Bạn có chắc muốn xóa tin này?", async () => {
        const { error } = await callEdgeFunction("posts-api", {
          method: "DELETE",
          params: { id: id },
        });
        if (error) {
          alert("Lỗi khi xóa: " + error.message);
        } else {
          alert("Xóa thành công!");
          button.closest(".d-flex").remove();
        }
      });
    });
  });
}

async function loadMyPosts() {
  const { data, error } = await callEdgeFunction("get-lessor-posts", {
    method: "GET",
  });
  if (error) {
    document.getElementById("my-posts-loading").textContent =
      "Lỗi khi tải tin đăng.";
  } else {
    renderMyPosts(data.data || data);
  }
}

// ===========================================
// PHẦN 3: TIN ĐÃ LƯU
// ===========================================
function renderSavedPosts(bookmarks) {
  const postsList = document.getElementById("saved-posts-list");
  const loadingDiv = document.getElementById("saved-posts-loading");
  postsList.innerHTML = "";

  if (!bookmarks || bookmarks.length === 0) {
    loadingDiv.textContent = "Bạn chưa lưu tin nào.";
    return;
  }
  loadingDiv.style.display = "none";

  bookmarks.forEach((bookmark) => {
    const post = bookmark.post;
    if (!post) return;

    const price = Utils.formatCurrencyShort(post.price);
    const date = Utils.formatDate(bookmark.created_at);

    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded bg-white mb-2 shadow-sm";
    postDiv.innerHTML = `
      <div>
        <a href="/public/chitiet.html?id=${
          post.post_id || post.id
        }" class="fw-bold text-primary text-decoration-none" target="_blank">
          ${post.title}
        </a>
        <p class="mb-0 text-muted small">${price}/tháng - ${post.ward}</p>
        <p class="mb-0 text-muted small text-xs">Lưu ngày: ${date}</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-post-btn" data-id="${
          post.post_id || post.id
        }">
          <i class="fa-solid fa-heart-crack"></i> Bỏ lưu
        </button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });

  addUnsaveListeners();
}

function addUnsaveListeners() {
  document.querySelectorAll(".unsave-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const postId = button.dataset.id;
      showConfirm("Bạn có chắc muốn bỏ lưu tin này?", async () => {
        const { error } = await callEdgeFunction("remove-bookmark", {
          method: "DELETE",
          params: { post_id: postId },
        });
        if (error) {
          alert("Lỗi: " + error.message);
        } else {
          alert("Bỏ lưu thành công!");
          button.closest(".d-flex").remove();
        }
      });
    });
  });
}

async function loadSavedPosts() {
  const { data, error } = await callEdgeFunction("get-user-bookmarks", {
    method: "GET",
  });
  if (error) {
    document.getElementById("saved-posts-loading").textContent =
      "Lỗi tải tin đã lưu.";
  } else {
    renderSavedPosts(data.data || data);
  }
}

// ===========================================
// MAIN RUN
// ===========================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Tải Profile
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải profile:", error);
    document.getElementById("profile-loading").textContent = "Lỗi tải hồ sơ.";
    return;
  }
  if (data) populateProfileForm(data);

  // 2. Gán sự kiện Submit Form
  const profileForm = document.getElementById("profile-form");
  if (profileForm) profileForm.addEventListener("submit", handleProfileUpdate);

  // 3. Gán sự kiện Preview Avatar (MỚI)
  const avatarInput = document.getElementById("avatar-input");
  const avatarPreview = document.getElementById("avatar-preview");
  if (avatarInput) {
    avatarInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        // Xem trước ảnh ngay khi chọn
        const reader = new FileReader();
        reader.onload = (e) => (avatarPreview.src = e.target.result);
        reader.readAsDataURL(file);
      }
    });
  }

  // 4. Tải danh sách tin
  await Promise.all([loadMyPosts(), loadSavedPosts()]);
});
