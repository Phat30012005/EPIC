// supabase/functions/delete-post/index.ts
// (PHIÊN BẢN ĐÃ CHUẨN HÓA LOGIC AUTH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts"; // Dùng hàm shared

// === BEGIN: Các hằng số (Giữ nguyên) ===
function createErrorResponse(message: string, status: number) {
  console.error(`[delete-post] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

const ADMIN_EMAILS = [
  "phatkimlam2005@gmail.com",
  "lethanhvy102005@gmail.com",
  "maib2308257@student.ctu.edu.vn",
  "ngab2308259@student.ctu.edu.vn",
  "tamb2308270@student.ctu.edu.vn",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Sửa: Cho phép DELETE
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET_NAME = "post-images";

console.log("[delete-post] Function (ĐÃ CHUẨN HÓA AUTH) đã sẵn sàng.");
// === END: Các hằng số ===

// Hàm Deno.serve (Entrypoint)
Deno.serve(async (req, context) => {
  // 1. Xử lý preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let userId: string; // Biến lưu user ID
  let userEmail: string; // Biến lưu email (cho Admin check)

  // Khởi tạo Supabase Admin Client
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // --- BƯỚC A: Block Xác thực CHUẨN (Giống create-post) ---
  try {
    if (context && context.auth) {
      // 1. Logic cho Production (khi deploy)
      console.log("Production context detected. Using context.auth.getUser()");
      const {
        data: { user },
        error: authError,
      } = await context.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("User not found (from context)");
      userId = user.id;
      userEmail = user.email; // Lấy email trực tiếp
    } else {
      // 2. Logic cho Local (khi chạy --no-verify-jwt)
      console.warn(
        "Local dev context detected. Falling back to manual JWT parsing."
      );
      userId = await getUserIdFromToken(req); // Dùng shared helper
      
      // Lấy email (logic này vẫn cần)
      const { data: authData, error: authError }_ =
        await supabaseAdmin.auth.admin.getUserById(userId);
      if (authError) throw authError;
      userEmail = authData.user.email;
    }
  } catch (authError) {
    // 3. Nếu cả 2 cách trên lỗi (vd: token sai, hết hạn)
    console.error("Authentication error:", authError.message);
    return createErrorResponse(
      authError.message || "User authentication failed",
      401
    );
  }
  // --- KẾT THÚC BƯỚC A ---

  if (!userId || !userEmail) {
    return createErrorResponse("User authentication failed", 401);
  }

  // --- BƯỚC B: Chạy LOGIC CỐT LÕI CỦA HÀM ---
  // (Phần này giữ nguyên logic của file delete-post gốc)
  
  // 3. Lấy ID bài đăng từ query param
  const url = new URL(req.url);
  const postId = url.searchParams.get("id");
  if (!postId) {
    return createErrorResponse("Thiếu 'id' của bài đăng", 400);
  }

  // 4. Logic bảo mật (QUAN TRỌNG)
  try {
    // 4.1 Lấy thông tin bài đăng
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("user_id, image_urls")
      .eq("post_id", postId)
      .single();

    if (postError) {
      if (postError.code === "PGRST116") {
        return createErrorResponse("Không tìm thấy bài đăng", 404);
      }
      throw new Error(`Lỗi query post: ${postError.message}`);
    }

    // 4.2 Kiểm tra quyền
    const isOwner = post.user_id === userId;
    const isAdmin = ADMIN_EMAILS.includes(userEmail);

    if (!isOwner && !isAdmin) {
      return createErrorResponse("Bạn không có quyền xóa bài đăng này", 403);
    }

    // 4.3 XÓA ẢNH TRONG STORAGE
    if (post.image_urls && post.image_urls.length > 0) {
      const filePaths = post.image_urls
        .map((url: string) => {
          try {
            const urlObj = new URL(url);
            // Sửa logic parse URL cho local
            const pathSegments = urlObj.pathname.split(`/${BUCKET_NAME}/`);
            if (pathSegments.length > 1) {
                return pathSegments[1];
            }
            return null;
          } catch (e) {
            console.warn(`URL ảnh không hợp lệ, bỏ qua: ${url}`);
            return null;
          }
        })
        .filter((p: string | null) => p !== null) as string[];

      if (filePaths.length > 0) {
        console.log(`[delete-post] Đang xóa ${filePaths.length} ảnh...`);
        const { error: storageError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .remove(filePaths);

        if (storageError) {
          console.error("Lỗi khi xóa ảnh khỏi Storage:", storageError.message);
        }
      }
    }

    // 4.4 Thực hiện xóa CSDL
    const { error: deleteError } = await supabaseAdmin
      .from("posts")
      .delete()
      .eq("post_id", postId);

    if (deleteError) {
      throw new Error(`Lỗi CSDL khi xóa: ${deleteError.message}`);
    }

    // 5. Trả về thành công
    console.log(
      `[delete-post] Xóa thành công post ${postId} (và ảnh) bởi user ${userEmail}.`
    );
    return new Response(
      JSON.stringify({ data: { id: postId, status: "deleted" } }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  // --- BƯỚC C: Block catch ngoài ---
  } catch (err) {
    return createErrorResponse(err.message || "Lỗi không xác định", 500);
  }
});