CHICKY.STU - Website Tìm trọ Cần Thơ (Fullstack)

CHICKY.STU là một dự án website tìm phòng trọ tại Cần Thơ, được xây dựng với kiến trúc fullstack hiện đại, bảo mật, và tối ưu hiệu năng.

Dự án này đã trải qua quá trình "refactor" (tái cấu trúc) toàn diện, chuyển đổi từ một ứng dụng frontend thuần túy (dùng Supabase BaaS) sang một kiến trúc Backend-trung-gian mạnh mẽ, sử dụng Supabase Edge Functions cho toàn bộ logic nghiệp vụ.

Công nghệ sử dụng

Backend: Supabase

Database: CSDL Postgres (với RLS bảo mật).

Auth: Supabase Auth (Quản lý User, JWT).

Storage: Supabase Storage (Upload & lưu trữ ảnh, đã bật Caching).

Serverless API: Supabase Edge Functions (Deno/TypeScript) - Toàn bộ 13+ API nghiệp vụ được xây dựng trên nền tảng này.

Frontend: HTML5, CSS3, JavaScript (ESM).

Styling: Phối hợp giữa Bootstrap 5 và TailwindCSS.

Tính năng chính

Toàn bộ các tính năng dưới đây đều được xử lý 100% qua API backend (Edge Functions), đảm bảo an toàn và bảo mật:

Xác thực & Phân quyền:

Đăng ký / Đăng nhập (JWT).

Phân quyền (Role) 2 vai trò: LESSOR (Chủ trọ) và RENTER (Người thuê).

Phân quyền Admin (dựa trên email list).

Quản lý Bài đăng (CRUD):

Chủ trọ (LESSOR) có thể tạo bài đăng.

Upload song song nhiều file ảnh lên Storage.

Chủ trọ và Admin có thể xóa bài đăng.

Bảo mật bằng Row Level Security (RLS) và logic kiểm tra quyền ở backend.

Tìm kiếm (Full-Text Search):

Tìm kiếm FTS (Full-Text Search) tiếng Việt (có bỏ dấu) trên title, motelName, description.

Sử dụng Cấu hình vietnamese (với unaccent) của Postgres.

Bookmarks (Lưu tin):

Người dùng (đã đăng nhập) có thể "Lưu" hoặc "Bỏ lưu" một bài đăng.

Trang Profile hiển thị danh sách các tin đã lưu (JOIN).

Đánh giá (Reviews):

Người dùng (đã đăng nhập) có thể đánh giá (1-5 sao) và bình luận.

Chống spam (mỗi user chỉ được đánh giá 1 lần / 1 bài đăng).

Trang chi tiết hiển thị danh sách đánh giá (JOIN với profiles để lấy tên).

Hướng dẫn chạy Local

Dự án này yêu cầu Supabase CLI để chạy backend (Edge Functions và CSDL) local.

Yêu cầu:

Cài đặt Supabase CLI.

Một trình chạy server (như VS Code Live Server hoặc npm install -g live-server).

Clone dự án:

git clone [URL_GITHUB_CUA_BAN]
cd [TEN_THU_MUC_DU_AN]

Khởi động Supabase (Backend & CSDL):

Lệnh này sẽ khởi động Docker, CSDL, Auth, Storage, và API local.

supabase start

Cấu hình Frontend (Client):

Sau khi chạy supabase start, terminal sẽ hiển thị các keys.

Mở file public/js/supabase-config.js.
Đảm bảo 2 biến SUPABASE_URL và SUPABASE_ANON_KEY khớp với các giá trị local mà terminal vừa cung cấp (thường là http://127.0.0.1:54321 và một key eyJ...).

Đẩy CSDL (Rất quan trọng):

Lệnh này sẽ chạy tất cả các file trong supabase/migrations/ để tạo bảng, kích hoạt RLS, và cài đặt FTS (Tìm kiếm).

npx supabase db push

Chạy Backend (Edge Functions):

Mở một terminal mới.

Chạy lệnh này để phục vụ các function trong supabase/functions/.

npx supabase functions serve --no-verify-jwt

(Lưu ý: --no-verify-jwt là bắt buộc để test các API bảo mật ở local).

Chạy Frontend (Client):

Sử dụng VS Code Live Server và mở file public/index.html.

Hoặc, mở một terminal mới thứ ba:

live-server public

Truy cập http://127.0.0.1:8080 (hoặc cổng mà Live Server cung cấp) và sử dụng website.
