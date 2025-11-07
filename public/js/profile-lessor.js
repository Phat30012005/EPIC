// public/js/profile-lessor.js
// Logic cho trang Hồ sơ Chủ trọ

// === PHẦN DÀNH RIÊNG CHO CHỦ TRỌ ===
// Hàm render các tin đăng
function renderMyPosts(posts) {
    const postsList = document.getElementById('my-posts-list');
    const loadingDiv = document.getElementById('my-posts-loading');
    
    postsList.innerHTML = ''; // Xóa
    
    if (!posts || posts.length === 0) {
        loadingDiv.textContent = 'Bạn chưa đăng tin nào.';
        return;
    }
    
    loadingDiv.style.display = 'none'; // Ẩn loading
    
    posts.forEach(post => {
        const postDiv = document.createElement('div');
        postDiv.className = 'd-flex justify-content-between align-items-center p-3 border rounded';
        postDiv.innerHTML = `
            <div>
                <a href="/public/chitiet.html?id=${post.id}" class="fw-bold text-primary" target="_blank">${post.title}</a>
                <p class="mb-0 text-muted">${post.price.toLocaleString()} đ/tháng - ${post.ward}</p>
            </div>
            <div>
                <button class="btn btn-sm btn-danger delete-post-btn" data-id="${post.id}">Xóa</button>
            </div>
        `;
        postsList.appendChild(postDiv);
    });
    
    // Thêm sự kiện cho tất cả các nút xóa
    postsList.querySelectorAll('.delete-post-btn').forEach(button => {
         button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Bạn có chắc muốn xóa tin này?')) {
                // Gọi Supabase để xóa
                const { error } = await supabase.from('posts').delete().eq('id', id);
                if (error) {
                    alert('Lỗi khi xóa: ' + error.message);
                } else {
                    alert('Xóa thành công!');
                    location.reload(); // Tải lại trang để cập nhật danh sách
                }
            }
         });
    });
}

// Hàm tải tin đăng của người dùng
async function loadMyPosts(userId) {
    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId) // Chỉ lấy tin của user này
        .order('created_at', { ascending: false });
        
    if (error) {
        console.error('Lỗi tải tin đăng:', error);
        document.getElementById('my-posts-loading').textContent = 'Lỗi khi tải tin đăng.';
    } else {
        renderMyPosts(posts);
    }
}
// === KẾT THÚC PHẦN DÀNH RIÊNG ===


// === PHẦN CHUNG (Giống profile-renter.js) ===
document.addEventListener('DOMContentLoaded', async () => {
    const profileForm = document.getElementById('profile-form');
    const loadingDiv = document.getElementById('profile-loading');
    
    // 1. Lấy thông tin user
    const { data: { user } } = await supabase.auth.getUser();
    
    // (Không cần kiểm tra authError vì auth-guard.js đã làm)

    // 2. Lấy các trường input
    const emailInput = document.getElementById('profile-email');
    const nameInput = document.getElementById('profile-name');
    const phoneInput = document.getElementById('profile-phone');
    const roleInput = document.getElementById('profile-role');
    const updateButton = document.getElementById('update-profile-btn');

    // 3. Điền thông tin vào form
    emailInput.value = user.email;
    nameInput.value = user.user_metadata.contactName || '';
    phoneInput.value = user.user_metadata.phone || '';
    
    if (user.user_metadata.role === 'LESSOR') {
        roleInput.value = 'Người cho thuê';
    } else {
        roleInput.value = 'Chưa xác định';
    }

    // 4. Hiển thị form
    loadingDiv.style.display = 'none';
    profileForm.style.display = 'block';

    // 5. Xử lý sự kiện Cập nhật hồ sơ
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        updateButton.disabled = true;
        updateButton.textContent = 'Đang lưu...';

        const newName = nameInput.value;
        const newPhone = phoneInput.value;

        const { data, error } = await supabase.auth.updateUser({
            data: { 
                contactName: newName, 
                phone: newPhone 
            }
        });

        if (error) {
            alert('Cập nhật thất bại: ' + error.message);
        } else {
            alert('Cập nhật hồ sơ thành công!');
        }
        
        updateButton.disabled = false;
        updateButton.textContent = 'Lưu thay đổi';
    });
    
    // 6. === PHẦN MỚI: Tải tin đăng của chủ trọ ===
    await loadMyPosts(user.id);
});