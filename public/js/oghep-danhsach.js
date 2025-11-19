/* =======================================
   --- FILE: public/js/oghep-danhsach.js ---
   (PHIÊN BẢN V4 - ĐÃ ĐỒNG BỘ HÓA VỚI BACKEND MỚI)
   ======================================= */

let savedRoommatePostIds = new Set();

// 1. Tải trạng thái đã lưu (Bookmark)
async function loadSavedRoommateStatus() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data, error } = await callEdgeFunction(
    "get-user-roommate-bookmarks",
    { method: "GET" }
  );

  if (!error && data) {
    // Backend trả về mảng bookmark, lọc lấy ID tin
    const postIds = data
      .filter((b) => b.posting || b.roommate_postings) // Handle cả 2 trường hợp tên biến cũ/mới
      .map((b) =>
        b.posting ? b.posting.posting_id : b.roommate_postings.posting_id
      );

    savedRoommatePostIds = new Set(postIds);
  }
}

// 2. Render danh sách
function renderPostings(postings) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";

  if (!postings || postings.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có tin nào phù hợp với bộ lọc.</p>`;
    return;
  }

  postings.forEach((post) => {
    const div = document.createElement("div");
    div.className =
      "app-card p-4 flex flex-col shadow-md hover:shadow-lg transition bg-white rounded-lg";

    const typeTag = document.createElement("span");
    const isOffering = post.posting_type === "OFFERING";
    typeTag.className = `badge ${
      isOffering ? "bg-success" : "bg-info"
    } mb-2 align-self-start`;
    typeTag.textContent = isOffering ? "Cần tìm người" : "Cần tìm phòng";

    const title = document.createElement("h5");
    title.className = "font-bold text-lg mb-1";
    title.textContent = post.title;

    const price = document.createElement("p");
    price.className = "text-primary font-semibold mb-1";
    price.textContent = `${post.price?.toLocaleString() || 0} đ/người`;

    const ward = document.createElement("p");
    ward.className = "text-gray-600 mb-2 text-sm";
    ward.textContent = `KV: ${post.ward}`;

    // Xử lý giới tính
    const genderParams = document.createElement("p");
    genderParams.className = "text-gray-500 text-xs mb-2";
    genderParams.textContent = `Yêu cầu: ${post.gender_preference || "Không"}`;

    const profileDiv = document.createElement("div");
    profileDiv.className = "border-t pt-3 mt-auto d-flex align-items-center";
    const avatarSrc = post.profiles?.avatar_url || "/public/assets/logo2.jpg";
    const profileName = post.profiles?.full_name || "Ẩn danh";

    profileDiv.innerHTML = `
        <img src="${avatarSrc}" alt="avatar" class="rounded-circle border" style="width: 30px; height: 30px; margin-right: 8px; object-fit: cover;">
        <span class="text-sm text-gray-500 truncate">${profileName}</span>
    `;

    // Button Wrapper
    const buttonWrapper = document.createElement("div");
    buttonWrapper.className =
      "d-flex align-items-center mt-3 justify-content-between";

    const detailLink = document.createElement("a");
    detailLink.href = `/public/oghep-chitiet.html?id=${post.posting_id}`;
    detailLink.className = "btn btn-sm btn-outline-primary flex-grow-1 me-2";
    detailLink.textContent = "Xem chi tiết";

    // Nút Lưu
    const isSaved = savedRoommatePostIds.has(post.posting_id);
    const saveButton = document.createElement("button");
    saveButton.className = `btn btn-sm ${
      isSaved ? "btn-danger" : "btn-outline-danger"
    } save-roommate-btn`;
    saveButton.dataset.id = post.posting_id;
    saveButton.innerHTML = isSaved
      ? '<i class="fa-solid fa-heart"></i>'
      : '<i class="fa-regular fa-heart"></i>';

    buttonWrapper.appendChild(detailLink);
    buttonWrapper.appendChild(saveButton);

    div.appendChild(typeTag);
    div.appendChild(title);
    div.appendChild(price);
    div.appendChild(ward);
    div.appendChild(genderParams);
    div.appendChild(profileDiv);
    div.appendChild(buttonWrapper);

    roomList.appendChild(div);
  });

  addRoommateSaveButtonListeners();
}

// 3. Gán sự kiện nút Lưu
function addRoommateSaveButtonListeners() {
  document.querySelectorAll(".save-roommate-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      const postId = button.dataset.id;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Vui lòng đăng nhập để lưu tin!");
        window.location.href = "/public/login.html";
        return;
      }

      button.disabled = true;
      const isActive = button.classList.contains("btn-danger"); // Đang active

      if (isActive) {
        // Bỏ lưu
        await callEdgeFunction("remove-roommate-bookmark", {
          method: "DELETE",
          params: { posting_id: postId },
        });
        button.classList.remove("btn-danger");
        button.classList.add("btn-outline-danger");
        button.innerHTML = '<i class="fa-regular fa-heart"></i>';
        savedRoommatePostIds.delete(postId);
      } else {
        // Lưu
        await callEdgeFunction("add-roommate-bookmark", {
          method: "POST",
          body: { posting_id: postId },
        });
        button.classList.remove("btn-outline-danger");
        button.classList.add("btn-danger");
        button.innerHTML = '<i class="fa-solid fa-heart"></i>';
        savedRoommatePostIds.add(postId);
      }
      button.disabled = false;
    });
  });
}

// 4. Hàm Lọc chính (Đã đồng bộ)
async function handleFilter() {
  console.log("[oghep] Đang lọc...");
  const roomList = document.getElementById("roomList");

  // Lấy giá trị
  const filterPrice = document.getElementById("filterPrice")?.value;
  const filterLocal = document.getElementById("local-desktop")?.value; // ID này lấy từ HTML bạn gửi
  const filterPostingType = document.getElementById("filterPostingType")?.value;
  const filterGender = document.getElementById("filterGender")?.value;

  const paramsObject = {};
  if (filterPrice) paramsObject.price = filterPrice;
  if (filterLocal) paramsObject.ward = filterLocal;
  if (filterPostingType) paramsObject.posting_type = filterPostingType;
  if (filterGender) paramsObject.gender_preference = filterGender;

  // Gọi API
  const { data, error } = await callEdgeFunction("get-roommate-postings", {
    method: "GET",
    params: paramsObject,
  });

  if (error) {
    console.error("Lỗi lọc:", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi kết nối: ${error.message}</p>`;
    return;
  }

  // [QUAN TRỌNG]: Xử lý cấu trúc dữ liệu mới { data: [], pagination: {} }
  if (data && data.data) {
    renderPostings(data.data);
  } else if (Array.isArray(data)) {
    // Fallback cho trường hợp cũ (để an toàn)
    renderPostings(data);
  } else {
    renderPostings([]);
  }
}

// 5. Khởi chạy
async function initializePage() {
  await loadSavedRoommateStatus();
  handleFilter();
}

// Gán sự kiện change
const filters = [
  "filterPrice",
  "local-desktop",
  "filterPostingType",
  "filterGender",
];
filters.forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", handleFilter);
});

initializePage();
