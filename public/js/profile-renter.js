// public/js/profile-renter.js
// (PHIÊN BẢN V4 - Thêm logic "Quản lý/Xóa tin ở ghép")

// ===========================================
// PHẦN XỬ LÝ HỒ SƠ (Giữ nguyên)
// ===========================================
function populateProfileForm(profile) {
  // ... (Code này giữ nguyên, không thay đổi)
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const roleInput = document.getElementById("profile-role");
  const loadingDiv = document.getElementById("profile-loading");
  const profileForm = document.getElementById("profile-form");
  emailInput.value = profile.email || "Đang tải...";
  nameInput.value = profile.full_name || "";
  phoneInput.value = profile.phone_number || "";
  if (profile.role === "RENTER") {
    roleInput.value = "Người thuê";
  } else {
    roleInput.value = "Chưa xác định";
  }
  loadingDiv.style.display = "none";
  profileForm.style.display = "block";
}

async function handleProfileUpdate(e) {
  // ... (Code này giữ nguyên, không thay đổi)
  e.preventDefault();
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const updateButton = document.getElementById("update-profile-btn");
  updateButton.disabled = true;
  updateButton.textContent = "Đang lưu...";
  const newName = nameInput.value;
  const newPhone = phoneInput.value;
  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST",
    body: {
      full_name: newName,
      phone_number: newPhone,
    },
  });
  if (error) {
    alert("Cập nhật thất bại: " + error.message);
    console.error("Lỗi cập nhật:", error);
  } else {
    alert("Cập nhật hồ sơ thành công!");
    populateProfileForm(data);
  }
  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}

// ===========================================
// (MỚI) PHẦN QUẢN LÝ/XÓA TIN (Ở GHÉP)
// (Copy logic từ profile-lessor.js và SỬA LẠI)
// ===========================================

function renderMyRoommatePosts(posts) {
  const postsList = document.getElementById("my-roommate-posts-list");
  const loadingDiv = document.getElementById("my-roommate-posts-loading");

  postsList.innerHTML = ""; // Xóa

  if (!posts || posts.length === 0) {
    loadingDiv.textContent = "Bạn chưa đăng tin tìm ở ghép nào.";
    return;
  }

  loadingDiv.style.display = "none"; // Ẩn loading

  posts.forEach((post) => {
    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded";
    postDiv.innerHTML = `
      <div>
        <a href="/public/oghep-chitiet.html?id=${
          post.posting_id // (SỬA) Dùng posting_id
        }" class="fw-bold text-primary" target="_blank">${post.title}</a>
        <p class="mb-0 text-muted">${post.price.toLocaleString()} đ/người - ${
      post.ward
    }</p>
        <p class="mb-0 text-muted">Trạng thái: ${post.status}</p>
      </div>
      <div>
        <button class="btn btn-sm btn-danger delete-roommate-post-btn" data-id="${
          post.posting_id // (SỬA) Dùng posting_id
        }">Xóa</button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });

  // Gán sự kiện cho các nút Xóa
  addDeleteRoommateListeners();
}

function addDeleteRoommateListeners() {
  const postsList = document.getElementById("my-roommate-posts-list");

  postsList.querySelectorAll(".delete-roommate-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const postingId = e.target.dataset.id; // Lấy 'posting_id'

      showConfirm("Bạn có chắc muốn xóa tin (ở ghép) này?", async () => {
        // (SỬA) Gọi API 'delete-roommate-posting'
        const { data, error } = await callEdgeFunction(
          "delete-roommate-posting",
          {
            method: "DELETE",
            params: { id: postingId }, // (Backend này nhận 'id')
          }
        );

        if (error) {
          alert("Lỗi khi xóa: " + error.message);
        } else {
          alert("Xóa thành công!");
          e.target.closest(".d-flex").remove();
        }
      });
    });
  });
}

async function loadMyRoommatePosts() {
  // (SỬA) Gọi API 'get-my-roommate-postings'
  const { data, error } = await callEdgeFunction("get-my-roommate-postings", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải tin đăng (ở ghép):", error);
    document.getElementById("my-roommate-posts-loading").textContent =
      "Lỗi khi tải tin đăng.";
  } else {
    // (SỬA) Gọi hàm render MỚI
    renderMyRoommatePosts(data.data); // (API này trả về {data: [...]})
  }
}

// ===========================================
// PHẦN XỬ LÝ TIN (PHÒNG TRỌ) ĐÃ LƯU (Giữ nguyên)
// ===========================================
function renderSavedPosts(bookmarks) {
  // ... (Code này giữ nguyên, không thay đổi)
  const postsList = document.getElementById("saved-posts-list");
  const loadingDiv = document.getElementById("saved-posts-loading");
  postsList.innerHTML = "";
  if (!bookmarks || bookmarks.length === 0) {
    loadingDiv.textContent = "Bạn chưa lưu tin phòng trọ nào.";
    return;
  }
  loadingDiv.style.display = "none";
  bookmarks.forEach((bookmark) => {
    const post = bookmark.post;
    if (!post) {
      postsList.innerHTML += `<p class="text-muted">Một tin (phòng trọ) đã lưu không còn tồn tại.</p>`;
      return;
    }
    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded";
    postDiv.innerHTML = `
      <div>
        <a href="/public/chitiet.html?id=${
          post.post_id
        }" class="fw-bold text-primary" target="_blank">${post.title}</a>
        <p class="mb-0 text-muted">${post.price.toLocaleString()} đ/tháng - ${
      post.ward
    }</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-post-btn" data-id="${
          post.post_id
        }">
          Bỏ lưu
        </button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });
  addUnsaveListeners();
}

function addUnsaveListeners() {
  // ... (Code này giữ nguyên, không thay đổi)
  const postsList = document.getElementById("saved-posts-list");
  postsList.querySelectorAll(".unsave-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const postId = e.target.dataset.id;
      showConfirm("Bạn có chắc muốn bỏ lưu tin (phòng trọ) này?", async () => {
        const { data, error } = await callEdgeFunction("remove-bookmark", {
          method: "DELETE",
          params: { post_id: postId },
        });
        if (error) {
          alert("Lỗi khi bỏ lưu: " + error.message);
        } else {
          alert("Bỏ lưu thành công!");
          e.target.closest(".d-flex").remove();
        }
      });
    });
  });
}

async function loadSavedPosts() {
  // ... (Code này giữ nguyên, không thay đổi)
  const { data, error } = await callEdgeFunction("get-user-bookmarks", {
    method: "GET",
  });
  if (error) {
    console.error("Lỗi tải tin (phòng trọ) đã lưu:", error);
    document.getElementById("saved-posts-loading").textContent =
      "Lỗi khi tải tin (phòng trọ) đã lưu.";
  } else {
    renderSavedPosts(data);
  }
}

// ===========================================
// PHẦN XỬ LÝ TIN (Ở GHÉP) ĐÃ LƯU (Giữ nguyên)
// ===========================================
function renderSavedRoommatePosts(bookmarks) {
  // ... (Code này giữ nguyên, không thay đổi)
  const postsList = document.getElementById("saved-roommate-posts-list");
  const loadingDiv = document.getElementById("saved-roommate-posts-loading");
  postsList.innerHTML = "";
  if (!bookmarks || bookmarks.length === 0) {
    loadingDiv.textContent = "Bạn chưa lưu tin 'tìm ở ghép' nào.";
    return;
  }
  loadingDiv.style.display = "none";
  bookmarks.forEach((bookmark) => {
    const post = bookmark.posting;
    if (!post) {
      postsList.innerHTML += `<p class="text-muted">Một tin (ở ghép) đã lưu không còn tồn tại.</p>`;
      return;
    }
    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded";
    postDiv.innerHTML = `
      <div>
        <a href="/public/oghep-chitiet.html?id=${
          post.posting_id
        }" class="fw-bold text-primary" target="_blank">${post.title}</a>
        <p class="mb-0 text-muted">${post.price.toLocaleString()} đ/người - ${
      post.ward
    }</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-roommate-post-btn" data-id="${
          post.posting_id
        }">
          Bỏ lưu
        </button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });
  addUnsaveRoommateListeners();
}

function addUnsaveRoommateListeners() {
  // ... (Code này giữ nguyên, không thay đổi)
  const postsList = document.getElementById("saved-roommate-posts-list");
  postsList.querySelectorAll(".unsave-roommate-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const postingId = e.target.dataset.id;
      showConfirm("Bạn có chắc muốn bỏ lưu tin (ở ghép) này?", async () => {
        const { data, error } = await callEdgeFunction(
          "remove-roommate-bookmark",
          {
            method: "DELETE",
            params: { posting_id: postingId },
          }
        );
        if (error) {
          alert("Lỗi khi bỏ lưu: " + error.message);
        } else {
          alert("Bỏ lưu thành công!");
          e.target.closest(".d-flex").remove();
        }
      });
    });
  });
}

async function loadSavedRoommatePosts() {
  // ... (Code này giữ nguyên, không thay đổi)
  const { data, error } = await callEdgeFunction(
    "get-user-roommate-bookmarks",
    {
      method: "GET",
    }
  );
  if (error) {
    console.error("Lỗi tải tin (ở ghép) đã lưu:", error);
    document.getElementById("saved-roommate-posts-loading").textContent =
      "Lỗi khi tải tin (ở ghép) đã lưu.";
  } else {
    renderSavedRoommatePosts(data);
  }
}

// ===========================================
// HÀM CHẠY CHÍNH (ĐÃ SỬA)
// ===========================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Tải Profile (Giữ nguyên)
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET",
  });

  if (error) {
    // ... (Xử lý lỗi profile giữ nguyên)
    console.error("Lỗi tải profile:", error);
    alert("Không thể tải hồ sơ: " + error.message);
    document.getElementById("profile-loading").textContent = "Lỗi tải hồ sơ.";
    return;
  }

  const userProfile = data;
  if (userProfile) {
    populateProfileForm(userProfile);
  }

  // 2. Gán sự kiện submit (Giữ nguyên)
  const profileForm = document.getElementById("profile-form");
  profileForm.addEventListener("submit", handleProfileUpdate);

  // 3. (SỬA) Tải CẢ BA danh sách song song
  await Promise.all([
    loadMyRoommatePosts(), // (MỚI) Tải tin (ở ghép) CỦA TÔI
    loadSavedPosts(), // Tải tin (phòng trọ) đã lưu
    loadSavedRoommatePosts(), // Tải tin (ở ghép) đã lưu
  ]);
});
