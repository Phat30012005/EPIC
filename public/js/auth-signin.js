// public/js/auth-signin.js

// 1. Lấy form (Giờ đã có ID "form-signin" từ Bước 1.1)
const signInForm = document.getElementById('form-signin');

// Lấy các input (Giờ đã có ID từ Bước 1.1)
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const contactNameInput = document.getElementById('contactName');
const phoneInput = document.getElementById('phone');

// 2. Thêm sự kiện 'submit'
signInForm.addEventListener('submit', async (event) => {
   event.preventDefault(); // Ngăn form tải lại trang

   const email = emailInput.value;
   const password = passwordInput.value;
   const contactName = contactNameInput.value;
   const phone = phoneInput.value;

   // 3. Gọi hàm signUp của Supabase
   const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
         data: {
            // Đây là phần Trưởng nhóm cần để Trigger hoạt động 
            contactName: contactName,
            phone: phone
         }
      }
   });

   if (error) {
      console.error('Lỗi khi đăng ký:', error.message);
      alert('Đăng ký thất bại: ' + error.message);
   } else {
      console.log('Đăng ký thành công:', data);
      alert('Đăng ký thành công! Vui lòng kiểm tra email để xác thực.');
      // Tự động chuyển về trang đăng nhập
      window.location.href = 'login.html';
   }
});