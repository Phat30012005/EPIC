/* =======================================
   --- FILE: public/js/oghep-danhsach.js ---
   (PHIÊN BẢN V2 - Đã cập nhật link "Xem chi tiết")
   ======================================= */

/**
 * === (SỬA) HÀM RENDER MỚI: renderPostings ===
 */
function renderPostings(postings) {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";

  if (!postings || postings.length === 0) {
    roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có tin nào phù hợp với bộ lọc của bạn.</p>`;
    return;
  }

  postings.forEach((post) => {
    const div = document.createElement("div");
    div.className = "app-card p-4 flex flex-col shadow-md";

    const typeTag = document.createElement("span");
    const isOffering = post.posting_type === "OFFERING";
    typeTag.className = `badge ${
      isOffering ? "bg-success" : "bg-info"
    } mb-2 align-self-start`;
    typeTag.textContent = isOffering ? "Cần người" : "Tìm phòng";

    const title = document.createElement("h5");
    title.className = "font-bold text-lg mb-1";
    title.textContent = post.title;

    const price = document.createElement("p");
    price.className = "text-primary font-semibold mb-1";
    price.textContent = `${post.price?.toLocaleString() || 0} đ/người`;

    const ward = document.createElement("p");
    ward.className = "text-gray-600 mb-2";
    ward.textContent = `Khu vực: ${post.ward}`;

    const description = document.createElement("p");
    description.className = "text-gray-700 mb-3 flex-grow-1";
    const shortDesc =
      post.description.substring(0, 100) +
      (post.description.length > 100 ? "..." : "");
    description.textContent = shortDesc || "Không có mô tả.";

    const profileDiv = document.createElement("div");
    profileDiv.className = "border-t pt-2 d-flex align-items-center";

    const avatarSrc = post.profiles?.avatar_url || "/public/assets/logo2.jpg";
    const profileName = post.profiles?.full_name || "Người dùng ẩn danh";

    profileDiv.innerHTML = `
        <img src="${avatarSrc}" alt="avatar" class="rounded-circle" style="width: 30px; height: 30px; margin-right: 8px; object-fit: cover;">
        <span class="text-sm text-gray-500">Đăng bởi: ${profileName}</span>
    `;

    // === (SỬA ĐỔI QUAN TRỌNG) ===
    // Sửa link href từ "#" sang link chi tiết
    const detailLink = document.createElement("a");
    // Chúng ta dùng `post.posting_id` vì CSDL của bạn dùng 'posting_id'
    detailLink.href = `/public/oghep-chitiet.html?id=${post.posting_id}`;
    detailLink.className = "btn btn-sm btn-primary mt-3";
    detailLink.textContent = "Xem chi tiết";
    // === KẾT THÚC SỬA ĐỔI ===

    // Gắn các phần tử vào card
    div.appendChild(typeTag);
    div.appendChild(title);
    div.appendChild(price);
    div.appendChild(ward);
    div.appendChild(description);
    div.appendChild(profileDiv);
    div.appendChild(detailLink);

    roomList.appendChild(div);
  });
}

/**
 * === (SỬA) HÀM handleFilter ===
 * (Giữ nguyên như V1, không đổi)
 */
async function handleFilter() {
  console.log("[oghep-danhsach.js] Đang chạy lọc (filter)...");

  const filterPrice = document.getElementById("filterPrice");
  const filterLocal = document.getElementById("local-desktop");
  const filterPostingType = document.getElementById("filterPostingType");
  const filterGender = document.getElementById("filterGender");

  const roomList = document.getElementById("roomList");

  const paramsObject = {};
  if (filterPrice?.value) paramsObject.price = filterPrice.value;
  if (filterLocal?.value) paramsObject.ward = filterLocal.value;
  if (filterPostingType?.value)
    paramsObject.posting_type = filterPostingType.value;
  if (filterGender?.value) paramsObject.gender_preference = filterGender.value;

  const { data, error } = await callEdgeFunction("get-roommate-postings", {
    method: "GET",
    params: paramsObject,
  });

  if (error) {
    console.error("Lỗi khi lọc (ở ghép):", error);
    roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
    return;
  }

  if (data) {
    console.log("Lọc (ở ghép) thành công:", data);
    renderPostings(data);
  }
}

/**
 * === HÀM CHẠY CHÍNH ===
 * (Giữ nguyên như V1, không đổi)
 */
async function initializePage() {
  handleFilter();
}

// (Giữ nguyên) Gán sự kiện
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
