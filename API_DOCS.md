# CẤU HÌNH CHO BOOKMARKS (XÓA)

6.2. Xóa Bookmark

Endpoint: DELETE /functions/v1/remove-bookmark

Xác thực: CÓ (verify_jwt = true).

Query Params (Bắt buộc):

post_id: (string) - vd: "UUID-CUA-BAI-DANG"

6.3. Lấy danh sách Bookmark

Endpoint: GET /functions/v1/get-user-bookmarks

Xác thực: CÓ (verify_jwt = true).

Response (Thành công): { "data": [ { "id": "bookmark_uuid", "created_at": "...", "posts": { ...post_details } }, ... ] }

7. Đánh giá (Reviews)

7.1. Thêm Đánh giá

Endpoint: POST /functions/v1/add-review

Xác thực: CÓ (verify_jwt = true).

Body (Gửi đi - JSON):

{
"post_id": "UUID-CUA-BAI-DANG",
"rating": 5,
"comment": "Nhà trọ này rất tốt!"
}

Response (Lỗi 409): { "error": "Bạn đã đánh giá tin này rồi."
