// supabase/functions/delete-post/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hàm tạo phản hồi lỗi chuẩn
function createErrorResponse(message: string, status: number) {
  console.error(`[delete-post] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

// Danh sách email Admin (lấy từ admin-guard.js)
const ADMIN_EMAILS = [
  "phat30012005@gmail.com",
  "lethanhvy102005@gmail.com",
  "maib2308257@student.ctu.edu.vn",
  "ngab2308259@student.ctu.edu.vn",
  "tamb2308270@student.ctu.edu.vn",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Thêm 'DELETE' vào 'Access-Control-Allow-Methods'
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("[delete-post] Function đã sẵn sàng.");

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Lấy user ID từ token (Bảo mật)
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

  // 3. Lấy ID bài đăng từ query param (vd: .../delete-post?id=abc)
  const url = new URL(req.url);
  const postId = url.searchParams.get("id");
  if (!postId) {
    return createErrorResponse("Thiếu 'id' của bài đăng", 400);
  }

  // 4. Khởi tạo Admin Client
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 5. Logic bảo mật (QUAN TRỌNG)
  try {
    // 5.1 Lấy thông tin chủ sở hữu của bài đăng
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("user_id") // Chỉ cần lấy user_id để kiểm tra
      .eq("id", postId)
      .single(); // .single() sẽ lỗi nếu không tìm thấy

    if (postError) {
      if (postError.code === "PGRST116") {
        // Mã lỗi "Không tìm thấy hàng"
        return createErrorResponse("Không tìm thấy bài đăng", 404);
      }
      throw new Error(`Lỗi query post: ${postError.message}`);
    }

    // 5.2 Kiểm tra quyền
    const isOwner = post.user_id === user.id;
    const isAdmin = ADMIN_EMAILS.includes(user.email);

    if (!isOwner && !isAdmin) {
      // Nếu không phải chủ sở hữu VÀ cũng không phải Admin
      return createErrorResponse("Bạn không có quyền xóa bài đăng này", 403); // 403 = Forbidden
    }

    // 5.3 Thực hiện xóa (nếu có quyền)
    const { error: deleteError } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("id", postId);

    if (deleteError) {
      throw new Error(`Lỗi CSDL khi xóa: ${deleteError.message}`);
    }

    // 6. Trả về thành công
    console.log(
      `[delete-post] Xóa thành công post ${postId} bởi user ${user.email}.`
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
