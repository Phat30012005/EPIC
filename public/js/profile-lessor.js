// public/js/profile-lessor.js
// (PHIÊN BẢN V3 - TÍCH HỢP UTILS & POSTS-API)

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

  emailInput.value = profile.email || "Đang tải...";
  nameInput.value = profile.full_name || "";
  phoneInput.value = profile.phone_number || "";

  roleInput.value =
    profile.role === "LESSOR" ? "Người cho thuê" : "Chưa xác định";

  loadingDiv.style.display = "none";
  profileForm.style.display = "block";
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const updateButton = document.getElementById("update-profile-btn");
  updateButton.disabled = true;
  updateButton.textContent = "Đang lưu...";

  const newName = document.getElementById("profile-name").value;
  const newPhone = document.getElementById("profile-phone").value;

  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST",
    body: { full_name: newName, phone_number: newPhone },
  });

  if (error) {
    alert("Cập nhật thất bại: " + error.message);
  } else {
    alert("Cập nhật hồ sơ thành công!");
    populateProfileForm(data);
  }
  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}

// ===========================================
// PHẦN 2: QUẢN LÝ TIN ĐĂNG (Dùng posts-api)
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
    // Dùng Utils format giá
    const price = Utils.formatCurrencyShort(post.price);
    // Dùng Utils format ngày
    const date = Utils.formatDate(post.created_at);

    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded bg-white mb-2";
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
      const id = button.dataset.id; // Sửa: Lấy từ button trực tiếp an toàn hơn e.target

      // Dùng showConfirm từ main.js
      showConfirm("Bạn có chắc muốn xóa tin này?", async () => {
        // GỌI API MỚI: posts-api (DELETE)
        const { error } = await callEdgeFunction("posts-api", {
          method: "DELETE",
          params: { id: id },
        });

        if (error) {
          alert("Lỗi khi xóa: " + error.message);
        } else {
          alert("Xóa thành công!");
          // Xóa phần tử khỏi DOM ngay lập tức
          button.closest(".d-flex").remove();
        }
      });
    });
  });
}

async function loadMyPosts() {
  // Vẫn dùng get-lessor-posts vì logic lấy tin CỦA MÌNH hơi khác logic lấy tin public
  // Tuy nhiên, nếu muốn dùng posts-api, ta cần thêm logic lọc theo user_id ở backend
  // Để an toàn, tạm thời giữ get-lessor-posts cho phần GET, nhưng DELETE đã chuyển sang posts-api.
  const { data, error } = await callEdgeFunction("get-lessor-posts", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải tin đăng:", error);
    document.getElementById("my-posts-loading").textContent =
      "Lỗi khi tải tin đăng.";
  } else {
    renderMyPosts(data.data || data); // Support cả 2 format
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
    if (!post) return; // Bỏ qua nếu tin đã bị xóa

    const price = Utils.formatCurrencyShort(post.price);

    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded bg-white mb-2";
    postDiv.innerHTML = `
      <div>
        <a href="/public/chitiet.html?id=${post.post_id}" class="fw-bold text-primary text-decoration-none" target="_blank">
          ${post.title}
        </a>
        <p class="mb-0 text-muted small">${price}/tháng - ${post.ward}</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-post-btn" data-id="${post.post_id}">
          Bỏ lưu
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
    console.error("Lỗi tải tin đã lưu:", error);
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
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải profile:", error);
    document.getElementById("profile-loading").textContent = "Lỗi tải hồ sơ.";
    return;
  }
  if (data) populateProfileForm(data);

  const profileForm = document.getElementById("profile-form");
  if (profileForm) profileForm.addEventListener("submit", handleProfileUpdate);

  await Promise.all([loadMyPosts(), loadSavedPosts()]);
});
