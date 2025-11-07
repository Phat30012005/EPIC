// public/js/profile.js
// Logic cho trang Hồ sơ cá nhân

document.addEventListener('DOMContentLoaded', async () => {
    const profileForm = document.getElementById('profile-form');
    const loadingDiv = document.getElementById('profile-loading');
    
    // 1. Lấy thông tin user đang đăng nhập
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        // Nếu chưa đăng nhập, đá về trang login
        console.error('Chưa đăng nhập, đang chuyển hướng...');
        alert('Vui lòng đăng nhập để xem hồ sơ.');
        window.location.href = '/public/login.html';
        return;
    }

    // 2. Lấy các trường input
    const emailInput = document.getElementById('profile-email');
    const nameInput = document.getElementById('profile-name');
    const phoneInput = document.getElementById('profile-phone');
    const roleInput = document.getElementById('profile-role');
    const updateButton = document.getElementById('update-profile-btn');

    // 3. Điền thông tin vào form
    // Thông tin này được lấy từ lúc đăng ký (lưu trong user_metadata)
    emailInput.value = user.email;
    nameInput.value = user.user_metadata.contactName || '';
    phoneInput.value = user.user_metadata.phone || '';
    
    // Hiển thị vai trò (Role)
    if (user.user_metadata.role === 'LESSOR') {
        roleInput.value = 'Người cho thuê';
    } else if (user.user_metadata.role === 'RENTER') {
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
            console.log('Cập nhật thành công:', data.user);
        }
        
        updateButton.disabled = false;
        updateButton.textContent = 'Lưu thay đổi';
    });
});