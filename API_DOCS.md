Tài liệu API (Nội bộ) CHICKY.STU

Tài liệu này dùng để team Frontend biết cách gọi các Edge Function mà team Backend xây dựng.

Giai đoạn 1: Ngày 2 (Đã xong)

1. Xác thực (Auth)

1.1. Đăng ký
POST /functions/v1/user-signup (verify_jwt = false)
Body: { "email", "password", "contactName", "phone", "role" }

1.2. Đăng nhập
POST /functions/v1/user-login (verify_jwt = false)
Body: { "email", "password" }

2. Bài đăng (Posts)

2.1. Lấy chi tiết bài đăng
GET /functions/v1/get-post-detail?id=POST_ID (verify_jwt = false)

Giai đoạn 2: Ngày 3 (Đang thực hiện)

3. Bài đăng (Tiếp theo)

3.1. Tạo bài đăng mới (Đăng tin)

Mục đích: Thay thế logic trong dangtin.js.

Endpoint: POST /functions/v1/create-post
Xác thực: BẮT BUỘC (verify_jwt = true)
Gửi Authorization: Bearer <access_token> trong header.

Body (Gửi đi): FormData (Không phải JSON!)

Chứa các cặp key-value cho tất cả các trường (ví dụ: title, price, ward...)

Chứa các file ảnh (ví dụ: images: [file1, file2])

3.2. Lấy danh sách bài đăng (Lọc)

Mục đích: Thay thế logic trong danhSach.js.

Endpoint: GET /functions/v1/get-posts-list
Xác thực: KHÔNG (verify_jwt = false)

Query Params (Ví dụ):

/functions/v1/get-posts-list (lấy tất cả)

/functions/v1/get-posts-list?type=Phòng%20đơn&price=1-2&ward=Ninh%20Kiều
