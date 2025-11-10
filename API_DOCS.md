Response (Nhận về - Thất bại): { "error": "..." }

4.3. Lấy tin đăng của Chủ trọ

Endpoint: GET /functions/v1/get-lessor-posts
Xác thực: CÓ (verify_jwt = true)

Body: KHÔNG

Response (Nhận về - Thành công 200): { "data": [...] } (mảng bài đăng)
Response (Nhận về - Thất bại): { "error": "..." }

4.4. Xóa bài đăng

Endpoint: DELETE /functions/v1/delete-post?id=POST_ID_CAN_XOA
Xác thực: CÓ (verify_jwt = true)

Query Params:

?id (uuid) (bắt buộc)

Response (Nhận về - Thành công 200): { "data": { "status": "deleted" } }
Response (Nhận về - Thất bại 403): { "error": "Bạn không có quyền..." }
Response (Nhận về - Thất bại 404): { "error": "Không tìm thấy bài đăng" }
