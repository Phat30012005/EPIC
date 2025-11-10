# CẤU HÌNH CHO BOOKMARKS (XÓA)

[functions.remove-bookmark]
enabled = true
verify_jwt = true # <--- true, BẮT BUỘC đăng nhập
import_map = "./functions/remove-bookmark/deno.json"
entrypoint = "./functions/remove-bookmark/index.ts"

6.2. Xóa Bookmark

Endpoint: DELETE /functions/v1/remove-bookmark

Xác thực: CÓ (verify_jwt = true).

Query Params (Bắt buộc):

post_id: (string) - vd: "UUID-CUA-BAI-DANG"
