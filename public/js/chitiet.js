/* =======================================
   --- FILE: /public/js/chitiet.js ---
   (PHIÊN BẢN V4 - TÍCH HỢP PUBLIC PROFILE LINK)
   ======================================= */

// --- Biến toàn cục ---
let currentPostId = null;
let currentRating = 0;

/**
 * 1. HÀM CHÍNH: Chạy khi trang tải xong
 */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Trang chi tiết đã tải. Bắt đầu lấy dữ liệu...");

  const postId = Utils.getParam("id");
  currentPostId = postId;

  if (!postId || postId === "undefined") {
    document.getElementById("post-detail-container").innerHTML =
      '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng. Vui lòng quay lại trang danh sách.</h2>';
    return;
  }

  try {
    await Promise.all([
      loadPostDetails(postId),
      loadSavedStatus(postId),
      loadReviews(postId),
      setupReviewForm(postId),
    ]);
    console.log("Tải trang chi tiết hoàn tất.");
  } catch (error) {
    console.error("Lỗi nghiêm trọng khi tải trang chi tiết:", error);
    Utils.setText("detail-page-title", "Lỗi tải trang");
  }
});

/**
 * 2. Tải thông tin chính của bài đăng
 */
async function loadPostDetails(postId) {
  const { data: responseData, error } = await callEdgeFunction("posts-api", {
    params: { id: postId },
    method: "GET",
  });

  if (error) {
    console.error("Lỗi khi tải chi tiết:", error);
    document.getElementById(
      "post-detail-container"
    ).innerHTML = `<h2 class="text-center text-danger">Lỗi: ${error.message}</h2>`;
    return;
  }

  const post = responseData;
  if (!post) return;

  // --- Render dữ liệu ---
  document.title = `${post.title || "Chi tiết"} | Chicky.stu`;

  Utils.setText("detail-title", post.title);
  Utils.setText("detail-page-title", post.motelName);
  Utils.setText(
    "detail-date",
    `Đăng ngày: ${Utils.formatDate(post.created_at)}`
  );
  Utils.setText(
    "detail-price",
    `${Utils.formatCurrencyShort(post.price)}/tháng`
  );
  Utils.setText("detail-area", `${post.area} m²`);
  Utils.setText("detail-rooms", post.rooms || "Không rõ");
  Utils.setText("detail-ward", post.ward);
  Utils.setText("detail-address", post.address_detail);

  const descriptionEl = document.getElementById("detail-description");
  if (descriptionEl)
    descriptionEl.textContent = post.description || "Không có mô tả chi tiết.";

  // --- THÔNG TIN LIÊN HỆ (CÓ LINK PROFILE) ---
  if (post.profiles) {
    // Tạo link đến trang profile
    const profileUrl = `/public/public-profile.html?user_id=${post.user_id}`;

    // Thay thế setText bằng innerHTML để chèn thẻ <a>
    const contactNameEl = document.getElementById("detail-contact-name");
    if (contactNameEl) {
      contactNameEl.innerHTML = `<a href="${profileUrl}" class="text-primary hover:underline font-bold" target="_blank">${
        post.profiles.full_name || "Chưa cập nhật"
      }</a>`;
    }

    Utils.setText(
      "detail-phone",
      post.profiles.phone_number || "Chưa cập nhật"
    );
    Utils.setText("detail-email", post.profiles.email || "Chưa cập nhật");
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
  renderImages(post.image_urls, post.title);
}

/**
 * 3. HÀM XỬ LÝ NÚT "LƯU TIN"
 */
async function loadSavedStatus(postId) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    saveBtn.innerHTML = '<i class="far fa-heart mr-2"></i> Đăng nhập để lưu';
    saveBtn.classList.remove("active");
    saveBtn.onclick = () => (window.location.href = "/public/login.html");
    return;
  }

  const { data: responseData, error } = await callEdgeFunction(
    "get-user-bookmarks",
    { method: "GET" }
  );
  if (error) {
    console.error("Lỗi bookmarks:", error);
    return;
  }

  const bookmarks = responseData.data || responseData || [];
  const isSaved = bookmarks.some(
    (b) => (b.post?.id || b.post?.post_id) === postId
  );

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
  saveBtn.disabled = false;
}

function setupSaveButton(postId, isCurrentlySaved) {
  const saveBtn = document.getElementById("save-post-btn");
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    let isSaved = isCurrentlySaved;
    try {
      if (isSaved) {
        await callEdgeFunction("remove-bookmark", {
          method: "DELETE",
          params: { post_id: postId },
        });
        isSaved = false;
      } else {
        await callEdgeFunction("add-bookmark", {
          method: "POST",
          body: { post_id: postId },
        });
        isSaved = true;
      }
      isCurrentlySaved = isSaved;
      updateSaveButtonUI(isSaved);
    } catch (error) {
      alert(error.message);
    } finally {
      saveBtn.disabled = false;
    }
  };
}

/**
 * 4. HÀM XỬ LÝ ĐÁNH GIÁ
 */
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
    loadingEl.innerHTML = `<p class="text-red-500">Lỗi: ${error.message}</p>`;
    return;
  }

  if (!responseData || responseData.length === 0) {
    loadingEl.innerHTML = "<p>Chưa có đánh giá nào.</p>";
  } else {
    loadingEl.style.display = "none";
  }
  renderReviews(responseData || []);
}

function renderReviews(reviews) {
  const listEl = document.getElementById("reviews-list");
  listEl.innerHTML = "";

  reviews.forEach((review) => {
    const reviewerName = review.profiles?.full_name || "Ẩn danh";
    const reviewDate = Utils.formatDate(review.created_at);
    const starsHtml = Utils.renderStars(review.rating, "1.25rem");

    const reviewDiv = document.createElement("div");
    reviewDiv.className = "border-b pb-4";
    reviewDiv.innerHTML = `
      <div class="flex justify-between items-center mb-1">
        <span class="font-semibold text-gray-800">${reviewerName}</span>
        <span class="text-sm text-gray-500">${reviewDate}</span>
      </div>
      <div class="star-rating mb-2">${starsHtml}</div>
      <p class="text-gray-700 m-0">${review.comment}</p>
    `;
    listEl.appendChild(reviewDiv);
  });
}

async function setupReviewForm(postId) {
  const loginPrompt = document.getElementById("review-login-prompt");
  const reviewForm = document.getElementById("review-form");
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    loginPrompt.classList.remove("hidden");
    reviewForm.classList.add("hidden");
    return;
  }
  const userRole = session.user.user_metadata.role;
  if (userRole === "LESSOR") {
    loginPrompt.innerHTML =
      '<p class="text-gray-600">Chỉ Người Thuê mới được đánh giá.</p>';
    loginPrompt.classList.remove("hidden");
    reviewForm.classList.add("hidden");
    return;
  }

  loginPrompt.classList.add("hidden");
  reviewForm.classList.remove("hidden");

  const stars = document.querySelectorAll("#star-rating-input .star");
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      currentRating = parseInt(star.dataset.value, 10);
      stars.forEach((s) => s.classList.remove("selected"));
      for (let i = 0; i < currentRating; i++)
        stars[i].classList.add("selected");
    });
  });

  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("review-submit-btn");
    btn.disabled = true;
    const comment = document.getElementById("review-comment").value;
    if (currentRating === 0) {
      alert("Vui lòng chọn số sao.");
      btn.disabled = false;
      return;
    }

    try {
      await callEdgeFunction("add-review", {
        method: "POST",
        body: { post_id: postId, rating: currentRating, comment: comment },
      });
      alert("Gửi đánh giá thành công!");
      reviewForm.reset();
      currentRating = 0;
      stars.forEach((s) => s.classList.remove("selected"));
      loadReviews(postId);
    } catch (error) {
      if (error.message && error.message.includes("already reviewed")) {
        alert("Bạn đã đánh giá phòng trọ này rồi!");
      } else {
        alert(`Lỗi: ${error.message}`);
      }
    } finally {
      btn.disabled = false;
    }
  });
}

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

    prevBtn.addEventListener("click", () =>
      showImage((currentImageIndex - 1 + imageUrls.length) % imageUrls.length)
    );
    nextBtn.addEventListener("click", () =>
      showImage((currentImageIndex + 1) % imageUrls.length)
    );

    showImage(0);
    if (imageUrls.length > 1) {
      prevBtn.style.display = "block";
      nextBtn.style.display = "block";
      thumbnailsContainer.style.display = "flex";
    }
  } else {
    imagesDisplay.innerHTML =
      '<img src="/public/assets/logo2.jpg" alt="Mặc định" class="main-image w-full aspect-video object-cover block rounded-lg"/>';
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
    thumbnailsContainer.style.display = "none";
  }
}
