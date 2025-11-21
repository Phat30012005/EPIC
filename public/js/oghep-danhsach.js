/* =======================================
   --- FILE: public/js/oghep-danhsach.js ---
   (PHIÊN BẢN FINAL - CÓ PHÂN TRANG & FIX LỖI)
   ======================================= */

let savedRoommatePostIds = new Set();
let currentPage = 1; // Trang hiện tại
const ITEMS_PER_PAGE = 12; // Số tin mỗi trang

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
function renderPostings(responseData) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";

  // Xử lý dữ liệu phân trang
  let list = [];
  let pagination = null;

  if (responseData && responseData.data) {
    list = responseData.data;
    pagination = responseData.pagination;
  } else if (Array.isArray(responseData)) {
    list = responseData;
  }

  if (!list || list.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có tin nào phù hợp.</p>`;
    renderPagination(null);
    return;
  }

  list.forEach((post) => {
    const div = document.createElement("div");
    div.className =
      "app-card p-4 flex flex-col shadow-md hover:shadow-lg transition bg-white rounded-lg h-full";

    const isOffering = post.posting_type === "OFFERING";
    const typeBadgeClass = isOffering ? "bg-success" : "bg-info";
    const typeText = isOffering ? "Cần tìm người" : "Cần tìm phòng";

    const priceFormatted = Utils.formatCurrencyShort(post.price);

    // --- [FIX] Xử lý ảnh & Tên người dùng ---
    const avatarOriginal = post.profiles?.avatar_url;
    // Dùng ảnh tối ưu 100px
    const avatarSrc = Utils.getOptimizedImage(avatarOriginal, 100);

    // [QUAN TRỌNG] Khai báo profileName để tránh lỗi ReferenceError
    const profileName = post.profiles?.full_name || "Ẩn danh";
    // ----------------------------------------

    const profileUrl = `/profile.html?user_id=${post.user_id}`;

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
         <a href="${profileUrl}" class="flex items-center text-decoration-none group" target="_blank">
             <img src="${avatarSrc}" alt="ava" class="rounded-circle border group-hover:border-primary transition" style="width: 30px; height: 30px; object-fit: cover; margin-right: 8px;">
             <span class="text-sm text-gray-500 truncate group-hover:text-primary transition font-medium">${profileName}</span>
         </a>
      </div>
      <div class="flex items-center mt-3 justify-content-between">
        <a href="/oghep-chitiet.html?id=${
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

  // Vẽ phân trang
  if (pagination) {
    renderPagination(pagination);
  }
}

// 3. Hàm vẽ phân trang
function renderPagination(pagination) {
  const paginationEl = document.getElementById("pagination");
  if (!paginationEl) return;
  paginationEl.innerHTML = "";

  if (!pagination || pagination.total_pages <= 1) return;

  const { page, total_pages } = pagination;

  // Nút Prev
  const prevDisabled = page === 1 ? "disabled" : "";
  paginationEl.innerHTML += `
    <li class="page-item ${prevDisabled}">
      <a class="page-link" href="#" onclick="changePage(${
        page - 1
      }); return false;">&laquo;</a>
    </li>
  `;

  // Các số trang
  for (let i = 1; i <= total_pages; i++) {
    const active = i === page ? "active" : "";
    paginationEl.innerHTML += `
      <li class="page-item ${active}">
        <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
      </li>
    `;
  }

  // Nút Next
  const nextDisabled = page === total_pages ? "disabled" : "";
  paginationEl.innerHTML += `
    <li class="page-item ${nextDisabled}">
      <a class="page-link" href="#" onclick="changePage(${
        page + 1
      }); return false;">&raquo;</a>
    </li>
  `;
}

// 4. Hàm chuyển trang
window.changePage = function (newPage) {
  if (newPage < 1) return;
  currentPage = newPage;
  handleFilter();
  document
    .getElementById("default-title")
    .scrollIntoView({ behavior: "smooth" });
};

// 5. Gán sự kiện nút Lưu
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
        window.location.href = "/login.html";
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

// 6. Hàm Lọc chính (Có phân trang)
async function handleFilter() {
  console.log(`[oghep] Đang lọc trang ${currentPage}...`);
  const roomList = document.getElementById("roomList");

  const filterPrice = document.getElementById("filterPrice")?.value;
  const filterLocal = document.getElementById("local-desktop")?.value;
  const filterPostingType = document.getElementById("filterPostingType")?.value;
  const filterGender = document.getElementById("filterGender")?.value;

  const paramsObject = {
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  };

  if (filterPrice) paramsObject.price = filterPrice;
  if (filterLocal) paramsObject.ward = filterLocal;
  if (filterPostingType) paramsObject.posting_type = filterPostingType;
  if (filterGender) paramsObject.gender_preference = filterGender;

  const { data, error } = await callEdgeFunction("roommate-api", {
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

// 7. Khởi chạy
async function initializePage() {
  await loadSavedRoommateStatus();
  handleFilter();
}

// Reset về trang 1 khi lọc
const filters = [
  "filterPrice",
  "local-desktop",
  "filterPostingType",
  "filterGender",
];
filters.forEach((id) => {
  const el = document.getElementById(id);
  if (el)
    el.addEventListener("change", () => {
      currentPage = 1;
      handleFilter();
    });
});

initializePage();
