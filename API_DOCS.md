Tài liệu API (Nội bộ) CHICKY.STU

Tài liệu này dùng để team Frontend biết cách gọi các Edge Function mà team Backend xây dựng.

Giai đoạn 1: Ngày 2 (Đã hoàn thành)

1. Xác thực (Auth)

1.1. Đăng ký

Endpoint: POST /functions/v1/user-signup

Xác thực: KHÔNG (verify_jwt = false)

Body (JSON):

{
"email": "user@example.com",
"password": "somepassword",
"contactName": "Tên Liên Hệ",
"phone": "0909123456",
"role": "LESSOR"
}

1.2. Đăng nhập

Endpoint: POST /functions/v1/user-login

Xác thực: KHÔNG (verify_jwt = false)

Body (JSON):

{
"email": "user@example.com",
"password": "somepassword"
}

2. Bài đăng (Posts)

2.1. Lấy chi tiết bài đăng

Endpoint: GET /functions/v1/get-post-detail?id=POST_ID

Xác thực: KHÔNG (verify_jwt = false)

Giai đoạn 2: Ngày 3-4 (Đã hoàn thành)

3. Bài đăng (Tiếp)

3.1. Tạo bài đăng mới

Endpoint: POST /functions/v1/create-post

Xác thực: CÓ (verify_jwt = true). Cần gửi Authorization: Bearer <token>

Body (FormData):

images: (File) - Gửi nhiều file với cùng key này

title: (string)

motelName: (string)

price: (string) - vd: "1500000"

area: (string) - vd: "20"

rooms: (string) - vd: "1"

ward: (string) - vd: "An Cư (Ninh Kiều)"

address: (string)

description: (string)

highlights: (string) - vd: "["Có điều hoà", "Không chung chủ"]" (JSON stringify)

room_type: (string) - vd: "Phòng đơn"

contactName: (string)

phone: (string)

email: (string)

3.2. Lấy danh sách bài đăng (Filter)

Endpoint: GET /functions/v1/get-posts-list

Xác thực: KHÔNG (verify_jwt = false)

Query Params (Tùy chọn):

price: (string) - vd: "1-2"

type: (string) - vd: "Phòng đơn"

size: (string) - vd: "10-16"

ward: (string) - vd: "Ninh Kiều"

typeUrl: (string) - vd: "Phòng%20đơn"

4. Người dùng & Admin

4.1. Lấy thông tin Profile

Endpoint: GET /functions/v1/get-user-profile

Xác thực: CÓ (verify_jwt = true).

4.2. Cập nhật thông tin Profile

Endpoint: POST /functions/v1/update-user-profile

Xác thực: CÓ (verify_jwt = true).

Body (JSON):

{
"contactName": "Tên mới",
"phone": "0987654321"
}

4.3. Lấy tin đăng của Chủ trọ

Endpoint: GET /functions/v1/get-lessor-posts

Xác thực: CÓ (verify_jwt = true).

4.4. Xóa bài đăng

Endpoint: DELETE /functions/v1/delete-post?id=POST_ID

Xác thực: CÓ (verify_jwt = true).

Logic: Cho phép nếu (là chủ sở hữu) HOẶC (là admin).

Giai đoạn 3: Ngày 6 (Đang thực hiện)

5. Tìm kiếm

5.1. Tìm kiếm Full-Text Search

Endpoint: GET /functions/v1/search-posts?q=KEYWORD

Xác thực: KHÔNG (verify_jwt = false)

Query Params (Bắt buộc):

q: (string) - vd: "phòng trọ giá rẻ ninh kiều"
