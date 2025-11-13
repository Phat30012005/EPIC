// public/js/danhSach.js
// === ĐÃ CẬP NHẬT (NGÀY 6) ĐỂ THÊM LOGIC "LƯU TIN" (BOOKMARK) ===

// Biến toàn cục (trong phạm vi module) để lưu trạng thái
let savedPostIds = new Set();

/**
 * === HÀM MỚI (NGÀY 6): TẢI TRẠNG THÁI ĐÃ LƯU ===
 * Kiểm tra xem user đã đăng nhập chưa, nếu rồi,
 * tải danh sách tin đã lưu và điền vào Set 'savedPostIds'.
 */
async function loadSavedStatus() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Nếu chưa đăng nhập, Set sẽ rỗng, không cần làm gì
  if (!session) {
    console.log("[danhSach.js] User chưa đăng nhập. Không tải tin đã lưu.");
    return;
  }

  console.log("[danhSach.js] User đã đăng nhập. Đang tải tin đã lưu...");
  const { data, error } = await callEdgeFunction("get-user-bookmarks", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải trạng thái đã lưu:", error);
  } else if (data.data) {
    // API trả về [ { id, posts: {id, ...} }, ... ]
    // Lấy ID của bài post
    const postIds = data.data
      .filter((b) => b.posts) // Lọc ra các bookmark mà tin gốc có thể đã bị xóa
      .map((b) => b.posts.id);

    savedPostIds = new Set(postIds);
    console.log(`[danhSach.js] Đã tải ${savedPostIds.size} tin đã lưu.`);
  }
}

/**
 * === HÀM MỚI (NGÀY 6): GÁN SỰ KIỆN CHO CÁC NÚT LƯU ===
 * Hàm này sẽ được gọi SAU KHI 'renderRooms' chạy.
 */
function addSaveButtonListeners() {
  document.querySelectorAll(".save-btn").forEach((button) => {
    // Gán sự kiện 'click'
    button.addEventListener("click", async (e) => {
      e.preventDefault(); // Ngăn click vào card (chuyển trang)
      e.stopPropagation(); // Ngăn click vào card (chuyển trang)

      const postId = button.dataset.id;

      // Kiểm tra đăng nhập MỘT LẦN NỮA (cho chắc)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        alert("Bạn cần đăng nhập để lưu tin!");
        window.location.href = "/public/login.html";
        return;
      }

      button.disabled = true; // Chống click đúp

      if (button.classList.contains("active")) {
        // === TRƯỜNG HỢP 1: ĐÃ LƯU -> BỎ LƯU ===
        const { error } = await callEdgeFunction("remove-bookmark", {
          method: "DELETE",
          params: { post_id: postId },
        });

        if (error) {
          alert("Lỗi bỏ lưu: " + error.message);
        } else {
          // Cập nhật UI
          button.classList.remove("active");
          button.innerHTML = '<i class="fa-regular fa-heart"></i>'; // Icon rỗng
          // Cập nhật Set
          savedPostIds.delete(postId);
        }
      } else {
        // === TRƯỜNG HỢP 2: CHƯA LƯU -> LƯU ===
        const { error } = await callEdgeFunction("add-bookmark", {
          method: "POST",
          body: { post_id: postId },
        });

        if (error) {
          alert("Lỗi khi lưu: " + error.message);
        } else {
          // Cập nhật UI
          button.classList.add("active");
          button.innerHTML = '<i class="fa-solid fa-heart"></i>'; // Icon đặc
          // Cập nhật Set
          savedPostIds.add(postId);
        }
      }

      button.disabled = false; // Mở lại nút
    });
  });
}

/**
 * === HÀM CẬP NHẬT (NGÀY 6): RENDER ROOMS ===
 * Đã thêm logic để render nút "Lưu" (trái tim)
 */
function renderRooms(rooms) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = ""; // Xóa nội dung cũ (dòng này an toàn)

  if (!rooms || rooms.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có phòng nào phù hợp.</p>`;
    return;
  }

  rooms.forEach((room) => {
    // 1. Tạo các phần tử (KHÔNG dùng chuỗi HTML)
    const div = document.createElement("div");
    div.className = "bg-white rounded shadow p-3 hover:shadow-lg transition";

    const imageSrc =
      Array.isArray(room.image_urls) && room.image_urls.length > 0
        ? room.image_urls[0]
        : "/public/assets/logo2.jpg";

    const img = document.createElement("img");
    img.src = imageSrc;
    img.alt = room.motelName; // gán alt
    img.className = "w-full h-40 object-cover mb-3 rounded";

    const title = document.createElement("h5");
    title.className = "font-bold text-lg mb-1";
    // .textContent sẽ tự động vô hiệu hóa mọi thẻ <script>
    title.textContent = room.motelName || "Chưa có tiêu đề";

    const address = document.createElement("p");
    address.className = "text-gray-600 mb-1";
    address.textContent = room.address_detail || "Chưa có địa chỉ"; // Sửa: Dùng address_detail cho rõ

    const price = document.createElement("p");
    price.className = "text-primary font-semibold mb-2";
    price.textContent = `${room.price?.toLocaleString() || 0} đ/tháng`;

    // 2. Logic Nút (giữ nguyên)
    const isSaved = savedPostIds.has(room.id);
    const saveBtnIcon = isSaved
      ? '<i class="fa-solid fa-heart"></i>' // Icon đặc
      : '<i class="fa-regular fa-heart"></i>'; // Icon rỗng
    const saveBtnClass = isSaved ? "active" : "";

    const buttonWrapper = document.createElement("div");
    buttonWrapper.className = "d-flex align-items-center";

    // Nút Xem chi tiết (dùng innerHTML vì link này do CHÚNG TA tạo)
    const detailLink = document.createElement("a");
    detailLink.href = `chitiet.html?id=${room.id}`;
    detailLink.className = "btn btn-sm btn-primary";
    detailLink.textContent = "Xem chi tiết";

    // Nút Lưu tin (dùng innerHTML vì cần thẻ <i>)
    const saveButton = document.createElement("button");
    saveButton.className = `btn btn-sm btn-outline-danger save-btn ${saveBtnClass}`;
    saveButton.dataset.id = room.id; // gán data-id
    saveButton.style = "margin-left: 8px; width: 40px;";
    saveButton.innerHTML = saveBtnIcon; // An toàn vì icon này do ta kiểm soát

    // 3. Gắn các phần tử vào
    buttonWrapper.appendChild(detailLink);
    buttonWrapper.appendChild(saveButton);

    div.appendChild(img);
    div.appendChild(title);
    div.appendChild(address);
    div.appendChild(price);
    div.appendChild(buttonWrapper);

    roomList.appendChild(div);
  });
  // Gán sự kiện (giữ nguyên)
  addSaveButtonListeners();
}

// (Các hàm 'handleSearch' và 'handleFilter' giữ nguyên)
async function handleSearch(searchQuery) {
  // ... (Giữ nguyên code)
  console.log(`[danhSach.js] Đang chạy tìm kiếm cho: "${searchQuery}"`);
  const defaultTitle = document.getElementById("default-title");
  const defaultQuickLinks = document.getElementById("default-quick-links");
  const desktopFilters = document.getElementById("desktopFilters");
  const searchResultsTitle = document.getElementById("search-results-title");
  const roomList = document.getElementById("roomList");

  if (defaultTitle) defaultTitle.style.display = "none";
  if (defaultQuickLinks) defaultQuickLinks.style.display = "none";
  if (desktopFilters) desktopFilters.style.display = "none";
  if (searchResultsTitle) {
    searchResultsTitle.textContent = `Kết quả tìm kiếm cho: "${searchQuery}"`;
    searchResultsTitle.style.display = "block";
  }

  const { data, error } = await callEdgeFunction("search-posts", {
    method: "GET",
    params: { q: searchQuery },
  });

  if (error) {
    console.error("Lỗi khi tìm kiếm:", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
    return;
  }
  if (data) {
    console.log("Tìm kiếm thành công:", data);
    renderRooms(data);
  }
}
async function handleFilter() {
  // ... (Giữ nguyên code)
  console.log("[danhSach.js] Đang chạy lọc (filter)...");
  const defaultTitle = document.getElementById("default-title");
  const defaultQuickLinks = document.getElementById("default-quick-links");
  const desktopFilters = document.getElementById("desktopFilters");
  const searchResultsTitle = document.getElementById("search-results-title");
  const roomList = document.getElementById("roomList");
  const filterPrice = document.getElementById("filterPrice");
  const filterType = document.getElementById("filterType");
  const filterSize = document.getElementById("roomsize-desktop");
  const filterLocal = document.getElementById("local-desktop");

  if (searchResultsTitle) searchResultsTitle.style.display = "none";
  if (defaultTitle) defaultTitle.style.display = "block";
  if (defaultQuickLinks) defaultQuickLinks.style.display = "block";
  if (desktopFilters) desktopFilters.style.display = "flex";

  const params = new URLSearchParams(window.location.search);
  const urlRoomType = params.get("type");
  const priceValue = filterPrice?.value;
  const typeValue = filterType?.value;
  const sizeValue = filterSize?.value;
  const localValue = filterLocal?.value;
  const paramsObject = {};
  if (urlRoomType) {
    paramsObject.type = urlRoomType;
    if (filterType) filterType.value = urlRoomType;
  } else if (typeValue) {
    paramsObject.type = typeValue;
  }
  if (priceValue) paramsObject.price = priceValue;
  if (sizeValue) paramsObject.size = sizeValue;
  if (localValue) paramsObject.ward = localValue;

  const { data, error } = await callEdgeFunction("get-posts-list", {
    method: "GET",
    params: paramsObject,
  });

  if (error) {
    console.error("Lỗi khi lọc:", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
    return;
  }
  if (data) {
    console.log("Lọc thành công:", data);
    renderRooms(data);
  }
}

/**
 * === HÀM CHẠY CHÍNH (CẬP NHẬT NGÀY 6) ===
 * Đã đổi thành 'async' và thêm 'loadSavedStatus()'
 */
async function initializePage() {
  // Tải trạng thái đăng nhập VÀ tin đã lưu TRƯỚC
  await loadSavedStatus();

  // Kiểm tra xem URL là TÌM KIẾM hay LỌC
  const params = new URLSearchParams(window.location.search);
  const searchQuery = params.get("q");

  if (searchQuery) {
    // 1. Nếu có ?q=... -> Chạy logic TÌM KIẾM
    handleSearch(searchQuery);
  } else {
    // 2. Nếu không -> Chạy logic LỌC (như cũ)
    handleFilter();
  }
}

// Gán sự kiện cho bộ lọc
const filterPrice = document.getElementById("filterPrice");
const filterType = document.getElementById("filterType");
const filterSize = document.getElementById("roomsize-desktop");
const filterLocal = document.getElementById("local-desktop");
[filterPrice, filterType, filterSize, filterLocal].forEach((el) => {
  if (el) {
    el.addEventListener("change", handleFilter);
  }
});

// Tải lần đầu
initializePage();
