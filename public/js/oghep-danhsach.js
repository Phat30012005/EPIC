/* =======================================
   --- FILE: public/js/oghep-danhsach.js ---
   (Clone từ danhSach.js và chỉnh sửa cho tính năng Ở Ghép)
   ======================================= */

// (XÓA) Toàn bộ logic "Lưu tin" (savedPostIds, loadSavedStatus, addSaveButtonListeners)

/**
 * === (SỬA) HÀM RENDER MỚI: renderPostings ===
 * Hiển thị các "thẻ" (card) tin tìm ở ghép, thay vì thẻ phòng trọ.
 */
function renderPostings(postings) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = ""; // Xóa nội dung cũ

  if (!postings || postings.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có tin nào phù hợp với bộ lọc của bạn.</p>`;
    return;
  }

  postings.forEach((post) => {
    // 1. Tạo các phần tử
    const div = document.createElement("div");
    // Dùng class 'app-card' từ style.css
    // và thêm flex col để đẩy footer xuống
    div.className = "app-card p-4 flex flex-col shadow-md";

    // 2. (MỚI) Tag Loại tin (Cần người / Tìm phòng)
    const typeTag = document.createElement("span");
    const isOffering = post.posting_type === "OFFERING";
    typeTag.className = `badge ${
      isOffering ? "bg-success" : "bg-info"
    } mb-2 align-self-start`;
    typeTag.textContent = isOffering ? "Cần người" : "Tìm phòng";

    // 3. (GIỮ) Tiêu đề
    const title = document.createElement("h5");
    title.className = "font-bold text-lg mb-1";
    // Dùng .textContent để chống lỗi XSS
    title.textContent = post.title;

    // 4. (SỬA) Giá và Khu vực
    const price = document.createElement("p");
    price.className = "text-primary font-semibold mb-1";
    price.textContent = `${post.price?.toLocaleString() || 0} đ/người`;

    const ward = document.createElement("p");
    ward.className = "text-gray-600 mb-2";
    ward.textContent = `Khu vực: ${post.ward}`;

    // 5. (SỬA) Mô tả ngắn
    // 'flex-grow-1' rất quan trọng để đẩy footer (người đăng) xuống cuối card
    const description = document.createElement("p");
    description.className = "text-gray-700 mb-3 flex-grow-1";
    const shortDesc =
      post.description.substring(0, 100) +
      (post.description.length > 100 ? "..." : "");
    description.textContent = shortDesc || "Không có mô tả.";

    // 6. (MỚI) Thông tin người đăng (LẤY TỪ JOIN 'profiles')
    const profileDiv = document.createElement("div");
    profileDiv.className = "border-t pt-2 d-flex align-items-center";

    // Dùng logo2.jpg làm avatar mặc định nếu user không có
    const avatarSrc = post.profiles?.avatar_url || "/public/assets/logo2.jpg";
    const profileName = post.profiles?.full_name || "Người dùng ẩn danh";

    profileDiv.innerHTML = `
        <img src="${avatarSrc}" alt="avatar" class="rounded-circle" style="width: 30px; height: 30px; margin-right: 8px; object-fit: cover;">
        <span class="text-sm text-gray-500">Đăng bởi: ${profileName}</span>
    `;

    // 7. (SỬA) Nút "Xem chi tiết"
    // (Chúng ta chưa làm trang chi tiết, nên tạm thời link tới #)
    const detailLink = document.createElement("a");
    // TODO: Sau này đổi href sang 'oghep-chitiet.html?id=${post.posting_id}'
    detailLink.href = `#`;
    detailLink.className = "btn btn-sm btn-primary mt-3";
    detailLink.textContent = "Xem chi tiết";

    // 8. Gắn các phần tử vào card
    div.appendChild(typeTag);
    div.appendChild(title);
    div.appendChild(price);
    div.appendChild(ward);
    div.appendChild(description);
    div.appendChild(profileDiv);
    div.appendChild(detailLink);

    roomList.appendChild(div);
  });

  // (XÓA) Lệnh gọi addSaveButtonListeners();
}

/**
 * (XÓA) Hàm handleSearch()
 */

/**
 * === (SỬA) HÀM handleFilter ===
 * Cập nhật để đọc các bộ lọc mới và gọi Edge Function mới.
 */
async function handleFilter() {
  console.log("[oghep-danhsach.js] Đang chạy lọc (filter)...");

  // (SỬA) Lấy các element filter MỚI từ oghep-danhsach.html
  const filterPrice = document.getElementById("filterPrice");
  const filterLocal = document.getElementById("local-desktop");
  const filterPostingType = document.getElementById("filterPostingType");
  const filterGender = document.getElementById("filterGender");

  const roomList = document.getElementById("roomList");

  // (SỬA) Lấy giá trị từ các bộ lọc MỚI
  const paramsObject = {};
  if (filterPrice?.value) paramsObject.price = filterPrice.value;
  if (filterLocal?.value) paramsObject.ward = filterLocal.value;
  if (filterPostingType?.value)
    paramsObject.posting_type = filterPostingType.value;
  if (filterGender?.value) paramsObject.gender_preference = filterGender.value;

  // (SỬA) Gọi Edge Function MỚI: 'get-roommate-postings'
  const { data, error } = await callEdgeFunction("get-roommate-postings", {
    method: "GET",
    params: paramsObject, // Gửi các filter làm query params
  });

  if (error) {
    console.error("Lỗi khi lọc (ở ghép):", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
    return;
  }

  // 'data' trả về là mảng (theo backend 'get-roommate-postings')
  if (data) {
    console.log("Lọc (ở ghép) thành công:", data);
    renderPostings(data); // Gọi hàm render MỚI
  }
}

/**
 * === (SỬA) HÀM CHẠY CHÍNH ===
 * (Đã XÓA logic 'loadSavedStatus' và logic 'searchQuery')
 */
async function initializePage() {
  // Chỉ chạy logic LỌC (để tải toàn bộ tin ban đầu)
  handleFilter();
}

// (SỬA) Gán sự kiện cho bộ lọc MỚI
const filterPrice = document.getElementById("filterPrice");
const filterLocal = document.getElementById("local-desktop");
const filterPostingType = document.getElementById("filterPostingType");
const filterGender = document.getElementById("filterGender");

[filterPrice, filterLocal, filterPostingType, filterGender].forEach((el) => {
  if (el) {
    el.addEventListener("change", handleFilter);
  }
});

// Tải lần đầu
initializePage();
