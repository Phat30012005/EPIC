// public/js/auth-login.js
// NỘI DUNG ĐÚNG CHO TRANG ĐĂNG NHẬP (ĐÃ SỬA LỖI CÚ PHÁP)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('form-login');
    
    if (!loginForm) {
        console.error('Lỗi: Không tìm thấy #form-login trong login.html');
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Lấy nút submit và input
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        // Lấy giá trị
        const email = emailInput.value;
        const password = passwordInput.value;

        // Vô hiệu hóa nút để tránh click đúp
        submitButton.disabled = true;
        submitButton.textContent = 'ĐANG TẢI...';

        try {
            // Dùng hàm signInWithPassword của Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                // Sửa lỗi cú pháp: dùng error.message để báo lỗi
                alert('Đăng nhập thất bại: ' + error.message);
                console.error('Lỗi đăng nhập:', error);
            } else {
                console.log('Đăng nhập thành công:', data.user.email);
                alert('Đăng nhập thành công! Đang chuyển về trang chủ...');
                // Chuyển hướng về trang chủ
                window.location.href = '/public/index.html';
            }
        } catch (exception) {
            // Bắt các lỗi khác (vd: mạng)
            console.error('Lỗi hệ thống khi đăng nhập:', exception);
            alert('Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            // Kích hoạt lại nút dù thành công hay thất bại
            submitButton.disabled = false;
            submitButton.textContent = 'Đăng nhập';
        }
    });
});