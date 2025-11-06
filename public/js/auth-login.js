// public/js/auth-signin.js (Phiên bản CẬP NHẬT + DEBUG)

// 1. Lấy form
const signInForm = document.getElementById('form-signin');

// Lấy các input (Đã thêm các trường mới)
const emailInput = document.getElementById('email');
const contactNameInput = document.getElementById('contactName');
const phoneInput = document.getElementById('phone');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');

// 2. Thêm sự kiện 'submit'
signInForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Ngăn form tải lại trang

    // Lấy giá trị từ các trường
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const contactName = contactNameInput.value;
    const phone = phoneInput.value;
    
    // Lấy vai trò (role) được chọn
    const selectedRoleInput = document.querySelector('input[name="role"]:checked');

    // ===========================================
    // BƯỚC VALIDATION MỚI (THEO YÊU CẦU CỦA BẠN)
    // ===========================================

    // --- BƯỚC DEBUG MỚI ---
    // Hãy mở F12 (Console) để xem log này
    console.log("Đang kiểm tra mật khẩu:");
    console.log("Mật khẩu 1 (từ id='password'):", `"${password}"`);
    console.log("Mật khẩu 2 (từ id='confirm-password'):", `"${confirmPassword}"`);
    console.log("Hai mật khẩu có khớp không?", password === confirmPassword);
    // --- KẾT THÚC DEBUG ---

    // 2.1. Kiểm tra mật khẩu có khớp không
    if (password !== confirmPassword) {
        console.error("LỖI: Mật khẩu không khớp! Đã dừng đăng ký."); // Thêm log lỗi
        alert('Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại.');
        return; // Dừng hàm
    }

    // 2.2. Kiểm tra đã chọn vai trò chưa
    if (!selectedRoleInput) {
        console.error("LỖI: Chưa chọn vai trò! Đã dừng đăng ký."); // Thêm log lỗi
        alert('Vui lòng chọn vai trò của bạn (Người cho thuê / Người thuê).');
        return; // Dừng hàm
    }

    const role = selectedRoleInput.value; // Lấy giá trị (LESSOR hoặc RENTER)
    console.log("Validation thành công. Đang tiến hành đăng ký với vai trò:", role);

    // ===========================================

    // 3. Gọi hàm signUp của Supabase (Đã cập nhật options.data)
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                // Đây là dữ liệu Trưởng Nhóm cần cho Trigger
                contactName: contactName,
                phone: phone,
                role: role // Thêm vai trò vào đây
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
        window.location.href = 'login.html';
    }
});