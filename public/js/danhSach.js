/* =======================================
   --- FILE: public/js/danhSach.js ---
   (PHIÊN BẢN FIXED: HIỂN THỊ ẢNH + PHÂN TRANG)
   ======================================= */

let savedPostIds = new Set();
let currentPage = 1; // Trang hiện tại mặc định
const ITEMS_PER_PAGE = 12; // Số tin mỗi trang

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
    // Lấy danh sách ID tin đã lưu
    const list = data.data || data;
    const postIds = list
      .filter((b) => b.post)
      .map((b) => b.post.post_id || b.post.id);
    savedPostIds = new Set(postIds);
  }
}

/**
 * 2. Render danh sách phòng
 */
function renderRooms(responseData) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";

  // Xử lý dữ liệu trả về từ API (để hỗ trợ cả phân trang và không phân trang)
  let rooms = [];
  let pagination = null;

  if (responseData && responseData.data) {
    rooms = responseData.data; // Danh sách tin
    pagination = responseData.pagination; // Thông tin phân trang { page, total_pages, ... }
  } else if (Array.isArray(responseData)) {
    rooms = responseData; // Trường hợp API search cũ trả về mảng trực tiếp
  }

  if (rooms.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có phòng nào phù hợp.</p>`;
    renderPagination(null); // Xóa phân trang nếu không có dữ liệu
    return;
  }

  // Vẽ từng thẻ phòng
  rooms.forEach((room) => {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded shadow p-3 hover:shadow-lg transition flex flex-col h-full";

    // --- [FIX QUAN TRỌNG] XỬ LÝ HIỂN THỊ ẢNH ---
    // 1. Kiểm tra cả 2 tên biến có thể có: 'images' (trong DB) hoặc 'image_urls'
    let rawImages = room.images || room.image_urls;

    // 2. Nếu dữ liệu là chuỗi JSON (vd: "['link1', 'link2']"), cần Parse ra mảng
    if (typeof rawImages === 'string') {
        try {
            rawImages = JSON.parse(rawImages);
        } catch (e) {
            console.error("Lỗi parse ảnh:", e);
            rawImages = [];
        }
    }

    // 3. Lấy ảnh đầu tiên nếu có, ngược lại null
    const originalUrl = (Array.isArray(rawImages) && rawImages.length > 0) 
        ? rawImages[0] 
        : null;
        
    // 4. Tối ưu ảnh qua Utils
    const imageSrc = Utils.getOptimizedImage(originalUrl, 400);
    // --- [KẾT THÚC PHẦN FIX] ---

    const priceFormatted = Utils.formatCurrencyShort(room.price);
    const postId = room.id || room.post_id;

    // Nút Lưu
    const isSaved = savedPostIds.has(postId);
    const saveBtnIcon = isSaved
      ? '<i class="fa-solid fa-heart"></i>'
      : '<i class="fa-regular fa-heart"></i>';
    const saveBtnClass = isSaved ? "active" : "";

    // Thông tin người đăng
    const avatarOriginal = room.profiles?.avatar_url;
    const avatarSrc = Utils.getOptimizedImage(avatarOriginal, 100);
    const profileName = room.profiles?.full_name || "Ẩn danh";
    const profileUrl = `/profile.html?user_id=${room.user_id}`;

    div.innerHTML = `
      <img src="${imageSrc}" alt="${
      room.motelName || "Phòng trọ"
    }" class="w-full h-48 object-cover mb-3 rounded">
      <h5 class="font-bold text-lg mb-1 truncate">${
        room.motelName || "Chưa có tên"
      }</h5>
      
      <p class="text-gray-600 mb-1 text-sm truncate"><i class="fa-solid fa-location-dot mr-1"></i> ${
        room.ward || room.address_detail || "Chưa cập nhật"
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

  // Vẽ nút phân trang nếu có dữ liệu pagination
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

  // Nút Previous
  const prevDisabled = page === 1 ? "disabled" : "";
  paginationEl.innerHTML += `
    <li class="page-item ${prevDisabled}">
      <a class="page-link" href="#" onclick="changePage(${
        page - 1
      }); return false;">&laquo;</a>
    </li>
  `;

  // Các nút số trang
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

/**
 * 4. Hàm xử lý khi bấm chuyển trang
 */
window.changePage = function (newPage) {
  if (newPage < 1) return;
  currentPage = newPage;
  handleFilter(); // Gọi lại bộ lọc với trang mới
  // Cuộn lên đầu danh sách cho dễ nhìn
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

// 6. Render Skeleton Loading
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
  console.log(`[danhSach.js] Đang lọc trang ${currentPage}...`);
  renderSkeletons();

  const params = new URLSearchParams(window.location.search);
  const urlRoomType = params.get("type");

  const filterPrice = document.getElementById("filterPrice");
  const filterType = document.getElementById("filterType");
  const filterSize = document.getElementById("roomsize-desktop");