// public/js/auth-signup.js
// NỘI DUNG ĐÚNG CHO TRANG ĐĂNG KÝ

document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.getElementById('form-signin');

    if (signInForm) {
        signInForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Ngăn form tải lại trang

            // Lấy giá trị từ các trường
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const contactName = document.getElementById('contactName').value;
            const phone = document.getElementById('phone').value;
            const selectedRoleInput = document.querySelector('input[name="role"]:checked');

            // 1. Kiểm tra mật khẩu có khớp không
            if (password !== confirmPassword) {
                alert('Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại.');
                return; // Dừng hàm
            }

            // 2. Kiểm tra đã chọn vai trò chưa
            if (!selectedRoleInput) {
                alert('Vui lòng chọn vai trò của bạn (Người cho thuê / Người thuê).');
                return; // Dừng hàm
            }

            const role = selectedRoleInput.value; // Lấy giá trị (LESSOR hoặc RENTER)

            // 3. Gọi hàm signUp của Supabase
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        // Đây là dữ liệu Trưởng Nhóm cần cho Trigger
                        contactName: contactName,
                        phone: phone,
                        role: role
                    }
                }
            });

            if (error) {
                console.error('Lỗi khi đăng ký từ Supabase:', error.message);
                alert('Đăng ký thất bại: ' + error.message);
            } else {
                console.log('Đăng ký thành công:', data);
                alert('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');
                // Tự động chuyển về trang đăng nhập
                window.location.href = '/public/login.html';
            }
        });
    } else {
        console.error('Không tìm thấy #form-signin');
    }
});