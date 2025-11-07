/* =======================================
   --- FILE: /public/js/chitiet.js ---
   (ĐÃ NÂNG CẤP THEO KẾ HOẠCH NGÀY 5 - JOIN 2 BẢNG)
   ======================================= */

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Trang chi tiết đã tải. Đang lấy dữ liệu...');

    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');

    if (!postId || postId === "undefined") {
        document.getElementById('post-detail-container').innerHTML = 
            '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng. Vui lòng quay lại trang danh sách.</h2>';
        return;
    }

    // ===========================================
    // === THAY ĐỔI SỐ 1 (THEO KẾ HOẠCH NGÀY 5) ===
    // .select('*') được đổi thành .select('*, profiles(*)')
    // profiles(*) sẽ tự động JOIN bảng 'profiles'
    // nơi mà 'profiles.id' khớp với 'posts.user_id'
    // ===========================================
    const { data: post, error } = await supabase
        .from('posts')
        .select('*, profiles(*)') // <--- ĐÃ SỬA
        .eq('id', postId)
        .single();

    if (error) {
        console.error('Lỗi khi tải chi tiết:', error);
        document.getElementById('post-detail-container').innerHTML = 
            `<h2 class="text-center text-danger">Lỗi: ${error.message}</h2>`;
        return;
    }

    if (post) {
        console.log('Tải chi tiết thành công (đã JOIN):', post);

        // Điền dữ liệu TEXT (như cũ)
        document.title = `${post.title || "Chi tiết"} | Chicky.stu`;
        setTextContent('detail-title', post.title);
        setTextContent('detail-page-title', post.title);
        
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

        // ===========================================
        // === THAY ĐỔI SỐ 2 (THEO KẾ HOẠCH NGÀY 5) ===
        // Lấy thông tin từ 'post.profiles' thay vì 'post'
        // (Yêu cầu Trưởng nhóm đã sửa Trigger)
        // ===========================================
        if (post.profiles) {
            setTextContent("detail-contact-name", post.profiles.contactName || "Chưa cập nhật");
            setTextContent("detail-phone", post.profiles.phone || "Chưa cập nhật");
            setTextContent("detail-email", post.profiles.email || "Chưa cập nhật");
        } else {
            console.warn("Không tìm thấy thông tin profile của user. Trưởng nhóm đã sửa Trigger chưa?");
            setTextContent("detail-contact-name", "Không rõ");
            setTextContent("detail-phone", "Không rõ");
            setTextContent("detail-email", "Không rõ");
        }
        
        // Điền highlights (như cũ)
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

        // Điền ảnh (như cũ)
        const imagesDisplay = document.getElementById('detail-images-display');
        const thumbnailsContainer = document.getElementById('detail-thumbnails');
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

            thumbnailsContainer.innerHTML = '';
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
            imagesDisplay.innerHTML = '<img src="/public/assets/logo2.jpg" alt="Ảnh mặc định" class="main-image w-full aspect-video object-cover block rounded-lg"/>';
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            thumbnailsContainer.style.display = 'none';
        }
    }
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