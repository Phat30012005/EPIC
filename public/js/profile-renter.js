// public/js/profile-renter.js
// Logic cho trang Hồ sơ Người thuê

document.addEventListener('DOMContentLoaded', async () => {
    const profileForm = document.getElementById('profile-form');
    const loadingDiv = document.getElementById('profile-loading');
    
    // 1. Lấy thông tin user (đã được auth-guard.js kiểm tra)
    const { data: { user } } = await supabase.auth.getUser();

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
    
    if (user.user_metadata.role === 'RENTER') {
        roleInput.value = 'Người thuê';
    } else {
        roleInput.value = 'Chưa xác định';
    }

    // 4. Hiển thị form và ẩn loading
    loadingDiv.style.display = 'none';
    profileForm.style.display = 'block';

    // 5. Xử lý sự kiện Cập nhật hồ sơ
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        updateButton.disabled = true;
        updateButton.textContent = 'Đang lưu...';

        const newName = nameInput.value;
        const newPhone = phoneInput.value;

        // Gọi Supabase để cập nhật user_metadata
        const { data, error } = await supabase.auth.updateUser({
            data: { 
                contactName: newName, 
                phone: newPhone 
            }
        });

        if (error) {
            alert('Cập nhật thất bại: ' + error.message);
            console.error('Lỗi cập nhật:', error);
        } else {
            alert('Cập nhật hồ sơ thành công!');
        }
        
        updateButton.disabled = false;
        updateButton.textContent = 'Lưu thay đổi';
    });
});