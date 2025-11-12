// public/js/profile-renter.js
// PHIÊN BẢN V2 (Đã đồng bộ toàn bộ lỗi logic từ lessor)

// ===========================================
// PHẦN XỬ LÝ HỒ SƠ (ĐÃ SỬA LỖI 1 & 2)
// ===========================================

function populateProfileForm(profile) {
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const roleInput = document.getElementById("profile-role");
  const loadingDiv = document.getElementById("profile-loading");
  const profileForm = document.getElementById("profile-form");

  // (SỬA LỖI 2: Đọc 'full_name' và 'phone_number' từ CSDL V5/function V2)
  emailInput.value = profile.email || "Đang tải...";
  nameInput.value = profile.full_name || ""; // <--- ĐÃ SỬA
  phoneInput.value = profile.phone_number || ""; // <--- ĐÃ SỬA

  if (profile.role === "RENTER") {
    roleInput.value = "Người thuê";
  } else {
    roleInput.value = "Chưa xác định";
  }

  loadingDiv.style.display = "none";
  profileForm.style.display = "block";
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const nameInput = document.getElementById("profile-name");
  const phoneInput = document.getElementById("profile-phone");
  const updateButton = document.getElementById("update-profile-btn");

  updateButton.disabled = true;
  updateButton.textContent = "Đang lưu...";

  const newName = nameInput.value;
  const newPhone = phoneInput.value;

  // (SỬA LỖI 2: Gửi JSON khớp với Backend 'update-user-profile' V2)
  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST",
    body: {
      full_name: newName, // <--- ĐÃ SỬA
      phone_number: newPhone, // <--- ĐÃ SỬA
    },
  });

  if (error) {
    alert("Cập nhật thất bại: " + error.message);
    console.error("Lỗi cập nhật:", error);
  } else {
    alert("Cập nhật hồ sơ thành công!");
    // (SỬA LỖI 1: 'data' trả về là profile, không phải 'data.data')
    populateProfileForm(data); // <--- ĐÃ SỬA
  }

  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}

// ===========================================
// PHẦN XỬ LÝ TIN ĐÃ LƯU (ĐÃ SỬA LỖI 3 & 4)
// ===========================================

/**
 * Render danh sách tin đã lưu
 * (Đã sửa lỗi 'posts' (số nhiều) và 'post.id')
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
    // (SỬA LỖI 3: Backend trả về 'post' (số ít))
    const post = bookmark.post;

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
          post.post_id // (SỬA LỖI 4: CSDL V5 dùng 'post_id')
        }" class="fw-bold text-primary" target="_blank">${post.title}</a>
        <p class="mb-0 text-muted">${post.price.toLocaleString()} đ/tháng - ${
      post.ward
    }</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-post-btn" data-id="${
          post.post_id // (SỬA LỖI 4: CSDL V5 dùng 'post_id')
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
 * (Đã kiểm tra: code này gửi 'post_id', khớp với backend V2)
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
          params: { post_id: postId }, // (Đã nhất quán)
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
 * (Đã sửa lỗi 'data.data')
 */
async function loadSavedPosts() {
  // (SỬA LỖI 1: 'data' trả về là mảng, không phải 'data.data')
  const { data, error } = await callEdgeFunction("get-user-bookmarks", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải tin đã lưu:", error);
    document.getElementById("saved-posts-loading").textContent =
      "Lỗi khi tải tin đã lưu.";
  } else {
    renderSavedPosts(data); // <--- ĐÃ SỬA
  }
}

// ===========================================
// HÀM CHẠY CHÍNH (ĐÃ SỬA LỖI 1)
// ===========================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Tải Profile
  // (SỬA LỖI 1: 'data' trả về là profile, không phải 'data.data')
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải profile:", error);
    alert("Không thể tải hồ sơ: " + error.message);
    document.getElementById("profile-loading").textContent = "Lỗi tải hồ sơ.";
    return;
  }

  const userProfile = data; // <--- ĐÃ SỬA
  if (userProfile) {
    populateProfileForm(userProfile);
  }

  // 2. Gán sự kiện submit
  const profileForm = document.getElementById("profile-form");
  profileForm.addEventListener("submit", handleProfileUpdate);

  // 3. Tải tin đã lưu
  await loadSavedPosts();
});
