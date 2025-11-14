/* =======================================
   --- FILE: /public/js/oghep-chitiet.js ---
   (Clone từ chitiet.js và sửa lại cho "Ở Ghép")
   ======================================= */

// --- Biến toàn cục (Global) ---
let currentPostId = null; // Lưu ID của bài đăng hiện tại

/**
 * 1. HÀM CHÍNH: Chạy khi trang tải xong
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Trang chi tiết (Ở Ghép) đã tải.");

  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  currentPostId = postId; // Lưu vào biến toàn cục

  if (!postId || postId === "undefined") {
    document.getElementById("post-detail-container").innerHTML =
      '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng.</h2>';
    return;
  }

  // Chạy 2 tác vụ:
  // 1. Tải thông tin bài đăng
  // 2. Vô hiệu hóa nút "Lưu tin" (chờ làm ở bước sau)
  try {
    await loadPostDetails(postId);
    setupSaveButtonStub(); // (Tạm thời vô hiệu hóa nút Lưu)
  } catch (error) {
    console.error("Lỗi nghiêm trọng khi tải trang chi tiết:", error);
    setTextContent("detail-page-title", "Lỗi tải trang");
  }
});

/**
 * 2. Tải thông tin chính của bài đăng
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

  // === RENDER DỮ LIỆU ===
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

  // (MỚI) Điền các trường mới
  setTextContent(
    "detail-posting-type",
    post.posting_type === "OFFERING" ? "Cần tìm người" : "Cần tìm phòng"
  );
  setTextContent("detail-gender", post.gender_preference || "Không yêu cầu");

  // (GIỮ LẠI) Các trường cũ
  setTextContent("detail-ward", post.ward);
  setTextContent("detail-address", post.address_detail || "Không có"); // (Sẽ trống nếu bạn chưa sửa backend create)

  const descriptionEl = document.getElementById("detail-description");
  if (descriptionEl) {
    descriptionEl.textContent = post.description || "Không có mô tả chi tiết.";
  }

  // (GIỮ LẠI) Thông tin liên hệ (Backend đã JOIN 'profiles')
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

  // (XÓA) Logic renderImages
  // (XÓA) Logic loadReviews
}

/**
 * 3. HÀM TẠM THỜI (Vô hiệu hóa nút Lưu)
 */
function setupSaveButtonStub() {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="far fa-heart mr-2"></i> Lưu (Sắp có)';
  saveBtn.style.opacity = "0.6";
}

/**
 * 4. HÀM TIỆN ÍCH (HELPER FUNCTION)
 */

// Hàm tiện ích (Giữ nguyên từ chitiet.js)
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}

// (XÓA) Hàm renderImages
// (XÓA) Hàm renderStars
