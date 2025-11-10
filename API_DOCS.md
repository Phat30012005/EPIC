Tài liệu API (Nội bộ) CHICKY.STU

Tài liệu này dùng để team Frontend biết cách gọi các Edge Function mà team Backend xây dựng.

Giai đoạn 1: Ngày 2

Xác thực (Auth)

1.1. Đăng ký

Mục đích: Thay thế logic trong auth-signup.js.

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

Mục đích: Thay thế logic trong auth-login.js.

Endpoint: POST /functions/v1/user-login
Xác thực: KHÔNG (verify_jwt = false)

Body (Gửi đi - JSON):

{
"email": "user@example.com",
"password": "somepassword"
}

Response (Nhận về - Thành công 200): { "data": { ...session } }

Response (Nhận về - Thất bại 400/500): { "error": "..." }

Bài đăng (Posts)

2.1. Lấy chi tiết bài đăng

Mục đích: Thay thế logic trong chitiet.js.

Endpoint: GET /functions/v1/get-post-detail?id=POST_ID_TRUYEN_VAO

Response (Nhận về - Thành công): { "data": { ...post, profiles: {...} } }

Response (Nhận về - Thất bại): { "error": "..." }

Giai đoạn 2: Ngày 3-4

Bài đăng (Tiếp)

3.1. Đăng tin mới

Endpoint: POST /functions/v1/create-post
Xác thực: CÓ (verify_jwt = true)

Body (Gửi đi - FormData):

title (string)

motelName (string)

price (string)

area (string)

rooms (string)

ward (string)

address (string)

description (string)

room_type (string)

contactName (string)

phone (string)

email (string)

highlights (string - JSON.stringify của mảng)

images (File)

images (File)

... (có thể gửi nhiều file 'images')

Response (Nhận về - Thành công 200): { "data": { id, title, ... } }
Response (Nhận về - Thất bại): { "error": "..." }

3.2. Lấy danh sách (Filter)

Endpoint: GET /functions/v1/get-posts-list
Xác thực: KHÔNG (verify_jwt = false)

Query Params (Gửi đi):

?price=1-2

?type=Phòng+đơn

?size=10-16

?ward=Ninh+Kiều

Response (Nhận về - Thành công 200): { "data": [...] } (mảng bài đăng)
Response (Nhận về - Thất bại): { "error": "..." }

Người dùng (User)

4.1. Lấy thông tin Profile

Endpoint: GET /functions/v1/get-user-profile
Xác thực: CÓ (verify_jwt = true)

Body: KHÔNG

Response (Nhận về - Thành công 200): { "data": { contactName, phone, role, email } }
Response (Nhận về - Thất bại): { "error": "..." }

4.2. Cập nhật thông tin Profile

Endpoint: POST /functions/v1/update-user-profile
Xác thực: CÓ (verify_jwt = true)

Body (Gửi đi - JSON):
{
"contactName": "Tên Mới",
"phone": "0909876543"
}

Response (Nhận về - Thành công 200): { "data": { id, contactName, phone, ... } } (profile mới)
Response (Nhận về - Thất bại): { "error": "..." }

4.3. Lấy tin đăng của Chủ trọ

Endpoint: GET /functions/v1/get-lessor-posts
Xác thực: CÓ (verify_jwt = true)

Body: KHÔNG

Response (Nhận về - Thành công 200): { "data": [...] } (mảng bài đăng)
Response (Nhận về - Thất bại): { "error": "..." }
