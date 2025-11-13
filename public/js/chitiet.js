/* =======================================
   --- FILE: /public/js/chitiet.js ---
   (ĐÃ NÂNG CẤP NGÀY 6: Thêm Lưu tin)
   (ĐÃ NÂNG CẤP NGÀY 7: Thêm Đánh giá)
   ======================================= */

// --- Biến toàn cục (Global) ---
let currentPostId = null; // Lưu ID của bài đăng hiện tại
let currentRating = 0; // Lưu số sao user đang chọn

/**
 * 1. HÀM CHÍNH: Chạy khi trang tải xong
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Trang chi tiết đã tải. Bắt đầu lấy dữ liệu...");

  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  currentPostId = postId; // Lưu vào biến toàn cục

  if (!postId || postId === "undefined") {
    document.getElementById("post-detail-container").innerHTML =
      '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng. Vui lòng quay lại trang danh sách.</h2>';
    return;
  }

  // Chạy song song 3 tác vụ:
  // 1. Tải thông tin bài đăng (bắt buộc)
  // 2. Tải trạng thái "đã lưu" (nếu user đăng nhập)
  // 3. Tải các đánh giá (public)
  // 4. Khởi tạo form đánh giá (kiểm tra đăng nhập)
  try {
    // Chờ 4 hàm này chạy xong
    // (loadSavedStatus đã bao gồm setupSaveButton)
    await Promise.all([
      loadPostDetails(postId),
      loadSavedStatus(postId),
      loadReviews(postId),
      setupReviewForm(postId),
    ]);

    console.log("Tải trang chi tiết hoàn tất.");
  } catch (error) {
    console.error("Lỗi nghiêm trọng khi tải trang chi tiết:", error);
    setTextContent("detail-page-title", "Lỗi tải trang");
  }
});

/**
 * 2. Tải thông tin chính của bài đăng
 */
// [THAY THẾ HÀM NÀY]
async function loadPostDetails(postId) {
  // Gọi Edge Function "get-post-detail"
  const { data: responseData, error } = await callEdgeFunction(
    "get-post-detail",
    {
      params: { id: postId }, // 'id' khớp với backend V2
      method: "GET",
    }
  );

  if (error) {
    console.error("Lỗi khi tải chi tiết (Edge Function):", error);
    document.getElementById(
      "post-detail-container"
    ).innerHTML = `<h2 class="text-center text-danger">Lỗi: ${error.message}</h2>`;
    return; // Dừng hàm
  }

  const post = responseData; // (API client đã unpack)
  if (!post) {
    console.error("Không tìm thấy dữ liệu bài đăng trả về.");
    return;
  }

  // === RENDER DỮ LIỆU ===
  document.title = `${post.title || "Chi tiết"} | Chicky.stu`;

  // (SỬA LỖI 1: Hiển thị Tên trọ ở H2, Tiêu đề ở H1)
  setTextContent("detail-title", post.title);
  setTextContent("detail-page-title", post.motelName);

  const date = new Date(post.created_at);
  if (!isNaN(date.getTime())) {
    setTextContent(
      "detail-date",
      `Đăng ngày: ${date.toLocaleDateString("vi-VN")}`
    );
  } else {
    setTextContent("detail-date", "Đăng ngày: Không rõ");
  }

  setTextContent(
    "detail-price",
    `${(post.price / 1000000).toFixed(1)} triệu/tháng`
  );
  setTextContent("detail-area", `${post.area} m²`);
  setTextContent("detail-rooms", post.rooms || "Không rõ");
  setTextContent("detail-ward", post.ward);
  setTextContent("detail-address", post.address_detail); // (Khớp CSDL V5)
  const descriptionEl = document.getElementById("detail-description");
  if (descriptionEl) {
    descriptionEl.textContent = post.description || "Không có mô tả chi tiết.";
  }

  // (SỬA LỖI 6: Lấy thông tin liên hệ từ 'profiles' đã JOIN)
  if (post.profiles) {
    setTextContent(
      "detail-contact-name",
      post.profiles.full_name || "Chưa cập nhật" // <--- SỬA
    );
    setTextContent(
      "detail-phone",
      post.profiles.phone_number || "Chưa cập nhật" // <--- SỬA
    );
    setTextContent(
      "detail-email",
      post.profiles.email || "Chưa cập nhật" // <--- SỬA
    );
  } else {
    setTextContent("detail-contact-name", "Không rõ");
    setTextContent("detail-phone", "Không rõ");
    setTextContent("detail-email", "Không rõ");
  }

  // Highlights
  const highlightsContainer = document.getElementById("detail-highlights");
  if (post.highlights && post.highlights.length > 0) {
    highlightsContainer.innerHTML = "";
    post.highlights.forEach((item) => {
      const div = document.createElement("div");
      div.className = "highlight-item";
      div.innerHTML = `<i class="fa-solid fa-check-circle mr-2 text-green-500"></i> ${item}`;
      highlightsContainer.appendChild(div);
    });
  } else {
    highlightsContainer.innerHTML = "<p>Không có tiện ích nổi bật.</p>";
  }

  // Hình ảnh
  renderImages(post.image_urls, post.title); // (Đã sửa ở lần trước)
}
/**
 * 3. HÀM XỬ LÝ NÚT "LƯU TIN" (NGÀY 6)
 */
async function loadSavedStatus(postId) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  // Kiểm tra user có đăng nhập không
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    saveBtn.innerHTML = '<i class="far fa-heart mr-2"></i> Đăng nhập để lưu';
    saveBtn.onclick = () => (window.location.href = "/public/login.html");
    return;
  }

  // User đã đăng nhập, gọi API lấy danh sách đã lưu
  const { data: responseData, error } = await callEdgeFunction(
    "get-user-bookmarks",
    {
      method: "GET",
    }
  );

  if (error) {
    console.error("Lỗi lấy user bookmarks:", error);
    saveBtn.disabled = true;
    return;
  }

  // Kiểm tra xem post này có trong danh sách không
  const bookmarks = responseData;
  const isSaved = bookmarks.some((b) => b.post.id === postId);

  // Cập nhật UI và gán sự kiện
  updateSaveButtonUI(isSaved);
  setupSaveButton(postId, isSaved);
}

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
}

function setupSaveButton(postId, isCurrentlySaved) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  saveBtn.onclick = async () => {
    saveBtn.disabled = true; // Chống click đúp

    let isSaved = isCurrentlySaved; // Trạng thái hiện tại

    try {
      if (isSaved) {
        // --- BỎ LƯU ---
        await callEdgeFunction("remove-bookmark", {
          method: "DELETE",
          params: { post_id: postId },
        });
        isSaved = false;
      } else {
        // --- THÊM LƯU ---
        await callEdgeFunction("add-bookmark", {
          method: "POST",
          body: { post_id: postId },
        });
        isSaved = true;
      }

      // Cập nhật lại trạng thái (local)
      isCurrentlySaved = isSaved;
      updateSaveButtonUI(isSaved);
    } catch (error) {
      console.error("Lỗi khi cập nhật bookmark:", error);
      alert(error.message);
    } finally {
      saveBtn.disabled = false;
    }
  };
}

/**
 * 4. HÀM XỬ LÝ ĐÁNH GIÁ (NGÀY 7 - MỚI)
 */

// Tải tất cả review
async function loadReviews(postId) {
  const loadingEl = document.getElementById("reviews-list-loading");

  const { data: responseData, error } = await callEdgeFunction(
    "get-reviews-for-post",
    {
      params: { post_id: postId },
      method: "GET",
    }
  );

  if (error) {
    loadingEl.innerHTML = `<p class="text-red-500">Lỗi khi tải đánh giá: ${error.message}</p>`;
    return;
  }

  if (responseData.length === 0) {
    loadingEl.innerHTML = "<p>Chưa có đánh giá nào cho tin này.</p>";
  } else {
    loadingEl.style.display = "none";
  }

  renderReviews(responseData);
}

// Hiển thị review ra HTML
// === CODE MỚI: THAY THẾ HÀM renderReviews ===
// (Đã sửa lỗi XSS)
function renderReviews(reviews) {
  const listEl = document.getElementById("reviews-list");
  listEl.innerHTML = ""; // Xóa nội dung cũ

  reviews.forEach((review) => {
    // 1. Lấy dữ liệu an toàn
    const reviewerName = review.profiles?.full_name || "Người dùng ẩn danh"; // Sửa: Dùng full_name
    const reviewDate = new Date(review.created_at).toLocaleDateString("vi-VN");
    const starsHtml = renderStars(review.rating, "1.25rem"); // Hàm này an toàn

    // 2. Tạo các phần tử
    const reviewDiv = document.createElement("div");
    reviewDiv.className = "border-b pb-4";

    const headerDiv = document.createElement("div");
    headerDiv.className = "flex justify-between items-center mb-1";

    const nameSpan = document.createElement("span");
    nameSpan.className = "font-semibold text-gray-800";
    nameSpan.textContent = reviewerName; // AN TOÀN

    const dateSpan = document.createElement("span");
    dateSpan.className = "text-sm text-gray-500";
    dateSpan.textContent = reviewDate; // AN TOÀN

    const starsDiv = document.createElement("div");
    starsDiv.className = "star-rating mb-2";
    starsDiv.style = "font-size: 1.25rem; color: #f59e0b;";
    starsDiv.innerHTML = starsHtml; // AN TOÀN (vì renderStars do ta kiểm soát)

    const commentP = document.createElement("p");
    commentP.className = "text-gray-700 m-0";
    commentP.textContent = review.comment; // AN TOÀN

    // 3. Gắn các phần tử vào
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(dateSpan);
    reviewDiv.appendChild(headerDiv);
    reviewDiv.appendChild(starsDiv);
    reviewDiv.appendChild(commentP);

    listEl.appendChild(reviewDiv);
  });
} // === CODE MỚI: THAY THẾ HÀM renderReviews ===
// (Đã sửa lỗi XSS)
function renderReviews(reviews) {
  const listEl = document.getElementById("reviews-list");
  listEl.innerHTML = ""; // Xóa nội dung cũ

  reviews.forEach((review) => {
    // 1. Lấy dữ liệu an toàn
    const reviewerName = review.profiles?.full_name || "Người dùng ẩn danh"; // Sửa: Dùng full_name
    const reviewDate = new Date(review.created_at).toLocaleDateString("vi-VN");
    const starsHtml = renderStars(review.rating, "1.25rem"); // Hàm này an toàn

    // 2. Tạo các phần tử
    const reviewDiv = document.createElement("div");
    reviewDiv.className = "border-b pb-4";

    const headerDiv = document.createElement("div");
    headerDiv.className = "flex justify-between items-center mb-1";

    const nameSpan = document.createElement("span");
    nameSpan.className = "font-semibold text-gray-800";
    nameSpan.textContent = reviewerName; // AN TOÀN

    const dateSpan = document.createElement("span");
    dateSpan.className = "text-sm text-gray-500";
    dateSpan.textContent = reviewDate; // AN TOÀN

    const starsDiv = document.createElement("div");
    starsDiv.className = "star-rating mb-2";
    starsDiv.style = "font-size: 1.25rem; color: #f59e0b;";
    starsDiv.innerHTML = starsHtml; // AN TOÀN (vì renderStars do ta kiểm soát)

    const commentP = document.createElement("p");
    commentP.className = "text-gray-700 m-0";
    commentP.textContent = review.comment; // AN TOÀN

    // 3. Gắn các phần tử vào
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(dateSpan);
    reviewDiv.appendChild(headerDiv);
    reviewDiv.appendChild(starsDiv);
    reviewDiv.appendChild(commentP);

    listEl.appendChild(reviewDiv);
  });
}

// Khởi tạo form đánh giá
// [THAY THẾ HÀM NÀY]
async function setupReviewForm(postId) {
  const container = document.getElementById("review-form-container");
  const loginPrompt = document.getElementById("review-login-prompt");
  const reviewForm = document.getElementById("review-form");

  // (SỬA LỖI 4: Lấy session để kiểm tra vai trò)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 1. Kiểm tra đăng nhập
  if (!session) {
    loginPrompt.classList.remove("hidden");
    reviewForm.classList.add("hidden");
    return; // Dừng
  }

  // 2. (SỬA LỖI 4) Kiểm tra vai trò
  const userRole = session.user.user_metadata.role;
  if (userRole === "LESSOR") {
    loginPrompt.innerHTML =
      '<p class="text-gray-600">Chỉ có <span class="font-semibold">Người Thuê</span> mới có thể để lại đánh giá.</p>';
    loginPrompt.classList.remove("hidden");
    reviewForm.classList.add("hidden");
    return; // Dừng
  }

  // 3. Đã đăng nhập VÀ là RENTER -> Hiển thị form
  loginPrompt.classList.add("hidden");
  reviewForm.classList.remove("hidden");

  // 4. Logic chọn sao (Giữ nguyên)
  const stars = document.querySelectorAll("#star-rating-input .star");
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      currentRating = parseInt(star.dataset.value, 10);
      stars.forEach((s) => s.classList.remove("selected"));
      for (let i = 0; i < currentRating; i++) {
        stars[i].classList.add("selected");
      }
    });
  });

  // 5. Logic Gửi form (Giữ nguyên)
  const submitBtn = document.getElementById("review-submit-btn");
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang gửi...";

    const comment = document.getElementById("review-comment").value;

    if (currentRating === 0) {
      alert("Vui lòng chọn số sao đánh giá.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Gửi đánh giá";
      return;
    }

    try {
      await callEdgeFunction("add-review", {
        method: "POST",
        body: {
          post_id: postId,
          rating: currentRating,
          comment: comment,
        },
      });

      alert("Gửi đánh giá thành công!");
      reviewForm.reset();
      currentRating = 0;
      stars.forEach((s) => s.classList.remove("selected"));
      loadReviews(postId);
    } catch (error) {
      console.error("Lỗi khi gửi review:", error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Gửi đánh giá";
    }
  });
}
/**
 * 5. CÁC HÀM TIỆN ÍCH (HELPER FUNCTIONS)
 */

// Hàm tiện ích (Giữ nguyên)
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}

// Hàm render ảnh (Giữ nguyên)
function renderImages(imageUrls, postTitle) {
  const imagesDisplay = document.getElementById("detail-images-display");
  const thumbnailsContainer = document.getElementById("detail-thumbnails");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  if (imageUrls && imageUrls.length > 0) {
    let currentImageIndex = 0;

    function showImage(index) {
      imagesDisplay.innerHTML = `<img src="${imageUrls[index]}" alt="${postTitle}" class="main-image w-full aspect-video object-contain block rounded-lg"/>`;
      document.querySelectorAll(".thumbnail-image").forEach((thumb, i) => {
        thumb.classList.toggle("active", i === index);
      });
      currentImageIndex = index;
    }

    thumbnailsContainer.innerHTML = "";
    imageUrls.forEach((url, index) => {
      const thumb = document.createElement("img");
      thumb.src = url;
      thumb.className =
        "thumbnail-image w-20 h-16 object-cover cursor-pointer mx-1 border-2 border-transparent rounded-md";
      thumb.addEventListener("click", () => showImage(index));
      thumbnailsContainer.appendChild(thumb);
    });

    prevBtn.addEventListener("click", () => {
      let newIndex =
        (currentImageIndex - 1 + imageUrls.length) % imageUrls.length;
      showImage(newIndex);
    });

    nextBtn.addEventListener("click", () => {
      let newIndex = (currentImageIndex + 1) % imageUrls.length;
      showImage(newIndex);
    });

    showImage(0);

    if (imageUrls.length > 1) {
      prevBtn.style.display = "block";
      nextBtn.style.display = "block";
      thumbnailsContainer.style.display = "flex";
    } else {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
      thumbnailsContainer.style.display = "none";
    }
  } else {
    imagesDisplay.innerHTML =
      '<img src="/public/assets/logo2.jpg" alt="Ảnh mặc định" class="main-image w-full aspect-video object-cover block rounded-lg"/>';
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    thumbnailsContainer.style.display = "none";
  }
}

// Hàm render sao (Mới - Ngày 7)
function renderStars(rating, size = "1rem") {
  let starsHtml = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      // Sao đầy
      starsHtml += `<span class="star" style="color: #f59e0b; font-size: ${size};">★</span>`;
    } else {
      // Sao rỗng
      starsHtml += `<span class="star" style="color: #d1d5db; font-size: ${size};">★</span>`;
    }
  }
  return starsHtml;
}
