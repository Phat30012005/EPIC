/* =======================================
   --- FILE: /public/js/oghep-chitiet.js ---
   (PHIÊN BẢN V2 - KÍCH HOẠT NÚT "LƯU TIN")
   ======================================= */

// --- Biến toàn cục (Global) ---
let currentPostId = null; // Lưu ID của bài đăng hiện tại

/**
 * 1. HÀM CHÍNH: Chạy khi trang tải xong (ĐÃ CẬP NHẬT)
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Trang chi tiết (Ở Ghép) đã tải.");

  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  currentPostId = postId;

  if (!postId || postId === "undefined") {
    document.getElementById("post-detail-container").innerHTML =
      '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng.</h2>';
    return;
  }

  // (SỬA) Chạy song song 2 tác vụ
  try {
    await Promise.all([
      loadPostDetails(postId),
      loadSavedStatus(postId), // <-- (MỚI) Kích hoạt hàm này
    ]);
  } catch (error) {
    console.error("Lỗi nghiêm trọng khi tải trang chi tiết:", error);
    setTextContent("detail-page-title", "Lỗi tải trang");
  }
});

/**
 * 2. Tải thông tin chính của bài đăng (Giữ nguyên từ V1)
 */
async function loadPostDetails(postId) {
  // (SỬA) Gọi Edge Function MỚI: "get-roommate-posting-detail"
  const { data: responseData, error } = await callEdgeFunction(
    "get-roommate-posting-detail",
    {
      params: { id: postId }, // 'id' khớp với backend
      method: "GET",
    }
  );

  if (error) {
    console.error("Lỗi khi tải chi tiết (Edge Function):", error);
    let errorMsg = error.message.includes("404")
      ? "Không tìm thấy tin đăng này."
      : error.message;
    document.getElementById(
      "post-detail-container"
    ).innerHTML = `<h2 class="text-center text-danger">Lỗi: ${errorMsg}</h2>`;
    return; // Dừng hàm
  }

  const post = responseData; // (API client đã unpack)
  if (!post) {
    console.error("Không tìm thấy dữ liệu bài đăng trả về.");
    return;
  }

  // === RENDER DỮ LIỆU (Giữ nguyên) ===
  document.title = `${post.title || "Chi tiết"} | Chicky.stu`;

  setTextContent("detail-title", post.title);
  setTextContent("detail-page-title", "Chi tiết tin tìm ở ghép"); // Tiêu đề H1

  const date = new Date(post.created_at);
  if (!isNaN(date.getTime())) {
    setTextContent(
      "detail-date",
      `Đăng ngày: ${date.toLocaleDateString("vi-VN")}`
    );
  }

  setTextContent(
    "detail-price",
    `${post.price.toLocaleString()} đ/người/tháng`
  );

  setTextContent(
    "detail-posting-type",
    post.posting_type === "OFFERING" ? "Cần tìm người" : "Cần tìm phòng"
  );
  setTextContent("detail-gender", post.gender_preference || "Không yêu cầu");

  setTextContent("detail-ward", post.ward);
  setTextContent("detail-address", post.address_detail || "Không có");

  const descriptionEl = document.getElementById("detail-description");
  if (descriptionEl) {
    descriptionEl.textContent = post.description || "Không có mô tả chi tiết.";
  }

  if (post.profiles) {
    setTextContent(
      "detail-contact-name",
      post.profiles.full_name || "Chưa cập nhật"
    );
    setTextContent(
      "detail-phone",
      post.profiles.phone_number || "Chưa cập nhật"
    );
    setTextContent("detail-email", post.profiles.email || "Chưa cập nhật");
  } else {
    setTextContent("detail-contact-name", "Không rõ");
    setTextContent("detail-phone", "Không rõ");
    setTextContent("detail-email", "Không rõ");
  }
}

// ===========================================
// (SỬA) PHẦN 3: HÀM XỬ LÝ NÚT "LƯU TIN" (MỚI)
// (Copy logic từ chitiet.js và SỬA LẠI)
// ===========================================

/**
 * Tải trạng thái "đã lưu" của tin "ở ghép" này
 */
async function loadSavedStatus(postId) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  // 1. Kiểm tra đăng nhập
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    saveBtn.innerHTML = '<i class="far fa-heart mr-2"></i> Đăng nhập để lưu';
    saveBtn.onclick = () => (window.location.href = "/public/login.html");
    return;
  }

  // 2. (SỬA) Gọi API MỚI: get-user-roommate-bookmarks
  const { data: responseData, error } = await callEdgeFunction(
    "get-user-roommate-bookmarks",
    {
      method: "GET",
    }
  );

  if (error) {
    console.error("Lỗi lấy user roommate bookmarks:", error);
    saveBtn.disabled = true;
    return;
  }

  // 3. (SỬA) Kiểm tra xem 'posting_id' có trong danh sách không
  const bookmarks = responseData;
  // Backend trả về mảng [ { ..., posting: { posting_id: ... } } ]
  const isSaved = bookmarks.some((b) => b.posting.posting_id === postId);

  // 4. Cập nhật UI và gán sự kiện
  updateSaveButtonUI(isSaved);
  setupSaveButton(postId, isSaved);
}

/**
 * Cập nhật giao diện nút (Giống hệt chitiet.js)
 */
function updateSaveButtonUI(isSaved) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;
  if (isSaved) {
    saveBtn.innerHTML = '<i class="fas fa-heart mr-2"></i> Đã lưu';
    saveBtn.classList.add("active");
  } else {
    saveBtn.innerHTML = '<i class="far fa-heart mr-2"></i> Lưu tin';
    saveBtn.classList.remove("active");
  }
  // (MỚI) Kích hoạt nút sau khi load xong
  saveBtn.disabled = false;
  saveBtn.style.opacity = "1";
}

/**
 * Gán sự kiện click cho nút (ĐÃ SỬA)
 */
function setupSaveButton(postId, isCurrentlySaved) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    let isSaved = isCurrentlySaved;

    try {
      if (isSaved) {
        // --- BỎ LƯU (SỬA) ---
        await callEdgeFunction("remove-roommate-bookmark", {
          // <-- SỬA API
          method: "DELETE",
          params: { posting_id: postId }, // <-- SỬA TÊN BIẾN
        });
        isSaved = false;
      } else {
        // --- THÊM LƯU (SỬA) ---
        await callEdgeFunction("add-roommate-bookmark", {
          // <-- SỬA API
          method: "POST",
          body: { posting_id: postId }, // <-- SỬA TÊN BIẾN
        });
        isSaved = true;
      }

      isCurrentlySaved = isSaved;
      updateSaveButtonUI(isSaved);
    } catch (error) {
      console.error("Lỗi khi cập nhật roommate bookmark:", error);
      alert(error.message);
    } finally {
      saveBtn.disabled = false;
    }
  };
}

/**
 * 4. HÀM TIỆN ÍCH (HELPER FUNCTION)
 */
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}
