/* =======================================
   --- FILE: public/js/-profile.js ---
   ======================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const userId = Utils.getParam("user_id");
  const loadingDiv = document.getElementById("profile-loading");
  const contentDiv = document.getElementById("profile-content");

  if (!userId) {
    loadingDiv.innerHTML = `<p class="text-danger">Không tìm thấy ID người dùng.</p>`;
    return;
  }

  try {
    // 1. Tải thông tin cá nhân
    const { data: profile, error } = await callEdgeFunction(
      "get-public-profile",
      {
        method: "GET",
        params: { user_id: userId },
      }
    );

    if (error) {
      loadingDiv.innerHTML = `<p class="text-danger">Lỗi: ${error.message}</p>`;
      return;
    }

    // Render thông tin Profile
    renderProfileInfo(profile);

    // 2. Tải các bài đăng (Chạy song song cho nhanh)
    await Promise.all([loadUserRentals(userId), loadUserRoommates(userId)]);

    // Hiển thị nội dung
    loadingDiv.classList.add("hidden");
    contentDiv.classList.remove("hidden");
  } catch (err) {
    console.error("Lỗi tải trang profile:", err);
    loadingDiv.innerHTML = `<p class="text-danger">Đã xảy ra lỗi hệ thống.</p>`;
  }
});

// --- Helper: Render Profile Info ---
function renderProfileInfo(profile) {
  document.title = `${profile.full_name} | Chicky.stu`;

  Utils.setText("user-name", profile.full_name || "Người dùng");
  Utils.setText(
    "user-role",
    profile.role === "LESSOR" ? "Chủ trọ" : "Người thuê"
  );
  Utils.setText("user-joined", Utils.formatDate(profile.created_at));
  Utils.setText("user-phone", profile.phone_number || "Chưa cập nhật");
  Utils.setText("user-email", profile.email || "Ẩn");

  if (profile.avatar_url) {
    document.getElementById("user-avatar").src = profile.avatar_url;
  }
}

// --- Helper: Load Rental Posts (Phòng trọ) ---
async function loadUserRentals(userId) {
  const listContainer = document.getElementById("user-rental-list");
  const noDataMsg = document.getElementById("no-rental-msg");

  // Gọi posts-api với filter user_id
  const { data, error } = await callEdgeFunction("posts-api", {
    method: "GET",
    params: { user_id: userId, status: "APPROVED" }, // Chỉ hiện tin đã duyệt
  });

  let posts = [];
  if (data && Array.isArray(data.data)) posts = data.data;

  if (posts.length === 0) {
    noDataMsg.classList.remove("hidden");
    return;
  }

  posts.forEach((post) => {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded shadow-sm border p-3 hover:shadow-md transition";
    const price = Utils.formatCurrencyShort(post.price);
    const img =
      post.image_urls && post.image_urls[0]
        ? post.image_urls[0]
        : "/assets/logo2.jpg";

    div.innerHTML = `
            <img src="${img}" class="w-full h-40 object-cover rounded mb-2">
            <h5 class="font-bold text-md truncate mb-1">${post.title}</h5>
            <p class="text-sm text-gray-600 mb-1 truncate"><i class="fa-solid fa-location-dot"></i> ${post.ward}</p>
            <div class="flex justify-between items-center">
                <span class="text-primary font-bold">${price}/tháng</span>
                <a href="/chitiet.html?id=${post.post_id}" class="btn btn-sm btn-outline-primary">Xem</a>
            </div>
        `;
    listContainer.appendChild(div);
  });
}

// --- Helper: Load Roommate Posts (Tìm ở ghép) ---
async function loadUserRoommates(userId) {
  const listContainer = document.getElementById("user-roommate-list");
  const noDataMsg = document.getElementById("no-roommate-msg");

  // Gọi roommate-api với filter user_id
  const { data, error } = await callEdgeFunction("roommate-api", {
    method: "GET",
    params: { user_id: userId, status: "APPROVED" },
  });

  let posts = [];
  if (data && Array.isArray(data.data)) posts = data.data;

  if (posts.length === 0) {
    noDataMsg.classList.remove("hidden");
    return;
  }

  posts.forEach((post) => {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded shadow-sm border p-3 hover:shadow-md transition";
    const price = Utils.formatCurrencyShort(post.price);
    const typeBadge =
      post.posting_type === "OFFERING"
        ? '<span class="badge bg-success mb-2">Tìm người</span>'
        : '<span class="badge bg-info mb-2">Tìm phòng</span>';

    div.innerHTML = `
            ${typeBadge}
            <h5 class="font-bold text-md truncate mb-1">${post.title}</h5>
            <p class="text-sm text-gray-600 mb-1 truncate"><i class="fa-solid fa-location-dot"></i> ${post.ward}</p>
            <div class="flex justify-between items-center mt-2">
                <span class="text-primary font-bold">${price}/người</span>
                <a href="/oghep-chitiet.html?id=${post.posting_id}" class="btn btn-sm btn-outline-primary">Xem</a>
            </div>
        `;
    listContainer.appendChild(div);
  });
}
