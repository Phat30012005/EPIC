// public/js/danhSach.js
// === ĐÃ CẬP NHẬT (NGÀY 6) ĐỂ THÊM LOGIC TÌM KIẾM ===

document.addEventListener("DOMContentLoaded", () => {
  // 1. Lấy các phần tử DOM (Giữ nguyên)
  const filterPrice = document.getElementById("filterPrice");
  const filterType = document.getElementById("filterType");
  const filterSize = document.getElementById("roomsize-desktop");
  const filterLocal = document.getElementById("local-desktop");
  const roomList = document.getElementById("roomList");

  // Lấy các phần tử UI mới
  const defaultTitle = document.getElementById("default-title");
  const defaultQuickLinks = document.getElementById("default-quick-links");
  const desktopFilters = document.getElementById("desktopFilters");
  const searchResultsTitle = document.getElementById("search-results-title");

  if (!roomList) {
    console.error("Không tìm thấy #roomList");
    return;
  }

  // 2. Hàm render (Giữ nguyên)
  function renderRooms(rooms) {
    roomList.innerHTML = "";
    if (!rooms || rooms.length === 0) {
      roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có phòng nào phù hợp.</p>`;
      return;
    }
    rooms.forEach((room) => {
      // (Render logic giống hệt như cũ)
      const div = document.createElement("div");
      div.className = "bg-white rounded shadow p-3 hover:shadow-lg transition";
      const imageSrc =
        Array.isArray(room.image_url) && room.image_url.length > 0
          ? room.image_url[0]
          : "/public/assets/logo2.jpg";
      div.innerHTML = `
        <img src="${imageSrc}" alt="${
        room.title
      }" class="w-full h-40 object-cover mb-3 rounded">
        <h5 class="font-bold text-lg mb-1">${
          room.title || "Chưa có tiêu đề"
        }</h5>
        <p class="text-gray-600 mb-1">${room.address || "Chưa có địa chỉ"}</p>
        <p class="text-primary font-semibold mb-2">${
          room.price?.toLocaleString() || 0
        } đ/tháng</p>
        <a href="chitiet.html?id=${
          room.id
        }" class="btn btn-sm btn-primary">Xem chi tiết</a>
      `;
      roomList.appendChild(div);
    });
  }

  // === HÀM MỚI (NGÀY 6): XỬ LÝ TÌM KIẾM ===
  /**
   * Chạy logic tìm kiếm (gọi function 'search-posts')
   * @param {string} searchQuery - Từ khóa tìm kiếm
   */
  async function handleSearch(searchQuery) {
    console.log(`[danhSach.js] Đang chạy tìm kiếm cho: "${searchQuery}"`);

    // 1. Cập nhật UI
    if (defaultTitle) defaultTitle.style.display = "none";
    if (defaultQuickLinks) defaultQuickLinks.style.display = "none";
    if (desktopFilters) desktopFilters.style.display = "none";

    if (searchResultsTitle) {
      searchResultsTitle.textContent = `Kết quả tìm kiếm cho: "${searchQuery}"`;
      searchResultsTitle.style.display = "block";
    }

    // 2. Gọi Edge Function 'search-posts'
    const { data, error } = await callEdgeFunction("search-posts", {
      method: "GET",
      params: { q: searchQuery }, // API yêu cầu tham số 'q'
    });

    // 3. Xử lý kết quả
    if (error) {
      console.error("Lỗi khi tìm kiếm:", error);
      roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
      return;
    }
    if (data) {
      // Function 'search-posts' trả về { data: [...] }
      console.log("Tìm kiếm thành công:", data.data);
      renderRooms(data.data);
    }
  }

  // === HÀM CŨ (NGÀY 3): XỬ LÝ LỌC ===
  /**
   * Chạy logic lọc (gọi function 'get-posts-list')
   */
  async function handleFilter() {
    console.log("[danhSach.js] Đang chạy lọc (filter)...");

    // 1. Cập nhật UI (đảm bảo UI tìm kiếm bị ẩn)
    if (searchResultsTitle) searchResultsTitle.style.display = "none";

    // (Đảm bảo UI mặc định được BẬT)
    if (defaultTitle) defaultTitle.style.display = "block";
    if (defaultQuickLinks) defaultQuickLinks.style.display = "block";
    if (desktopFilters) desktopFilters.style.display = "flex";

    // 2. Thu thập params (Giống hệt code cũ của Tâm)
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

    // 3. Gọi Edge Function 'get-posts-list'
    const { data, error } = await callEdgeFunction("get-posts-list", {
      method: "GET",
      params: paramsObject,
    });

    // 4. Xử lý kết quả
    if (error) {
      console.error("Lỗi khi lọc:", error);
      roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
      return;
    }
    if (data) {
      console.log("Lọc thành công:", data.data);
      renderRooms(data.data);
    }
  }

  // === HÀM CHẠY CHÍNH (ĐÃ CẬP NHẬT) ===
  function initializePage() {
    // Kiểm tra xem URL là TÌM KIẾM hay LỌC
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get("q"); // Lấy tham số 'q'

    if (searchQuery) {
      // 1. Nếu có ?q=... -> Chạy logic TÌM KIẾM
      handleSearch(searchQuery);
    } else {
      // 2. Nếu không -> Chạy logic LỌC (như cũ)
      handleFilter();
    }
  }

  // Gán sự kiện cho bộ lọc (chỉ gán cho LỌC)
  [filterPrice, filterType, filterSize, filterLocal].forEach((el) => {
    if (el) {
      el.addEventListener("change", handleFilter);
    }
  });

  // Tải lần đầu
  initializePage();
});
