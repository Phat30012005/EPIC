/* =======================================
   --- FILE: /public/js/chitiet.js ---
   (Đã SỬA THEO GIẢI PHÁP 1: DÙNG OBJECT-CONTAIN)
   ======================================= */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Trang chi tiết đã tải. Đang lấy dữ liệu...');

    // 1. Lấy 'id' của bài đăng từ thanh URL
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');

    // 2. Kiểm tra ID
    if (!postId || postId === "undefined") {
        document.getElementById('post-detail-container').innerHTML = 
            '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng. Vui lòng quay lại trang danh sách.</h2>';
        return;
    }

    // 3. Gọi Supabase để lấy CHI TIẾT 1 bài đăng
    const { data: post, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

    // 4. Xử lý lỗi
    if (error) {
        console.error('Lỗi khi tải chi tiết:', error);
        document.getElementById('post-detail-container').innerHTML = 
            `<h2 class="text-center text-danger">Lỗi: ${error.message}</h2><p>Gợi ý: Có thể bạn chưa bật RLS Policy cho 'SELECT'.</p>`;
        return;
    }

    // 5. Nếu Tải thành công (post có dữ liệu)
    if (post) {
        console.log('Tải chi tiết thành công:', post);

        // 6. Điền dữ liệu TEXT vào HTML
        document.title = `${post.title || "Chi tiết"} | Chicky.stu`;
        setTextContent('detail-title', post.title);
        setTextContent('detail-page-title', post.title);
        
        // SỬA LỖI "INVALID DATE"
        const date = new Date(post.created_at);
        if (!isNaN(date.getTime())) {
            setTextContent('detail-date', `Đăng ngày: ${date.toLocaleDateString('vi-VN')}`);
        } else {
            setTextContent('detail-date', 'Đăng ngày: Không rõ');
        }

        setTextContent('detail-price', `${(post.price / 1000000).toFixed(1)} triệu/tháng`);
        setTextContent('detail-area', `${post.area} m²`);
        setTextContent('detail-rooms', post.rooms || 'Không rõ');
        setTextContent('detail-ward', post.ward);
        setTextContent('detail-address', post.address);
        
        const descriptionEl = document.getElementById("detail-description");
        if (descriptionEl) {
            descriptionEl.textContent = post.description || "Không có mô tả chi tiết.";
        }

        // 7. Điền thông tin liên hệ
        setTextContent("detail-contact-name", post.contactName || "Đang cập nhật");
        setTextContent("detail-phone", post.phone || "Đang cập nhật");
        setTextContent("detail-email", post.email || "Đang cập nhật");
        
        // 8. Điền highlights (Mảng)
        const highlightsContainer = document.getElementById('detail-highlights');
        if (post.highlights && post.highlights.length > 0) {
            highlightsContainer.innerHTML = '';
            post.highlights.forEach(item => {
                const div = document.createElement('div');
                div.className = 'highlight-item'; 
                div.innerHTML = `<i class="fa-solid fa-check-circle mr-2 text-green-500"></i> ${item}`;
                highlightsContainer.appendChild(div);
            });
        } else {
            highlightsContainer.innerHTML = '<p>Không có tiện ích nổi bật.</p>';
        }

        // ===================================================
        // 9. ĐIỀN ẢNH
        // ===================================================
        const imagesDisplay = document.getElementById('detail-images-display');
        const thumbnailsContainer = document.getElementById('detail-thumbnails');
        const prevBtn = document.getElementById("prev-btn");
        const nextBtn = document.getElementById("next-btn");

        const imageUrls = post.image_url; 

        if (imageUrls && imageUrls.length > 0) {
            let currentImageIndex = 0;

            function showImage(index) {
                // ==========================================
                // SỬA THEO GIẢI PHÁP 1 (THEO YÊU CẦU CỦA BẠN)
                // Đổi "object-cover" (cắt xén) thành "object-contain" (hiển thị toàn bộ)
                imagesDisplay.innerHTML = `<img src="${imageUrls[index]}" alt="${post.title}" class="main-image w-full aspect-video object-contain block rounded-lg"/>`;
                // ==========================================

                document.querySelectorAll(".thumbnail-image").forEach((thumb, i) => {
                    thumb.classList.toggle("active", i === index); 
                });
                currentImageIndex = index;
            }

            thumbnailsContainer.innerHTML = '';
            imageUrls.forEach((url, index) => {
                const thumb = document.createElement('img');
                thumb.src = url;
                // (Bonus) Sửa lại ảnh thumbnail thành 'cover' cho đẹp hơn
                thumb.className = 'thumbnail-image w-20 h-16 object-cover cursor-pointer mx-1 border-2 border-transparent rounded-md';
                thumb.addEventListener('click', () => showImage(index));
                thumbnailsContainer.appendChild(thumb);
            });

            prevBtn.addEventListener("click", () => {
                let newIndex = (currentImageIndex - 1 + imageUrls.length) % imageUrls.length;
                showImage(newIndex);
            });

            nextBtn.addEventListener("click", () => {
                let newIndex = (currentImageIndex + 1) % imageUrls.length;
                showImage(newIndex);
            });

            showImage(0);

            if (imageUrls.length > 1) {
                prevBtn.style.display = 'block';
                nextBtn.style.display = 'block';
                thumbnailsContainer.style.display = 'flex';
            } else {
                prevBtn.style.display = 'none';
                nextBtn.style.display = 'none';
                thumbnailsContainer.style.display = 'none';
            }

        } else {
            // Trường hợp không có ảnh nào
            imagesDisplay.innerHTML = '<img src="/public/assets/logo2.jpg" alt="Ảnh mặc định" class="main-image w-full aspect-video object-cover block rounded-lg"/>';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            thumbnailsContainer.style.display = 'none';
        }
  s }
});

/**
 * Hàm tiện ích (Hàm này của bạn đã đúng, giữ nguyên)
 */
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}