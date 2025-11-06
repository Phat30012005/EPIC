// =============================
// 🏠 Danh sách phòng trọ - CHICKY.STU
// =============================
async function loadRoomsFromSupabase() {
  console.log("Đang tải dữ liệu từ Supabase...");

  // Đây là API của Supabase:
  // 1. .from('posts'): Chọn bảng 'posts' (mà Team Lead đã tạo)
  // 2. .select('*'): Lấy tất cả các cột
  const { data, error } = await supabase.from("posts").select("*");

  if (error) {
    // Nếu có lỗi (ví dụ: Team Lead quên tắt RLS)
    console.error("Lỗi khi tải dữ liệu:", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
    return;
  }

  if (data) {
    // Nếu thành công, 'data' là một mảng các tin đăng
    console.log("Tải dữ liệu thành công:", data);

    // Gọi hàm renderRooms cũ (đã có sẵn) với dữ liệu THẬT
    renderRooms(data);
  }
}

// (Giữ nguyên hàm function renderRooms(rooms) { ... } - Không cần sửa)

// (Giữ nguyên hàm function applyFilters() { ... } - Sẽ sửa sau)

// (Giữ nguyên các sự kiện addEventListener)

// --- Hiển thị lần đầu ---
// Gọi hàm MỚI của chúng ta khi trang được tải
document.addEventListener("DOMContentLoaded", () => {
  loadRoomsFromSupabase();
});
// --- Lấy các phần tử DOM ---
// === SỬA LỖI: Cập nhật đúng ID ===
const filterPrice = document.getElementById("filterPrice");
const filterType = document.getElementById("filterType");
// === KẾT THÚC SỬA LỖI ===
const filterSize = document.getElementById("roomsize-desktop");
const filterLocal = document.getElementById("local-desktop");
const roomList = document.getElementById("roomList");

// --- Hàm lấy dữ liệu phòng (từ localStorage hoặc window.getRooms) ---
function getRooms() {
  return window.getRooms
    ? window.getRooms()
    : JSON.parse(localStorage.getItem("rooms")) || [];
}

// --- Hàm render danh sách phòng ---
function renderRooms(rooms) {
  roomList.innerHTML = "";
  if (!rooms.length) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4">Không có phòng nào phù hợp.</p>`;
    return;
  }

  rooms.forEach((room) => {
    const div = document.createElement("div");
    div.className = "bg-white rounded shadow p-3 hover:shadow-lg transition";
    div.innerHTML = `
      <img src="${room.images?.[0] || "images/placeholder.jpg"}"
           alt="${room.name}"
           class="w-full h-40 object-cover mb-3 rounded">
      <h5 class="font-bold text-lg mb-1">${room.name}</h5>
      <p class="text-gray-600 mb-1">${room.address || "Chưa có địa chỉ"}</p>
      <p class="text-primary font-semibold mb-2">${room.price?.toLocaleString()} đ/tháng</p>
      <a href="chitiet.html?id=${
        room.id
      }" class="btn btn-sm btn-primary">Xem chi tiết</a>
    `;
    roomList.appendChild(div);
  });
}

// --- Hàm áp dụng bộ lọc ---
function applyFilters() {
  let rooms = getRooms();

  // ✅ Lọc theo giá
  const priceValue = filterPrice?.value;
  if (priceValue === "1-2")
    rooms = rooms.filter((r) => r.price >= 1000000 && r.price <= 2000000);
  else if (priceValue === "3-4")
    rooms = rooms.filter((r) => r.price >= 3000000 && r.price <= 4000000);
  else if (priceValue === "5-6")
    rooms = rooms.filter((r) => r.price >= 5000000 && r.price <= 6000000);
  else if (priceValue === "tren6")
    rooms = rooms.filter((r) => r.price > 6000000);

  // ✅ Lọc theo loại phòng
  const typeValue = filterType?.value;
  if (typeValue && typeValue !== "Loại phòng trọ") {
    rooms = rooms.filter((r) => r.type === typeValue);
  }

  // ✅ Lọc theo diện tích
  const sizeValue = filterSize?.value;
  if (sizeValue === "10-16")
    rooms = rooms.filter((r) => r.area >= 10 && r.area <= 16);
  else if (sizeValue === "17-25")
    rooms = rooms.filter((r) => r.area >= 17 && r.area <= 25);
  else if (sizeValue === "26-35")
    rooms = rooms.filter((r) => r.area >= 26 && r.area <= 35);
  else if (sizeValue === "tren35") rooms = rooms.filter((r) => r.area > 35);

  // ✅ Lọc theo khu vực
  const localValue = filterLocal?.value;
  if (localValue && localValue !== "Khu vực") {
    rooms = rooms.filter((r) =>
      r.address?.toLowerCase().includes(localValue.toLowerCase())
    );
  }

  // ✅ Lưu và hiển thị
  currentRooms = rooms;
  renderRooms(currentRooms);
}

// --- Gán sự kiện cho bộ lọc ---
[filterPrice, filterType, filterSize, filterLocal].forEach((el) => {
  el?.addEventListener("change", applyFilters);
});

