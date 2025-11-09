Tài liệu API (Nội bộ) CHICKY.STU

Tài liệu này dùng để team Frontend biết cách gọi các Edge Function mà team Backend xây dựng.

Giai đoạn 1: Ngày 2

1. Xác thực (Auth)

1.1. Đăng ký

[cite_start]Mục đích: Thay thế logic trong auth-signup.js. [cite: 49, 57]

Endpoint: POST /functions/v1/user-signup
Xác thực: KHÔNG (verify_jwt = false)

Body (Gửi đi - JSON):

{
"email": "user@example.com",
"password": "somepassword",
"contactName": "Tên Liên Hệ",
"phone": "0909123456",
"role": "LESSOR"
}

Response (Nhận về - Thành công 200): { "data": { ...user } }

Response (Nhận về - Thất bại 400/500): { "error": "..." }

1.2. Đăng nhập

[cite_start]Mục đích: Thay thế logic trong auth-login.js. [cite: 50, 57]

Endpoint: POST /functions/v1/user-login
Xác thực: KHÔNG (verify_jwt = false)

Body (Gửi đi - JSON):

{
"email": "user@example.com",
"password": "somepassword"
}

Response (Nhận về - Thành công 200): { "data": { ...session } }

Response (Nhận về - Thất bại 400/500): { "error": "..." }

2. Bài đăng (Posts)

2.1. Lấy chi tiết bài đăng

[cite_start]Mục đích: Thay thế logic trong chitiet.js. [cite: 53, 60]

Endpoint: GET /functions/v1/get-post-detail?id=POST_ID_TRUYEN_VAO

Response (Nhận về - Thành công): { "data": { ...post, profiles: {...} } }

Response (Nhận về - Thất bại): { "error": "..." }

(Sẽ cập nhật thêm cho Ngày 3, 4...)
