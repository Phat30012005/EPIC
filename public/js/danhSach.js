/* =======================================
   --- FILE: public/js/danhSach.js ---
   (PHIÊN BẢN FIXED: FULL URL SUPABASE + SAFE RENDER)
   ======================================= */

let savedPostIds = new Set();
let currentPage = 1;
const ITEMS_PER_PAGE = 12;

// CẤU HÌNH BUCKET (Dựa trên file migration của bạn)
const STORAGE_BUCKET = "post-images";

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

  if (!error && data) {
    const list = data.data || data;
    const postIds = list
      .filter((b) => b.post)
      .map((b) => b.post.post_id || b.post.id);
    savedPostIds = new Set(postIds);
  }
}

/**
 * HÀM HỖ TRỢ: Xử lý đường dẫn ảnh an toàn
 * Tránh lỗi domino khi dữ liệu đầu vào lộn xộn
 */
function getSafeImageUrl(postData) {
  // 1. Lấy dữ liệu thô từ các trường có thể có
  let raw = postData.image_urls || postData.images;

  // 2. Nếu là chuỗi JSON (ví dụ "['img1.jpg']") -> Parse ra mảng
  if (typeof raw === "string") {
    try {
      // Kiểm tra xem có phải JSON array không
      if (raw.trim().startsWith("[")) {
        raw = JSON.parse(raw);
      } else {
        // Nếu là chuỗi thường (tên file), biến nó thành mảng 1 phần tử
        raw = [raw];
      }
    } catch (e) {
      console.warn("Lỗi parse ảnh:", e);
      // Giữ nguyên giá trị cũ nếu không parse được
    }
  }

  // 3. Lấy phần tử đầu tiên
  let imgPath = null;
  if (Array.isArray(raw) && raw.length > 0) {
    imgPath = raw[0];
  } else if (typeof raw === "string") {
    imgPath = raw;
  }

  // 4. Kiểm tra và trả về URL
  if (!imgPath) return "assets/logo1.png"; // Ảnh mặc định

  // Nếu đã là link đầy đủ (http/https) hoặc ảnh nội bộ (assets/)
  if (imgPath.startsWith("http") || imgPath.startsWith("assets/")) {
    return imgPath;
  }

  // 5. Nếu chỉ là tên file -> Ghép link Supabase Storage
  // Dùng hàm getPublicUrl của Supabase Client để đảm bảo đúng domain
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(imgPath);

  return data.publicUrl;
}

/**
 * 2. Render danh sách phòng
 */
function renderRooms(responseData) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";

  let rooms = [];
  let pagination = null;

  if (responseData && responseData.data) {
    rooms = responseData.data;
    pagination = responseData.pagination;
  } else if (Array.isArray(responseData)) {
    rooms = responseData;
  }

  if (rooms.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có phòng nào phù hợp.</p>`;
    renderPagination(null);
    return;
  }

  rooms.forEach((room) => {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded shadow p-3 hover:shadow-lg transition flex flex-col h-full";

    // --- SỬ DỤNG HÀM FIX ẢNH ---
    const imageSrc = getSafeImageUrl(room);
    // ---------------------------

    const priceFormatted = Utils.formatCurrencyShort
      ? Utils.formatCurrencyShort(room.price)
      : `${room.price} VNĐ`;
    const postId = room.id || room.post_id;

    // Xử lý nút lưu
    const isSaved = savedPostIds.has(postId);
    const saveBtnIcon = isSaved
      ? '<i class="fa-solid fa-heart"></i>'
      : '<i class="fa-regular fa-heart"></i>';
    const saveBtnClass = isSaved ? "active" : "";

    // Xử lý Avatar người đăng
    let avatarSrc = "assets/logo1.png";
    if (room.profiles && room.profiles.avatar_url) {
      avatarSrc = room.profiles.avatar_url;
      // Nếu avatar chưa có http, ghép link storage (tương tự ảnh phòng)
      if (!avatarSrc.startsWith("http")) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(avatarSrc); // Giả sử bucket avatar là 'avatars'
        avatarSrc = data.publicUrl;
      }
    }
    const profileName = room.profiles?.full_name || "Ẩn danh";
    const profileUrl = `/profile.html?user_id=${room.user_id}`;

    // Render HTML
    div.innerHTML = `
      <div class="relative w-full h-48 mb-3 overflow-hidden rounded">
        <img src="${imageSrc}" 
             alt="${room.motelName || "Phòng trọ"}" 
             class="w-full h-full object-cover transition-transform duration-300 hover:scale-110"
             onerror="this.src='assets/logo1.png'">
      </div>
      
      <h5 class="font-bold text-lg mb-1 truncate" title="${
        room.motelName || ""
      }">${room.motelName || "Chưa có tên"}</h5>
      
      <p class="text-gray-600 mb-1 text-sm truncate">
        <i class="fa-solid fa-location-dot mr-1"></i> ${
          room.ward || room.address_detail || "Chưa cập nhật"
        }
      </p>
      
      <p class="text-primary font-semibold mb-2">${priceFormatted}/tháng</p>
      
      <div class="mt-auto pt-2 border-t flex items-center mb-3">
         <a href="${profileUrl}" class="flex items-center text-decoration-none group" target="_blank">
             <img src="${avatarSrc}" alt="ava" class="rounded-circle border group-hover:border-primary transition" style="width: 28px; height: 28px; object-fit: cover; margin-right: 8px;" onerror="this.src='assets/logo1.png'">
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

  if (pagination) {
    renderPagination(pagination);
  }
}

/**
 * 3. Hàm vẽ thanh phân trang
 */
function renderPagination(pagination) {
  const paginationEl = document.getElementById("pagination");
  if (!paginationEl) return;
  paginationEl.innerHTML = "";

  if (!pagination || pagination.total_pages <= 1) return;

  const { page, total_pages } = pagination;

  const prevDisabled = page === 1 ? "disabled" : "";
  paginationEl.innerHTML += `
    <li class="page-item ${prevDisabled}">
      <a class="page-link" href="#" onclick="changePage(${
        page - 1
      }); return false;">&laquo;</a>
    </li>
  `;

  for (let i = 1; i <= total_pages; i++) {
    const active = i === page ? "active" : "";
    paginationEl.innerHTML += `
      <li class="page-item ${active}">
        <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
      </li>
    `;
  }

  const nextDisabled = page === total_pages ? "disabled" : "";
  paginationEl.innerHTML += `
    <li class="page-item ${nextDisabled}">
      <a class="page-link" href="#" onclick="changePage(${
        page + 1
      }); return false;">&raquo;</a>
    </li>
  `;
}

window.changePage = function (newPage) {
  if (newPage < 1) return;
  currentPage = newPage;
  handleFilter();
  const titleEl = document.getElementById("default-title");
  if (titleEl) titleEl.scrollIntoView({ behavior: "smooth" });
};

/**
 * 5. Gán sự kiện nút Lưu
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

function renderSkeletons() {
  const roomList = document.getElementById("roomList");
  if (!roomList) return;
  roomList.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    roomList.innerHTML += `
      <div class="skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-text md"></div>
        <div class="skeleton skeleton-text sm"></div>
        <div class="skeleton skeleton-text sm"></div>
      </div>
    `;
  }
}

/**
 * 7. Hàm Lọc chính
 */
async function handleFilter() {
  renderSkeletons();

  const params = new URLSearchParams(window.location.search);
  const urlRoomType = params.get("type");

  const filterPrice = document.getElementById("filterPrice");
  const filterType = document.getElementById("filterType");
  const filterSize = document.getElementById("roomsize-desktop");
  const filterLocal = document.getElementById("local-desktop");

  const paramsObject = {
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  };

  if (filterType && filterType.value) {
    paramsObject.type = filterType.value;
  } else if (urlRoomType) {
    paramsObject.type = urlRoomType;
    if (filterType) filterType.value = urlRoomType;
  }

  if (filterPrice?.value) paramsObject.price = filterPrice.value;
  if (filterSize?.value) paramsObject.size = filterSize.value;
  if (filterLocal?.value) paramsObject.ward = filterLocal.value;

  const { data, error } = await callEdgeFunction("posts-api", {
    method: "GET",
    params: paramsObject,
  });

  if (error) {
    console.error("Lỗi lọc:", error);
    const roomList = document.getElementById("roomList");
    if (roomList) {
      roomList.innerHTML = `<p class="text-center text-red-500">Lỗi kết nối: ${error.message}</p>`;
    }
    return;
  }

  renderRooms(data);
}

/**
 * 8. Khởi chạy
 */
async function initializePage() {
  await loadSavedStatus();

  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get("q");

  if (searchQuery) {
    const desktopFilters = document.getElementById("desktopFilters");
    const searchTitle = document.getElementById("search-results-title");

    if (desktopFilters) desktopFilters.style.display = "none";
    if (searchTitle) {
      searchTitle.textContent = `Kết quả tìm kiếm: "${searchQuery}"`;
      searchTitle.style.display = "block";
    }

    const { data } = await callEdgeFunction("search-posts", {
      method: "GET",
      params: { q: searchQuery },
    });
    renderRooms(data);
  } else {
    handleFilter();
  }
}

const filters = [
  "filterPrice",
  "filterType",
  "roomsize-desktop",
  "local-desktop",
];
filters.forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("change", () => {
      currentPage = 1;
      handleFilter();
    });
  }
});

initializePage();
