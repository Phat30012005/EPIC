// public/js/chitiet.js
// CHỈ GIỮ LẠI CODE SUPABASE

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
    // .single() để lấy 1 object
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

        // 3. Điền dữ liệu vào HTML (Sử dụng tên cột CSDL)
        document.title = `${post.title || "Chi tiết"} | Chicky.stu`;
        setTextContent('detail-title', post.title);
        setTextContent('detail-page-title', post.title);
        setTextContent('detail-date', new Date(post.created_at).toLocaleDateString('vi-VN'));
        setTextContent('detail-price', `${post.price.toLocaleString()} đ/tháng`);
        setTextContent('detail-area', `${post.area} m²`);
        setTextContent('detail-rooms', post.rooms || 'Không rõ');
        setTextContent('detail-ward', post.ward);
        setTextContent('detail-address', post.address);
        
        // Dùng innerText để giữ định dạng cho mô tả
        const descriptionEl = document.getElementById("detail-description");
        if (descriptionEl) {
            descriptionEl.innerText = post.description || "Không có mô tả chi tiết.";
        }

        // Điền ảnh (từ image_url)
        const imageDisplay = document.getElementById('detail-images-display');
        if (post.image_url) {
            imageDisplay.innerHTML = `<img src="${post.image_url}" alt="${post.title}" class="main-image" style="display: block;"/>`;
        } else {
             imageDisplay.innerHTML = '<img src="/public/assets/logo2.jpg" alt="Ảnh mặc định" class="main-image"/>';
        }
        // Ẩn các nút gallery nếu chỉ có 1 ảnh
        document.getElementById("prev-btn").style.display = 'none';
        document.getElementById("next-btn").style.display = 'none';
        document.getElementById("detail-thumbnails").style.display = 'none';


        // Điền highlights (dạng mảng)
        const highlightsContainer = document.getElementById('detail-highlights');
        if (post.highlights && post.highlights.length > 0) {
            highlightsContainer.innerHTML = ''; // Xóa placeholder
            post.highlights.forEach(item => {
                const div = document.createElement('div');
                div.className = 'highlight-item p-2 bg-light border rounded';
                div.innerHTML = `✓ ${item}`;
                highlightsContainer.appendChild(div);
            });
        } else {
            highlightsContainer.innerHTML = '<p>Không có tiện ích nổi bật.</p>';
        }

        // Điền thông tin liên hệ (Lấy từ CSDL 'posts')
        setTextContent("detail-contact-name", post.contactName || "Đang cập nhật");
        setTextContent("detail-phone", post.phone || "Đang cập nhật");
        setTextContent("detail-email", post.email || "Đang cập nhật");
    }
});

/**
 * Hàm tiện ích
 */
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  } else {
    console.warn(`Không tìm thấy element với ID: ${id}`);
  }
}