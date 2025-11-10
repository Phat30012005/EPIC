Tài liệu API (Nội bộ) CHICKY.STU

Tài liệu này dùng để team Frontend biết cách gọi các Edge Function mà team Backend xây dựng.

Giai đoạn 1: Ngày 2 (Hoàn thành)

Xác thực (Auth)

1.1. Đăng ký

Endpoint: POST /functions/v1/user-signup

Xác thực: KHÔNG (verify_jwt = false)

Body (JSON): { "email", "password", "contactName", "phone", "role" }

Response (Thành công): { "data": { ...user } }

Response (Thất bại): { "error": "..." }

1.2. Đăng nhập

Endpoint: POST /functions/v1/user-login

Xác thực: KHÔNG (verify_jwt = false)

Body (JSON): { "email", "password" }

Response (Thành công): { "data": { ...session } }

Response (Thất bại): { "error": "..." }

Bài đăng (Posts)

2.1. Lấy chi tiết bài đăng

Endpoint: GET /functions/v1/get-post-detail?id=POST_ID_TRUYEN_VAO

Xác thực: KHÔNG (verify_jwt = false).

Response (Thành công): { "data": { ...post, profiles: {...} } }

Response (Thất bại): { "error": "..." }

Giai đoạn 2: Ngày 3-4 (Hoàn thành)

3. Đăng tin & Tải tin

3.1. Đăng tin mới

Endpoint: POST /functions/v1/create-post

Xác thực: CÓ (verify_jwt = true).

Body (Bắt buộc): FormData

title: (string)

motelName: (string)

price: (number)

area: (number)

rooms: (number)

ward: (string)

address: (string)

description: (string)

highlights: (string - JSON stringified) - vd: '["Có điều hoà", "Không chung chủ"]'

room_type: (string)

contactName: (string)

phone: (string)

email: (string)

images: (File[]) - (Nhiều file, cùng key 'images')

3.2. Lấy danh sách (Có Filter)

Endpoint: GET /functions/v1/get-posts-list

Xác thực: KHÔNG (verify_jwt = false).

Query Params (Tùy chọn):

price: (string) - vd: "1-2", "3-4", "5-6", "tren6"

type: (string) - vd: "Phòng đơn", "Căn hộ"

size: (string) - vd: "10-16", "17-25", "26-35", "tren35"

ward: (string) - vd: "Ninh Kiều", "Cái Răng"

4. User & Admin

4.1. Lấy thông tin Profile

Endpoint: GET /functions/v1/get-user-profile

Xác thực: CÓ (verify_jwt = true).

Response (Thành công): { "data": { ...profile } }

4.2. Cập nhật Profile

Endpoint: POST /functions/v1/update-user-profile

Xác thực: CÓ (verify_jwt = true).

Body (JSON):

{
"contactName": "Tên mới",
"phone": "0909..."
}

4.3. Lấy tin đăng của Chủ trọ

Endpoint: GET /functions/v1/get-lessor-posts

Xác thực: CÓ (verify_jwt = true).

Response (Thành công): { "data": [...] } (Mảng các bài đăng)

4.4. Xóa bài đăng

Endpoint: DELETE /functions/v1/delete-post?id=POST_ID_CAN_XOA

Xác thực: CÓ (verify_jwt = true).

Logic: Chỉ cho phép xóa nếu là chủ sở hữu HOẶC là admin.

Giai đoạn 3: Ngày 6 (Đang thực hiện)

5. Tìm kiếm

5.1. Tìm kiếm Full-Text Search

Endpoint: GET /functions/v1/search-posts

Xác thực: KHÔNG (verify_jwt = false).

Query Params (Bắt buộc):

q: (string) - vd: "phòng trọ giá rẻ ninh kiều"

6. Bookmarks (Lưu tin)
   6.1. Thêm Bookmark

Endpoint: POST /functions/v1/add-bookmark

Xác thực: CÓ (verify_jwt = true).

Body (JSON):

{
"post_id": "UUID-CUA-BAI-DANG"
}
