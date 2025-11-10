// public/js/danhSach.js
// (ĐÃ REFACTOR ĐỂ GỌI EDGE FUNCTION 'get-posts-list' - VAI TÂM)

document.addEventListener("DOMContentLoaded", () => {
  // 1. Lấy các phần tử DOM (Giữ nguyên)
  const filterPrice = document.getElementById("filterPrice");
  const filterType = document.getElementById("filterType");
  const filterSize = document.getElementById("roomsize-desktop");
  const filterLocal = document.getElementById("local-desktop");
  const roomList = document.getElementById("roomList");

  if (!roomList) {
    console.error("Không tìm thấy #roomList");
    return;
  }

  // 2. Hàm render danh sách phòng (Giữ nguyên)
  // Hàm này không cần thay đổi vì nó chỉ nhận
  // dữ liệu (data) và render ra HTML.
  function renderRooms(rooms) {
    roomList.innerHTML = ""; // Xóa nội dung cũ
    if (!rooms || rooms.length === 0) {
      roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có phòng nào phù hợp.</p>`;
      return;
    }

    rooms.forEach((room) => {
      const div = document.createElement("div");
      div.className = "bg-white rounded shadow p-3 hover:shadow-lg transition";

      const imageSrc =
        Array.isArray(room.image_url) && room.image_url.length > 0
          ? room.image_url[0]
          : "/public/assets/logo2.jpg";

      div.innerHTML = `
        <img src="${imageSrc}"
             alt="${room.title}"
             class="w-full h-40 object-cover mb-3 rounded">
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

  // 3. === HÀM TẢI DỮ LIỆU (ĐÃ REFACTOR HOÀN TOÀN) ===
  async function loadAndFilterRooms() {
    console.log("Đang tải dữ liệu từ Edge Function 'get-posts-list'...");

    // A. Xóa toàn bộ logic query 'supabase.from(...)' cũ

    // B. Thu thập tất cả các giá trị filter
    const params = new URLSearchParams(window.location.search);
    const urlRoomType = params.get("type");

    const priceValue = filterPrice?.value;
    const typeValue = filterType?.value;
    const sizeValue = filterSize?.value;
    const localValue = filterLocal?.value;

    // C. Tạo một object 'params' sạch
    // 'api-client.js' sẽ biến object này thành query string
    const paramsObject = {};

    // Ưu tiên filter từ URL (nếu có)
    if (urlRoomType) {
      paramsObject.type = urlRoomType;
      // Cập nhật giá trị dropdown cho khớp
      if (filterType) filterType.value = urlRoomType;
    } else if (typeValue) {
      paramsObject.type = typeValue;
    }

    // Thêm các filter khác (nếu chúng có giá trị, tức là không phải "")
    if (priceValue) paramsObject.price = priceValue;
    if (sizeValue) paramsObject.size = sizeValue; // 'size' khớp với backend
    if (localValue) paramsObject.ward = localValue; // 'ward' khớp với backend

    console.log("[danhSach.js] Đang gọi function với params:", paramsObject);

    // D. Gọi Edge Function (dùng 'api-client.js')
    const { data, error } = await callEdgeFunction("get-posts-list", {
      method: "GET", // Dùng GET để lấy dữ liệu
      params: paramsObject, // 'api-client' sẽ tự thêm vào URL
    });

    // E. Xử lý kết quả
    if (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
      roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
      return;
    }

    if (data) {
      // **LƯU Ý:** Function của chúng ta trả về { data: [...] }
      // nên 'data.data' mới là mảng các bài đăng
      console.log("Tải dữ liệu thành công:", data.data);
      renderRooms(data.data);
    }
  }
  // === KẾT THÚC REFACTOR ===

  // 4. Gán sự kiện cho bộ lọc (Giữ nguyên)
  [filterPrice, filterType, filterSize, filterLocal].forEach((el) => {
    if (el) {
      el.addEventListener("change", loadAndFilterRooms);
    }
  });

  // 5. Tải lần đầu (Giữ nguyên)
  loadAndFilterRooms();
});
