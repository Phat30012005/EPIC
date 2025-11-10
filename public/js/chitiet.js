/* =======================================
   --- FILE: /public/js/chitiet.js ---
   (ĐÃ CẬP NHẬT - NGÀY 6 - LOGIC LƯU TIN)
   ======================================= */

// Biến toàn cục (phạm vi module)
let currentPostId = null;
let isCurrentlySaved = false;
let saveButton = null;

/**
 * === HÀM MỚI (NGÀY 6): KIỂM TRA TRẠNG THÁI LƯU ===
 * Tải danh sách bookmark CỦA USER, và kiểm tra xem postId
 * hiện tại có nằm trong đó không.
 */
async function checkSavedStatus(postId) {
  saveButton = document.getElementById("detail-save-btn");
  if (!saveButton) return; // Không tìm thấy nút

  // 1. Kiểm tra đăng nhập
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // Nếu chưa đăng nhập, chỉ cần hiện nút (nhưng không active)
    // Khi click, nó sẽ chuyển hướng
    saveButton.style.display = "inline-block";
    saveButton.addEventListener("click", handleSaveClick);
    return;
  }

  // 2. Nếu đã đăng nhập, tải bookmarks
  const { data, error } = await callEdgeFunction("get-user-bookmarks", {
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải trạng thái lưu:", error);
    // Vẫn hiện nút, cho phép user thử lưu
  } else if (data.data) {
    // 3. Kiểm tra xem tin này (postId) có trong danh sách không
    const isSaved = data.data.some(
      (bookmark) => bookmark.posts && bookmark.posts.id === postId
    );

    if (isSaved) {
      isCurrentlySaved = true;
      saveButton.classList.add("active");
      saveButton.innerHTML = '<i class="fa-solid fa-heart me-2"></i>Đã lưu';
    } else {
      isCurrentlySaved = false;
      saveButton.classList.remove("active");
      saveButton.innerHTML = '<i class="fa-regular fa-heart me-2"></i>Lưu tin';
    }
  }

  // 4. Hiển thị nút và gán sự kiện
  saveButton.style.display = "inline-block";
  saveButton.addEventListener("click", handleSaveClick);
}

/**
 * === HÀM MỚI (NGÀY 6): XỬ LÝ CLICK LƯU/BỎ LƯU ===
 */
async function handleSaveClick() {
  if (!currentPostId || !saveButton) return;

  // 1. Kiểm tra đăng nhập
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    alert("Bạn cần đăng nhập để lưu tin!");
    window.location.href = "/public/login.html";
    return;
  }

  saveButton.disabled = true; // Chống click đúp

  if (isCurrentlySaved) {
    // === TRƯỜNG HỢP 1: ĐÃ LƯU -> BỎ LƯU ===
    const { error } = await callEdgeFunction("remove-bookmark", {
      method: "DELETE",
      params: { post_id: currentPostId },
    });

    if (error) {
      alert("Lỗi bỏ lưu: " + error.message);
    } else {
      // Cập nhật UI
      isCurrentlySaved = false;
      saveButton.classList.remove("active");
      saveButton.innerHTML = '<i class="fa-regular fa-heart me-2"></i>Lưu tin';
    }
  } else {
    // === TRƯỜNG HỢP 2: CHƯA LƯU -> LƯU ===
    const { error } = await callEdgeFunction("add-bookmark", {
      method: "POST",
      body: { post_id: currentPostId },
    });

    if (error) {
      alert("Lỗi khi lưu: " + error.message);
    } else {
      // Cập nhật UI
      isCurrentlySaved = true;
      saveButton.classList.add("active");
      saveButton.innerHTML = '<i class="fa-solid fa-heart me-2"></i>Đã lưu';
    }
  }

  saveButton.disabled = false; // Mở lại nút
}

// ===========================================
// HÀM CHẠY CHÍNH (ĐÃ CẬP NHẬT)
// ===========================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Trang chi tiết đã tải. Đang lấy dữ liệu...");

  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");
  currentPostId = postId; // Lưu ID vào biến toàn cục

  if (!postId || postId === "undefined") {
    document.getElementById("post-detail-container").innerHTML =
      '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng. Vui lòng quay lại trang danh sách.</h2>';
    return;
  }

  // === PHẦN 1: TẢI CHI TIẾT TIN (Giữ nguyên) ===
  let post;
  try {
    const functionUrl =
      supabase.functions.url + "/get-post-detail?id=" + postId;
    const response = await fetch(functionUrl, {
      method: "GET",
    });
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.error || "Lỗi máy chủ khi tải dữ liệu");
    }
    post = responseData.data;
    if (!post) {
      throw new Error("Không tìm thấy bài đăng.");
    }
  } catch (error) {
    console.error("Lỗi khi tải chi tiết (qua Edge Function):", error);
    document.getElementById(
      "post-detail-container"
    ).innerHTML = `<h2 class="text-center text-danger">Lỗi: ${error.message}</h2>`;
    return;
  }

  // === PHẦN 2: RENDER DỮ LIỆU (Giữ nguyên) ===
  if (post) {
    console.log("Tải chi tiết thành công (đã JOIN):", post);
    document.title = `${post.title || "Chi tiết"} | Chicky.stu`;
    setTextContent("detail-title", post.title);
    setTextContent("detail-page-title", post.title);
    const date = new Date(post.created_at);
    if (!isNaN(date.getTime())) {
      setTextContent(
        "detail-date",
        `Đăng ngày: ${date.toLocaleString("vi-VN")}`
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
    setTextContent("detail-address", post.address);
    const descriptionEl = document.getElementById("detail-description");
    if (descriptionEl) {
      descriptionEl.textContent =
        post.description || "Không có mô tả chi tiết.";
    }

    if (post.profiles) {
      setTextContent(
        "detail-contact-name",
        post.profiles.contactName || "Chưa cập nhật"
      );
      setTextContent("detail-phone", post.profiles.phone || "Chưa cập nhật");
      setTextContent("detail-email", post.profiles.email || "Chưa cập nhật");
    } else {
      console.warn("Không tìm thấy thông tin profile của user.");
      setTextContent("detail-contact-name", "Không rõ");
      setTextContent("detail-phone", "Không rõ");
      setTextContent("detail-email", "Không rõ");
    }

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

    const imagesDisplay = document.getElementById("detail-images-display");
    const thumbnailsContainer = document.getElementById("detail-thumbnails");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const imageUrls = post.image_url;

    if (imageUrls && imageUrls.length > 0) {
      let currentImageIndex = 0;
      function showImage(index) {
        imagesDisplay.innerHTML = `<img src="${imageUrls[index]}" alt="${post.title}" class="main-image w-full aspect-video object-contain block rounded-lg"/>`;
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

  // === PHẦN 3 (MỚI - NGÀY 6): KIỂM TRA TRẠNG THÁI LƯU ===
  // Chạy sau khi mọi thứ đã render
  await checkSavedStatus(postId);
});

/**
 * Hàm tiện ích (Giữ nguyên)
 */
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}
