/* =======================================
   --- FILE: public/js/profile-renter.js ---
   (PHIÊN BẢN V4 - HỖ TRỢ UPLOAD AVATAR)
   ======================================= */

// 1. Profile Form
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
  roleInput.value = profile.role === "RENTER" ? "Người thuê" : "Chưa xác định";

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
  updateButton.textContent = "Đang tải lên...";

  const newName = document.getElementById("profile-name").value;
  const newPhone = document.getElementById("profile-phone").value;
  const avatarInput = document.getElementById("avatar-input");

  const formData = new FormData();
  formData.append("full_name", newName);
  formData.append("phone_number", newPhone);

  if (avatarInput.files.length > 0) {
    formData.append("avatar", avatarInput.files[0]);
  }

  const { data, error } = await callEdgeFunction("update-user-profile", {
    method: "POST",
    body: formData,
  });

  if (error) {
    alert("Lỗi: " + error.message);
  } else {
    alert("Cập nhật thành công!");
    window.location.reload();
  }
  updateButton.disabled = false;
  updateButton.textContent = "Lưu thay đổi";
}

// 2. My Roommate Posts (Tin ở ghép của tôi)
function renderMyRoommatePosts(posts) {
  const postsList = document.getElementById("my-roommate-posts-list");
  const loadingDiv = document.getElementById("my-roommate-posts-loading");
  postsList.innerHTML = "";

  if (!posts || posts.length === 0) {
    loadingDiv.textContent = "Bạn chưa đăng tin tìm ở ghép nào.";
    return;
  }
  loadingDiv.style.display = "none";

  posts.forEach((post) => {
    const price = Utils.formatCurrencyShort(post.price);
    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded bg-white mb-2";
    postDiv.innerHTML = `
      <div>
        <a href="/public/oghep-chitiet.html?id=${post.posting_id}" class="fw-bold text-primary text-decoration-none" target="_blank">${post.title}</a>
        <p class="mb-0 text-muted small">${price}/người - ${post.ward}</p>
        <span class="badge bg-secondary text-xs">${post.status}</span>
      </div>
      <div>
        <button class="btn btn-sm btn-danger delete-roommate-post-btn" data-id="${post.posting_id}">Xóa</button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });

  addDeleteRoommateListeners();
}

function addDeleteRoommateListeners() {
  document.querySelectorAll(".delete-roommate-post-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const postingId = button.dataset.id;
      showConfirm("Bạn có chắc muốn xóa tin này?", async () => {
        const { error } = await callEdgeFunction("delete-roommate-posting", {
          method: "DELETE",
          params: { id: postingId },
        });
        if (error) {
          alert("Lỗi: " + error.message);
        } else {
          alert("Xóa thành công!");
          button.closest(".d-flex").remove();
        }
      });
    });
  });
}

async function loadMyRoommatePosts() {
  const { data, error } = await callEdgeFunction("get-my-roommate-postings", {
    method: "GET",
  });
  if (error) {
    console.error("Lỗi tải tin ở ghép:", error);
    document.getElementById("my-roommate-posts-loading").textContent =
      "Lỗi tải tin.";
  } else {
    renderMyRoommatePosts(data.data || data);
  }
}

// 3. Saved Rental Posts
function renderSavedPosts(bookmarks) {
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
    if (!post) return;

    const price = Utils.formatCurrencyShort(post.price);
    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded bg-white mb-2";
    postDiv.innerHTML = `
      <div>
        <a href="/public/chitiet.html?id=${
          post.post_id || post.id
        }" class="fw-bold text-primary text-decoration-none" target="_blank">${
      post.title
    }</a>
        <p class="mb-0 text-muted small">${price}/tháng - ${post.ward}</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-post-btn" data-id="${
          post.post_id || post.id
        }">Bỏ lưu</button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });

  document.querySelectorAll(".unsave-post-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pid = btn.dataset.id;
      showConfirm("Bỏ lưu tin này?", async () => {
        const { error } = await callEdgeFunction("remove-bookmark", {
          method: "DELETE",
          params: { post_id: pid },
        });
        if (!error) btn.closest(".d-flex").remove();
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

// 4. Saved Roommate Posts
function renderSavedRoommatePosts(bookmarks) {
  const postsList = document.getElementById("saved-roommate-posts-list");
  const loadingDiv = document.getElementById("saved-roommate-posts-loading");
  postsList.innerHTML = "";

  if (!bookmarks || bookmarks.length === 0) {
    loadingDiv.textContent = "Bạn chưa lưu tin ở ghép nào.";
    return;
  }
  loadingDiv.style.display = "none";

  bookmarks.forEach((bookmark) => {
    const post = bookmark.posting || bookmark.roommate_postings;
    if (!post) return;

    const price = Utils.formatCurrencyShort(post.price);
    const postDiv = document.createElement("div");
    postDiv.className =
      "d-flex justify-content-between align-items-center p-3 border rounded bg-white mb-2";
    postDiv.innerHTML = `
      <div>
        <a href="/public/oghep-chitiet.html?id=${post.posting_id}" class="fw-bold text-primary text-decoration-none" target="_blank">${post.title}</a>
        <p class="mb-0 text-muted small">${price}/người - ${post.ward}</p>
      </div>
      <div>
        <button class="btn btn-sm btn-outline-danger unsave-roommate-post-btn" data-id="${post.posting_id}">Bỏ lưu</button>
      </div>
    `;
    postsList.appendChild(postDiv);
  });

  document.querySelectorAll(".unsave-roommate-post-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pid = btn.dataset.id;
      showConfirm("Bỏ lưu tin này?", async () => {
        const { error } = await callEdgeFunction("remove-roommate-bookmark", {
          method: "DELETE",
          params: { posting_id: pid },
        });
        if (!error) btn.closest(".d-flex").remove();
      });
    });
  });
}

async function loadSavedRoommatePosts() {
  const { data, error } = await callEdgeFunction(
    "get-user-roommate-bookmarks",
    { method: "GET" }
  );
  if (error) {
    document.getElementById("saved-roommate-posts-loading").textContent =
      "Lỗi tải tin đã lưu.";
  } else {
    renderSavedRoommatePosts(data.data || data);
  }
}

// Main
document.addEventListener("DOMContentLoaded", async () => {
  const { data, error } = await callEdgeFunction("get-user-profile", {
    method: "GET",
  });
  if (data) populateProfileForm(data);

  const profileForm = document.getElementById("profile-form");
  if (profileForm) profileForm.addEventListener("submit", handleProfileUpdate);

  // Sự kiện Preview Avatar
  const avatarInput = document.getElementById("avatar-input");
  const avatarPreview = document.getElementById("avatar-preview");
  if (avatarInput) {
    avatarInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => (avatarPreview.src = e.target.result);
        reader.readAsDataURL(file);
      }
    });
  }

  await Promise.all([
    loadMyRoommatePosts(),
    loadSavedPosts(),
    loadSavedRoommatePosts(),
  ]);
});
