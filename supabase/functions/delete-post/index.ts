// supabase/functions/delete-post/index.ts
// PHIÊN BẢN NÂNG CẤP (CÓ XÓA ẢNH TRONG STORAGE)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hàm tạo phản hồi lỗi chuẩn (giữ nguyên)
function createErrorResponse(message: string, status: number) {
  console.error(`[delete-post] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

// Danh sách email Admin (giữ nguyên)
const ADMIN_EMAILS = [
  "phatkimlam2005@gmail.com",
  "lethanhvy102005@gmail.com",
  "maib2308257@student.ctu.edu.vn",
  "ngab2308259@student.ctu.edu.vn",
  "tamb2308270@student.ctu.edu.vn",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // (Đảm bảo có DELETE)
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET_NAME = "post-images";

console.log("[delete-post] Function (NÂNG CẤP) đã sẵn sàng.");

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Lấy user ID từ token (Bảo mật - giữ nguyên)
  const {
    data: { user },
    error: authError,
  } = await context.auth.getUser();

  if (authError) {
    return createErrorResponse(`Xác thực thất bại: ${authError.message}`, 401);
  }
  if (!user) {
    return createErrorResponse(
      "Không tìm thấy user (token không hợp lệ?)",
      401
    );
  }

  // 3. Lấy ID bài đăng từ query param (giữ nguyên)
  const url = new URL(req.url);
  const postId = url.searchParams.get("id");
  if (!postId) {
    return createErrorResponse("Thiếu 'id' của bài đăng", 400);
  }

  // 4. Khởi tạo Admin Client (giữ nguyên)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 5. Logic bảo mật (QUAN TRỌNG)
  try {
    // 5.1 Lấy thông tin bài đăng (ĐÃ SỬA: Lấy thêm 'image_url')
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("user_id, image_url") // <-- LẤY THÊM 'image_url'
      .eq("id", postId)
      .single();

    if (postError) {
      if (postError.code === "PGRST116") {
        return createErrorResponse("Không tìm thấy bài đăng", 404);
      }
      throw new Error(`Lỗi query post: ${postError.message}`);
    }

    // 5.2 Kiểm tra quyền (giữ nguyên)
    const isOwner = post.user_id === user.id;
    const isAdmin = ADMIN_EMAILS.includes(user.email);

    if (!isOwner && !isAdmin) {
      return createErrorResponse("Bạn không có quyền xóa bài đăng này", 403);
    }

    // 5.3 === NÂNG CẤP: XÓA ẢNH TRONG STORAGE ===
    if (post.image_url && post.image_url.length > 0) {
      // (Trích xuất 'path' từ 'publicUrl')
      // URL: .../storage/v1/object/public/post-images/public/user-id/file.png
      // Path:                                     public/user-id/file.png
      const filePaths = post.image_url
        .map((url: string) => {
          try {
            const urlObj = new URL(url);
            // (Tách chuỗi dựa trên tên bucket)
            const path = urlObj.pathname.split(`/public/${BUCKET_NAME}/`)[1];
            return path;
          } catch (e) {
            console.warn(`URL ảnh không hợp lệ, bỏ qua: ${url}`);
            return null;
          }
        })
        .filter((p: string | null) => p !== null) as string[]; // (Lọc ra các url hỏng)

      if (filePaths.length > 0) {
        console.log(`[delete-post] Đang xóa ${filePaths.length} ảnh...`);
        const { error: storageError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .remove(filePaths);

        if (storageError) {
          // (Chỉ ghi log lỗi, không dừng lại, vì xóa CSDL quan trọng hơn)
          console.error("Lỗi khi xóa ảnh khỏi Storage:", storageError.message);
        }
      }
    }

    // 5.4 Thực hiện xóa CSDL (giữ nguyên)
    const { error: deleteError } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", postId);

    if (deleteError) {
      throw new Error(`Lỗi CSDL khi xóa: ${deleteError.message}`);
    }

    // 6. Trả về thành công
    console.log(
      `[delete-post] Xóa thành công post ${postId} (và ảnh) bởi user ${user.email}.`
    );
    return new Response(
      JSON.stringify({ data: { id: postId, status: "deleted" } }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    return createErrorResponse(err.message || "Lỗi không xác định", 500);
  }
});
