// public/js/danhSach.js
// (PHIÊN BẢN V_FINAL - TÍCH HỢP UTILS & POSTS-API)

let savedPostIds = new Set();

/**
 * 1. Tải trạng thái đã lưu (Bookmark)
 */
async function loadSavedStatus() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data, error } = await callEdgeFunction("get-user-bookmarks", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải trạng thái đã lưu:", error);
  } else if (data.data) {
    const postIds = data.data
      .filter((b) => b.post) // Lọc bookmark hợp lệ
      .map((b) => b.post.post_id || b.post.id); // Hỗ trợ cả 2 trường hợp id
    savedPostIds = new Set(postIds);
  }
}

/**
 * 2. Render danh sách phòng (Đã bổ sung Avatar & Link Profile)
 */
function renderRooms(inputData) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";

  // --- Logic phòng thủ ---
  let rooms = [];
  if (Array.isArray(inputData)) {
    rooms = inputData;
  } else if (inputData && Array.isArray(inputData.data)) {
    rooms = inputData.data;
  } else {
    rooms = [];
  }

  if (rooms.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có phòng nào phù hợp.</p>`;
    return;
  }

  rooms.forEach((room) => {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded shadow p-3 hover:shadow-lg transition flex flex-col h-full";

    const imageSrc =
      Array.isArray(room.image_urls) && room.image_urls.length > 0
        ? room.image_urls[0]
        : "/assets/logo1.png"; // Dùng đường dẫn assets chuẩn Vercel

    const priceFormatted = Utils.formatCurrencyShort(room.price);

    const postId = room.id || room.post_id;
    const isSaved = savedPostIds.has(postId);
    const saveBtnIcon = isSaved
      ? '<i class="fa-solid fa-heart"></i>'
      : '<i class="fa-regular fa-heart"></i>';
    const saveBtnClass = isSaved ? "active" : "";

    // --- THÔNG TIN NGƯỜI ĐĂNG ---
    const avatarSrc = room.profiles?.avatar_url || "/assets/logo2.png";
    const profileName = room.profiles?.full_name || "Ẩn danh";
    // Tạo link đến Public Profile
    const profileUrl = `/profile.html?user_id=${room.user_id}`;

    div.innerHTML = `
      <img src="${imageSrc}" alt="${
      room.motelName
    }" class="w-full h-48 object-cover mb-3 rounded">
      <h5 class="font-bold text-lg mb-1 truncate">${
        room.motelName || "Chưa có tên"
      }</h5>
      
      <p class="text-gray-600 mb-1 text-sm truncate"><i class="fa-solid fa-location-dot mr-1"></i> ${
        room.ward || room.address_detail
      }</p>
      <p class="text-primary font-semibold mb-2">${priceFormatted}/tháng</p>
      
      <div class="mt-auto pt-2 border-t flex items-center mb-3">
         <a href="${profileUrl}" class="flex items-center text-decoration-none group" target="_blank">
             <img src="${avatarSrc}" alt="ava" class="rounded-circle border group-hover:border-primary transition" style="width: 28px; height: 28px; object-fit: cover; margin-right: 8px;">
             <span class="text-sm text-gray-500 truncate group-hover:text-primary transition font-medium">${profileName}</span>
         </a>
      </div>

      <div class="flex items-center justify-between">
         <a href="chitiet.html?id=${postId}" class="btn btn-sm btn-primary flex-grow mr-2">Xem chi tiết</a>
         <button class="btn btn-sm btn-outline-danger save-btn ${saveBtnClass}" data-id="${postId}" style="width: 40px;">
            ${saveBtnIcon}
         </button>
      </div>
    `;

    roomList.appendChild(div);
  });

  addSaveButtonListeners();
}
/**
 * 3. Gán sự kiện nút Lưu
 */
function addSaveButtonListeners() {
  document.querySelectorAll(".save-btn").forEach((button) => {
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
      const isActive = button.classList.contains("active");

      try {
        if (isActive) {
          await callEdgeFunction("remove-bookmark", {
            method: "DELETE",
            params: { post_id: postId },
          });
          button.classList.remove("active");
          button.innerHTML = '<i class="fa-regular fa-heart"></i>';
          savedPostIds.delete(postId);
        } else {
          await callEdgeFunction("add-bookmark", {
            method: "POST",
            body: { post_id: postId },
          });
          button.classList.add("active");
          button.innerHTML = '<i class="fa-solid fa-heart"></i>';
          savedPostIds.add(postId);
        }
      } catch (error) {
        alert("Lỗi: " + error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

/**
 * 4. Hàm Lọc & Tìm kiếm (Dùng posts-api)
 */
// 1. Thêm hàm render Skeleton
function renderSkeletons() {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";
  // Tạo 6 khung xương giả
  for (let i = 0; i < 6; i++) {
    roomList.innerHTML += `
      <div class="skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-text md"></div>
        <div class="skeleton skeleton-text sm"></div>
        <div class="skeleton skeleton-text sm"></div>
        <div style="margin-top: 12px; display: flex; gap: 10px;">
           <div class="skeleton skeleton-text" style="width: 70%"></div>
           <div class="skeleton skeleton-text" style="width: 20%"></div>
        </div>
      </div>
    `;
  }
}

async function handleFilter() {
  console.log("[danhSach.js] Đang lọc...");

  renderSkeletons();

  const roomList = document.getElementById("roomList");

  // Reset giao diện tìm kiếm nếu đang dùng bộ lọc
  const searchResultsTitle = document.getElementById("search-results-title");
  const defaultTitle = document.getElementById("default-title");
  const desktopFilters = document.getElementById("desktopFilters");

  if (searchResultsTitle) searchResultsTitle.style.display = "none";
  if (defaultTitle) defaultTitle.style.display = "block";
  if (desktopFilters) desktopFilters.style.display = "flex";

  // Lấy tham số
  const params = new URLSearchParams(window.location.search);
  const urlRoomType = params.get("type");

  const filterPrice = document.getElementById("filterPrice");
  const filterType = document.getElementById("filterType");
  const filterSize = document.getElementById("roomsize-desktop");
  const filterLocal = document.getElementById("local-desktop");

  const paramsObject = {};

  // Logic ưu tiên Select box -> URL
  if (filterType && filterType.value) {
    paramsObject.type = filterType.value;
  } else if (urlRoomType) {
    paramsObject.type = urlRoomType;
    if (filterType) filterType.value = urlRoomType; // Sync UI
  }

  if (filterPrice?.value) paramsObject.price = filterPrice.value;
  if (filterSize?.value) paramsObject.size = filterSize.value;
  if (filterLocal?.value) paramsObject.ward = filterLocal.value;

  // Gọi API MỚI: posts-api
  const { data, error } = await callEdgeFunction("posts-api", {
    method: "GET",
    params: paramsObject,
  });

  if (error) {
    console.error("Lỗi lọc:", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
    return;
  }

  // Render (Hàm renderRooms đã có logic tự xử lý data.data)
  renderRooms(data);
}

async function handleSearch(searchQuery) {
  console.log(`[danhSach.js] Tìm kiếm: "${searchQuery}"`);
  renderSkeletons();
  const searchResultsTitle = document.getElementById("search-results-title");
  const defaultTitle = document.getElementById("default-title");
  const desktopFilters = document.getElementById("desktopFilters");

  if (defaultTitle) defaultTitle.style.display = "none";
  if (desktopFilters) desktopFilters.style.display = "none"; // Ẩn bộ lọc khi tìm kiếm
  if (searchResultsTitle) {
    searchResultsTitle.textContent = `Kết quả tìm kiếm: "${searchQuery}"`;
    searchResultsTitle.style.display = "block";
  }

  // Vẫn dùng search-posts cũ hoặc có thể chuyển sang posts-api nếu bạn đã nâng cấp search
  // Ở đây giữ nguyên search-posts để an toàn cho chức năng tìm kiếm
  const { data, error } = await callEdgeFunction("search-posts", {
    method: "GET",
    params: { q: searchQuery },
  });

  if (error) {
    console.error("Lỗi tìm kiếm:", error);
    return;
  }
  renderRooms(data);
}

/**
 * 5. Khởi chạy
 */
async function initializePage() {
  await loadSavedStatus();

  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get("q");

  if (searchQuery) {
    handleSearch(searchQuery);
  } else {
    handleFilter();
  }
}

// Gán sự kiện
const filters = [
  "filterPrice",
  "filterType",
  "roomsize-desktop",
  "local-desktop",
];
filters.forEach((id) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", handleFilter);
});

initializePage();
