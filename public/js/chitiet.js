// public/js/chitiet.js (FILE MỚI)
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Trang chi tiết đã tải. Đang lấy dữ liệu...');

    // 1. Lấy 'id' của bài đăng từ thanh URL
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id'); // Ví dụ: ?id=abc-123-xyz

    if (!postId) {
        document.getElementById('post-detail-container').innerHTML = 
            '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng.</h2>';
        return;
    }

    // 2. Gọi Supabase để lấy CHI TIẾT 1 bài đăng
    // .eq('id', postId) nghĩa là "WHERE id == postId"
    // .single() để lấy 1 object, thay vì 1 mảng [object]
    const { data: post, error } = await supabase
        .from('posts')
        .select('*') // Lấy tất cả các cột
        .eq('id', postId)
        .single();

    if (error) {
        console.error('Lỗi khi tải chi tiết:', error);
        document.getElementById('post-detail-container').innerHTML = 
            `<h2 class="text-center text-danger">Lỗi: ${error.message}</h2>`;
        return;
    }

    if (post) {
        console.log('Tải chi tiết thành công:', post);

        // 3. Điền dữ liệu vào HTML
        // (Bạn cần đảm bảo các ID này tồn tại trong chitiet.html)
        document.getElementById('detail-title').textContent = post.title;
        document.getElementById('detail-date').textContent = new Date(post.created_at).toLocaleDateString('vi-VN');
        document.getElementById('detail-price').textContent = `${post.price.toLocaleString()} đ/tháng`;
        document.getElementById('detail-area').textContent = `${post.area} m²`;
        document.getElementById('detail-rooms').textContent = post.rooms;
        document.getElementById('detail-ward').textContent = post.ward;
        document.getElementById('detail-address').textContent = post.address;
        document.getElementById('detail-description').textContent = post.description;

        // Điền ảnh
        const imageDisplay = document.getElementById('detail-images-display');
        if (post.image_url) {
            imageDisplay.innerHTML = `<img src="${post.image_url}" alt="${post.title}" class="w-full h-auto rounded-lg shadow-md">`;
        }

        // Điền highlights (dạng mảng)
        const highlightsContainer = document.getElementById('detail-highlights');
        if (post.highlights && post.highlights.length > 0) {
            post.highlights.forEach(item => {
                const div = document.createElement('div');
                div.className = 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm';
                div.textContent = `✓ ${item}`;
                highlightsContainer.appendChild(div);
            });
        } else {
            highlightsContainer.innerHTML = '<p>Không có tiện ích nổi bật.</p>';
        }

        // (Phần thông tin liên hệ sẽ lấy từ bảng 'profiles' ở Ngày 5)
        // Tạm thời ẩn đi hoặc để trống
    }
});

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