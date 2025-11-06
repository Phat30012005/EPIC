// public/js/chitiet.js (FILE MỚI)

document.addEventListener("DOMContentLoaded", () => {
  // Lấy ID bài đăng từ URL (ví dụ: ?id=123456)
  const urlParams = new URLSearchParams(window.location.search);
  const postId = Number(urlParams.get("id"));

  if (!postId) {
    document.getElementById("post-detail-container").innerHTML =
      '<h2 class="text-center text-danger">Không tìm thấy ID bài đăng.</h2>';
    return;
  }

  // Lấy tất cả bài đăng từ storage
  const allPosts = window.getRooms();
  
  // Tìm bài đăng khớp với ID
  const post = allPosts.find((p) => Number(p.id) === postId);

  if (!post) {
    document.getElementById("post-detail-container").innerHTML =
      `<h2 class="text-center text-danger">Không tìm thấy bài đăng với ID: ${postId}</h2>`;
    return;
  }

  // --- 1. Cập nhật Tiêu đề trang và Tiêu đề chính ---
  document.title = `${post.title} | Chicky.stu`;
  setTextContent("detail-page-title", post.title);
  setTextContent("detail-title", post.title);

  // --- 2. Cập nhật thông tin cơ bản ---
  setTextContent("detail-date", `Ngày đăng: ${post.date || "Không rõ"}`);
  setTextContent(
    "detail-price",
    `${Number(post.price).toLocaleString()} vnđ/tháng`
  );
  setTextContent("detail-area", `${post.area} m²`);
  setTextContent("detail-rooms", post.rooms);
  setTextContent("detail-ward", post.ward);
  setTextContent("detail-address", post.address);

  // --- 3. Cập nhật Mô tả ---
  const descriptionEl = document.getElementById("detail-description");
  if (descriptionEl) {
    // Sử dụng innerText để giữ nguyên các khoảng trắng và xuống dòng (từ textarea)
    descriptionEl.innerText = post.description || "Không có mô tả chi tiết.";
  }

  // --- 4. Cập nhật Đặc điểm nổi bật ---
  const highlightsContainer = document.getElementById("detail-highlights");
  if (post.highlights && post.highlights.length > 0) {
    post.highlights.forEach((item) => {
      const div = document.createElement("div");
      div.className = "highlight-item p-2 bg-light border rounded"; // Tùy chỉnh class
      div.innerHTML = `✓ ${item}`;
      highlightsContainer.appendChild(div);
    });
  } else {
    highlightsContainer.innerHTML = "<p>Không có đặc điểm nổi bật nào.</p>";
  }

  // --- 5. Cập nhật Thông tin liên hệ ---
  setTextContent("detail-contact-name", post.contactName);
  setTextContent("detail-phone", post.phone);
  setTextContent("detail-email", post.email);

  // --- 6. Xử lý Image Gallery ---
  const displayArea = document.getElementById("detail-images-display");
  const thumbnailsArea = document.getElementById("detail-thumbnails");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  let currentImageIndex = 0;
  const images = post.images && post.images.length > 0 ? post.images : [];

  if (images.length === 0) {
    displayArea.innerHTML = '<img src="/public/assets/logo2.jpg" alt="Ảnh mặc định" class="main-image"/>';
    thumbnailsArea.style.display = "none";
    prevBtn.style.display = "none";
    nextBtn.style.display = "none";
  } else {
    // Tạo ảnh và thumbnails
    images.forEach((imgSrc, index) => {
      // Thêm ảnh chính (ảnh đầu tiên hiển thị, các ảnh khác ẩn)
      const img = document.createElement("img");
      img.src = imgSrc;
      img.alt = `Ảnh ${index + 1}`;
      img.className = "main-image";
      if (index !== 0) img.style.display = "none";
      displayArea.appendChild(img);

      // Thêm thumbnail
      const thumb = document.createElement("img");
      thumb.src = imgSrc;
      thumb.alt = `Thumbnail ${index + 1}`;
      thumb.className = "thumbnail-image";
      if (index === 0) thumb.classList.add("active");
      thumb.dataset.index = index;
      thumbnailsArea.appendChild(thumb);
    });

    const allMainImages = displayArea.querySelectorAll(".main-image");
    const allThumbnails = thumbnailsArea.querySelectorAll(".thumbnail-image");

    // Hàm để hiển thị ảnh
    function showImage(index) {
      // Ẩn ảnh hiện tại
      allMainImages[currentImageIndex].style.display = "none";
      allThumbnails[currentImageIndex].classList.remove("active");

      // Cập nhật index mới
      currentImageIndex = index;

      // Hiển thị ảnh mới
      allMainImages[currentImageIndex].style.display = "block";
      allThumbnails[currentImageIndex].classList.add("active");
    }

    // Sự kiện cho nút
    prevBtn.addEventListener("click", () => {
      let newIndex = (currentImageIndex - 1 + images.length) % images.length;
      showImage(newIndex);
    });

    nextBtn.addEventListener("click", () => {
      let newIndex = (currentImageIndex + 1) % images.length;
      showImage(newIndex);
    });

    // Sự kiện cho thumbnails
    allThumbnails.forEach((thumb) => {
      thumb.addEventListener("click", () => {
        showImage(Number(thumb.dataset.index));
      });
    });
  }
});

/**
 * Hàm tiện ích giúp gán text vào một element bằng ID
 * @param {string} id ID của element
 * @param {string} text Nội dung cần gán
 */
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}