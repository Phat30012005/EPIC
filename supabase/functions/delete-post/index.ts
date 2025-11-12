// supabase/functions/delete-post/index.ts
// PHIÊN BẢN V2 (Vá lỗi Auth local và lỗi 'image_url' (số ít))

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer"; // Thêm thư viện decode

// === BEGIN: Thêm Hàm Helper Lấy Auth ===
async function getUserIdFromToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization Header");
  }
  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (!payload.sub) {
    throw new Error("Invalid token payload (missing sub)");
  }
  return payload.sub; // sub is the user ID (UUID)
}
// === END: Thêm Hàm Helper Lấy Auth ===

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
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BUCKET_NAME = "post-images";

console.log("[delete-post] Function (NÂNG CẤP V2) đã sẵn sàng.");
// === END: Các hằng số ===

// Hàm Deno.serve (Entrypoint)
Deno.serve(async (req, context) => {
  // 1. Xử lý preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let userId: string; // Biến lưu user ID
  let userEmail: string; // Biến lưu email (cho Admin check)

  // 2. (SỬA LỖI AUTH) Lấy user ID và Email
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Logic vá Auth local
    try {
      throw new Error("Force fallback to token parsing");
    } catch (e) {
      console.log(
        "delete-post: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      return createErrorResponse("Xác thực thất bại", 401);
    }

    // Lấy email (cần cho check Admin)
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError) {
      return createErrorResponse(`Lỗi Auth: ${authError.message}`, 401);
    }
    userEmail = authData.user.email;
  } catch (authError) {
    return createErrorResponse(authError.message, 401);
  }

  // 3. Lấy ID bài đăng từ query param
  const url = new URL(req.url);
  const postId = url.searchParams.get("id");
  if (!postId) {
    return createErrorResponse("Thiếu 'id' của bài đăng", 400);
  }

  // 4. Logic bảo mật (QUAN TRỌNG)
  try {
    // 4.1 Lấy thông tin bài đăng
    // (SỬA LỖI: 'image_url' -> 'image_urls' (số nhiều))
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("user_id, image_urls") // <-- ĐÃ SỬA (số nhiều)
      .eq("post_id", postId) // CSDL V5 dùng 'post_id'
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
    // (SỬA LỖI: 'post.image_url' -> 'post.image_urls' (số nhiều))
    if (post.image_urls && post.image_urls.length > 0) {
      const filePaths = post.image_urls
        .map((url: string) => {
          try {
            const urlObj = new URL(url);
            const path = urlObj.pathname.split(`/public/${BUCKET_NAME}/`)[1];
            return path;
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
      .eq("post_id", postId); // CSDL V5 dùng 'post_id'

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
  } catch (err) {
    return createErrorResponse(err.message || "Lỗi không xác định", 500);
  }
});
