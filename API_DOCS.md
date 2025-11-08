Tài liệu API (Nội bộ) CHICKY.STU

Tài liệu này dùng để team Frontend biết cách gọi các Edge Function mà team Backend xây dựng.

Giai đoạn 1: Ngày 2

1. Xác thực (Auth)

1.1. Đăng ký

Mục đích: Thay thế logic trong auth-signup.js.

Endpoint: POST /functions/v1/user-signup

Body (Gửi đi - JSON):

{
"email": "user@example.com",
"password": "somepassword",
"contactName": "Tên Liên Hệ",
"phone": "0909123456",
"role": "LESSOR"
}

Response (Nhận về - Thành công): { "data": { ...user } }

Response (Nhận về - Thất bại): { "error": "..." }

1.2. Đăng nhập

Mục đích: Thay thế logic trong auth-login.js.

Endpoint: POST /functions/v1/user-login

Body (Gửi đi - JSON):

{
"email": "user@example.com",
"password": "somepassword"
}

Response (Nhận về - Thành công): { "data": { ...session } }

Response (Nhận về - Thất bại): { "error": "..." }

2. Bài đăng (Posts)

2.1. Lấy chi tiết bài đăng

Mục đích: Thay thế logic trong chitiet.js.

Endpoint: GET /functions/v1/get-post-detail?id=POST_ID_TRUYEN_VAO

Response (Nhận về - Thành công): { "data": { ...post, profiles: {...} } }

Response (Nhận về - Thất bại): { "error": "..." }

(Sẽ cập nhật thêm cho Ngày 3, 4...)
