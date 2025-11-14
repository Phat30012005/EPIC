/* =======================================
   --- FILE: public/js/oghep-danhsach.js ---
   (PHIÊN BẢN V3 - Thêm nút "Lưu tin" 
   cho danh sách ở ghép)
   ======================================= */

// (MỚI) Biến toàn cục để lưu ID các tin đã lưu
let savedRoommatePostIds = new Set();

/**
 * (MỚI) HÀM TẢI TRẠNG THÁI ĐÃ LƯU
 * (Copy từ danhSach.js và SỬA LẠI)
 */
async function loadSavedRoommateStatus() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.log(
      "[oghep-danhsach.js] User chưa đăng nhập. Không tải tin đã lưu."
    );
    return;
  }

  // (SỬA) Gọi API MỚI: get-user-roommate-bookmarks
  const { data, error } = await callEdgeFunction(
    "get-user-roommate-bookmarks",
    {
      method: "GET",
    }
  );

  if (error) {
    console.error("Lỗi tải trạng thái đã lưu (ở ghép):", error);
  } else if (data) {
    // Backend trả về [ { ..., posting: { posting_id: ... } } ]
    const postIds = data
      .filter((b) => b.posting)
      .map((b) => b.posting.posting_id); // (SỬA) Lấy posting_id

    savedRoommatePostIds = new Set(postIds);
    console.log(
      `[oghep-danhsach.js] Đã tải ${savedRoommatePostIds.size} tin (ở ghép) đã lưu.`
    );
  }
}

/**
 * (MỚI) HÀM GÁN SỰ KIỆN CHO CÁC NÚT LƯU
 * (Copy từ danhSach.js và SỬA LẠI)
 */
function addRoommateSaveButtonListeners() {
  document.querySelectorAll(".save-roommate-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const postId = button.dataset.id; // Lấy 'posting_id'

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        alert("Bạn cần đăng nhập để lưu tin!");
        window.location.href = "/public/login.html";
        return;
      }

      button.disabled = true;

      if (button.classList.contains("active")) {
        // --- BỎ LƯU (SỬA) ---
        const { error } = await callEdgeFunction("remove-roommate-bookmark", {
          // <-- SỬA API
          method: "DELETE",
          params: { posting_id: postId }, // <-- SỬA TÊN BIẾN
        });

        if (error) {
          alert("Lỗi bỏ lưu: " + error.message);
        } else {
          button.classList.remove("active");
          button.innerHTML = '<i class="fa-regular fa-heart"></i>'; // Icon rỗng
          savedRoommatePostIds.delete(postId);
        }
      } else {
        // --- THÊM LƯU (SỬA) ---
        const { error } = await callEdgeFunction("add-roommate-bookmark", {
          // <-- SỬA API
          method: "POST",
          body: { posting_id: postId }, // <-- SỬA TÊN BIẾN
        });

        if (error) {
          alert("Lỗi khi lưu: " + error.message);
        } else {
          button.classList.add("active");
          button.innerHTML = '<i class="fa-solid fa-heart"></i>'; // Icon đặc
          savedRoommatePostIds.add(postId);
        }
      }
      button.disabled = false;
    });
  });
}

/**
 * === (SỬA) HÀM RENDER MỚI: renderPostings (V3) ===
 * (Thêm nút Lưu tin vào card)
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

    // (Phần trên giữ nguyên)
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

    // === (SỬA) THÊM NÚT LƯU TIN VÀO card ===
    const buttonWrapper = document.createElement("div");
    buttonWrapper.className = "d-flex align-items-center mt-3";

    const detailLink = document.createElement("a");
    detailLink.href = `/public/oghep-chitiet.html?id=${post.posting_id}`;
    detailLink.className = "btn btn-sm btn-primary";
    detailLink.textContent = "Xem chi tiết";

    // (MỚI) Logic Nút Lưu (Copy từ danhSach.js)
    const isSaved = savedRoommatePostIds.has(post.posting_id);
    const saveBtnIcon = isSaved
      ? '<i class="fa-solid fa-heart"></i>' // Icon đặc
      : '<i class="fa-regular fa-heart"></i>'; // Icon rỗng
    const saveBtnClass = isSaved ? "active" : "";

    const saveButton = document.createElement("button");
    // (SỬA) Dùng class 'save-roommate-btn' mới và style từ 'danhSach.html'
    saveButton.className = `btn btn-sm btn-outline-danger save-roommate-btn ${saveBtnClass}`;
    saveButton.dataset.id = post.posting_id;
    saveButton.style = "margin-left: 8px; width: 40px;";
    saveButton.innerHTML = saveBtnIcon;

    buttonWrapper.appendChild(detailLink);
    buttonWrapper.appendChild(saveButton); // <-- (MỚI) Thêm nút Lưu vào
    // === KẾT THÚC SỬA ĐỔI ===

    div.appendChild(typeTag);
    div.appendChild(title);
    div.appendChild(price);
    div.appendChild(ward);
    div.appendChild(description);
    div.appendChild(profileDiv);
    div.appendChild(buttonWrapper); // <-- (SỬA) Thêm buttonWrapper

    roomList.appendChild(div);
  });

  // (MỚI) Gán sự kiện cho các nút lưu
  addRoommateSaveButtonListeners();
}

/**
 * === (SỬA) HÀM handleFilter ===
 * (Giữ nguyên, không đổi so với V2)
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
 * === (SỬA) HÀM CHẠY CHÍNH ===
 */
async function initializePage() {
  // (MỚI) Tải trạng thái đăng nhập VÀ tin đã lưu TRƯỚC
  await loadSavedRoommateStatus();

  // Sau đó mới chạy lọc (để render các nút trái tim cho đúng)
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
