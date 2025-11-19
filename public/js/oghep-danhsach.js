/* =======================================
   --- FILE: public/js/oghep-danhsach.js ---
   (PHIÊN BẢN V_FINAL - TÍCH HỢP UTILS)
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
    const postIds = data
      .filter((b) => b.posting || b.roommate_postings)
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

  // Logic phòng thủ: Chấp nhận cả Array và Object {data: []}
  let list = [];
  if (Array.isArray(postings)) {
    list = postings;
  } else if (postings && Array.isArray(postings.data)) {
    list = postings.data;
  }

  if (list.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có tin nào phù hợp.</p>`;
    return;
  }

  list.forEach((post) => {
    const div = document.createElement("div");
    div.className =
      "app-card p-4 flex flex-col shadow-md hover:shadow-lg transition bg-white rounded-lg h-full";

    const isOffering = post.posting_type === "OFFERING";
    const typeBadgeClass = isOffering ? "bg-success" : "bg-info";
    const typeText = isOffering ? "Cần tìm người" : "Cần tìm phòng";

    // Dùng Utils format giá
    const priceFormatted = Utils.formatCurrencyShort(post.price);

    // Thông tin người đăng
    const avatarSrc = post.profiles?.avatar_url || "/public/assets/logo2.jpg";
    const profileName = post.profiles?.full_name || "Ẩn danh";

    // Nút Lưu
    const isSaved = savedRoommatePostIds.has(post.posting_id);
    const saveIcon = isSaved
      ? '<i class="fa-solid fa-heart"></i>'
      : '<i class="fa-regular fa-heart"></i>';
    const saveClass = isSaved ? "btn-danger" : "btn-outline-danger";

    div.innerHTML = `
      <div class="mb-2">
        <span class="badge ${typeBadgeClass}">${typeText}</span>
      </div>
      <h5 class="font-bold text-lg mb-1 truncate">${post.title}</h5>
      <p class="text-primary font-semibold mb-1">${priceFormatted}/người</p>
      <p class="text-gray-600 mb-2 text-sm"><i class="fa-solid fa-location-dot"></i> ${
        post.ward
      }</p>
      <p class="text-gray-500 text-xs mb-3">Yêu cầu: ${
        post.gender_preference || "Không"
      }</p>

      <div class="mt-auto pt-3 border-t flex items-center">
         <img src="${avatarSrc}" alt="ava" class="rounded-circle border" style="width: 30px; height: 30px; object-fit: cover; margin-right: 8px;">
         <span class="text-sm text-gray-500 truncate">${profileName}</span>
      </div>

      <div class="flex items-center mt-3 justify-content-between">
        <a href="/public/oghep-chitiet.html?id=${
          post.posting_id
        }" class="btn btn-sm btn-outline-primary flex-grow-1 me-2">Xem chi tiết</a>
        <button class="btn btn-sm ${saveClass} save-roommate-btn" data-id="${
      post.posting_id
    }" style="width: 40px;">
           ${saveIcon}
        </button>
      </div>
    `;

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
      const isActive = button.classList.contains("btn-danger");

      if (isActive) {
        await callEdgeFunction("remove-roommate-bookmark", {
          method: "DELETE",
          params: { posting_id: postId },
        });
        button.classList.remove("btn-danger");
        button.classList.add("btn-outline-danger");
        button.innerHTML = '<i class="fa-regular fa-heart"></i>';
        savedRoommatePostIds.delete(postId);
      } else {
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

// 4. Hàm Lọc chính
async function handleFilter() {
  console.log("[oghep] Đang lọc...");
  const roomList = document.getElementById("roomList");

  const filterPrice = document.getElementById("filterPrice")?.value;
  const filterLocal = document.getElementById("local-desktop")?.value;
  const filterPostingType = document.getElementById("filterPostingType")?.value;
  const filterGender = document.getElementById("filterGender")?.value;

  const paramsObject = {};
  if (filterPrice) paramsObject.price = filterPrice;
  if (filterLocal) paramsObject.ward = filterLocal;
  if (filterPostingType) paramsObject.posting_type = filterPostingType;
  if (filterGender) paramsObject.gender_preference = filterGender;

  const { data, error } = await callEdgeFunction("get-roommate-postings", {
    method: "GET",
    params: paramsObject,
  });

  if (error) {
    console.error("Lỗi lọc:", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi kết nối: ${error.message}</p>`;
    return;
  }

  renderPostings(data);
}

// 5. Khởi chạy
async function initializePage() {
  await loadSavedRoommateStatus();
  handleFilter();
}

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
