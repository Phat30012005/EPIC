// public/js/chitiet.js
// ĐÃ NÂNG CẤP ĐỂ JOIN BẢNG PROFILES VÀ HIỂN THỊ GALLERY

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Trang chi tiết đã tải. Đang lấy dữ liệu...');

    // 1. Lấy 'id' của bài đăng (Giữ nguyên)
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');

    if (!postId || postId === "undefined") {
        document.getElementById('post-detail-container').innerHTML = 
            '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng.</h2>';
        return;
    }

    // 2. === SỬA: Gọi Supabase để JOIN 2 bảng ===
    // "*, profiles(*)" nghĩa là: Lấy tất cả cột từ 'posts' VÀ
    // lấy tất cả cột từ 'profiles' nơi 'profiles.id' == 'posts.user_id'
    const { data: post, error } = await supabase
        .from('posts')
        .select('*, profiles(*)') 
        .eq('id', postId)
        .single();

    if (error) {
        console.error('Lỗi khi tải chi tiết:', error);
        document.getElementById('post-detail-container').innerHTML = 
            `<h2 class="text-center text-danger">Lỗi: ${error.message}</h2>`;
        return;
    }

    if (post) {
        console.log('Tải chi tiết (đã JOIN) thành công:', post);

        // 3. Điền dữ liệu TEXT (Giữ nguyên)
        document.title = `${post.title || "Chi tiết"} | Chicky.stu`;
        setTextContent('detail-title', post.title);
        setTextContent('detail-page-title', post.title);
        const date = new Date(post.created_at);
        if (!isNaN(date.getTime())) {
            setTextContent('detail-date', `Đăng ngày: ${date.toLocaleDateString('vi-VN')}`);
        } else {
            setTextContent('detail-date', 'Đăng ngày: Không rõ');
        }
        setTextContent('detail-price', `${(post.price).toLocaleString()} đ/tháng`); // Sửa lại định dạng giá
        setTextContent('detail-area', `${post.area} m²`);
        setTextContent('detail-rooms', post.rooms || 'Không rõ');
        setTextContent('detail-ward', post.ward);
        setTextContent('detail-address', post.address);
        
        const descriptionEl = document.getElementById("detail-description");
        if (descriptionEl) {
            descriptionEl.innerText = post.description || "Không có mô tả chi tiết."; // Dùng innerText để giữ xuống dòng
        }

        // 4. === SỬA: Điền thông tin liên hệ từ 'profiles' ===
        if (post.profiles) {
            setTextContent("detail-contact-name", post.profiles.contactName || "Chưa cập nhật");
            setTextContent("detail-phone", post.profiles.phone || "Chưa cập nhật");
            setTextContent("detail-email", post.profiles.email || "Chưa cập nhật");
        } else {
            console.warn('Không tìm thấy thông tin profile của user');
            setTextContent("detail-contact-name", "Không rõ");
            setTextContent("detail-phone", "Không rõ");
            setTextContent("detail-email", "Không rõ");
        }
        
        // 5. Điền highlights (Giữ nguyên)
        const highlightsContainer = document.getElementById('detail-highlights');
        if (post.highlights && post.highlights.length > 0) {
            highlightsContainer.innerHTML = '';
            post.highlights.forEach(item => {
                const div = document.createElement('div');
                div.className = 'highlight-item p-2 bg-light border rounded'; 
                div.innerHTML = `✓ ${item}`;
                highlightsContainer.appendChild(div);
            });
        } else {
            highlightsContainer.innerHTML = '<p>Không có tiện ích nổi bật.</p>';
        }

        // 6. === SỬA: Điền GALLERY ảnh (từ cột image_urls) ===
        const imagesDisplay = document.getElementById('detail-images-display');
        const thumbnailsContainer = document.getElementById('detail-thumbnails');
        const prevBtn = document.getElementById("prev-btn");
        const nextBtn = document.getElementById("next-btn");

        // Lấy mảng ảnh (từ cột image_urls mới)
        const imageUrls = post.image_urls || []; 

        if (imageUrls && imageUrls.length > 0) {
            let currentImageIndex = 0;

            function showImage(index) {
                // Hiển thị ảnh chính
                imagesDisplay.innerHTML = `<img src="${imageUrls[index]}" alt="${post.title}" class="main-image w-full aspect-video object-contain block rounded-lg"/>`;
                
                // Cập nhật active cho thumbnail
                document.querySelectorAll(".thumbnail-image").forEach((thumb, i) => {
                    thumb.classList.toggle("active", i === index); 
                });
                currentImageIndex = index;
            }

            thumbnailsContainer.innerHTML = ''; // Xóa thumbnail cũ
            imageUrls.forEach((url, index) => {
                const thumb = document.createElement('img');
                thumb.src = url;
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

            showImage(0); // Hiển thị ảnh đầu tiên

            // Ẩn nút/thumbnail nếu chỉ có 1 ảnh
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
            // Ảnh mặc định
            imagesDisplay.innerHTML = '<img src="/public/assets/logo2.jpg" alt="Ảnh mặc định" class="main-image w-full aspect-video object-cover block rounded-lg"/>';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            thumbnailsContainer.style.display = 'none';
        }
    }
});

// Hàm tiện ích (Giữ nguyên)
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}