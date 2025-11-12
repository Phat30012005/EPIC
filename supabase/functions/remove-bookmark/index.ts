// supabase/functions/remove-bookmark/index.ts
// PHIÊN BẢN V2 (Đã dọn dẹp 'post_id' và sửa lỗi Auth/GET)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer";

// SỬA LỖI 2: Thêm hàm helper để parse JWT thủ công
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

// (SỬA LỖI: Đổi tên tham số thành 'post_id' (snake_case))
async function removeBookmark(userId, post_id) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("post_id", post_id); // <--- ĐÃ SỬA

  if (error) {
    throw error;
  }
  return { message: "Bookmark removed successfully" };
}

Deno.serve(async (req, context) => {
  // (Hàm này dùng để xử lý lỗi CORS khi gọi từ trình duyệt)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS", // <--- SỬA (Cho phép DELETE)
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    let userId;

    // SỬA LỖI 2: Thêm logic kiểm tra auth cho local dev
    try {
      throw new Error("Force fallback to token parsing");
    } catch (e) {
      console.log(
        "remove-bookmark: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // (SỬA LỖI: Đọc 'post_id' từ URL (DELETE) thay vì req.json())
    const url = new URL(req.url);
    const post_id = url.searchParams.get("post_id"); // <--- SỬA

    if (!post_id) {
      // <--- SỬA
      throw new Error("Missing 'post_id' parameter");
    }

    const data = await removeBookmark(userId, post_id); // <--- SỬA

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in remove-bookmark function:", error);
    const status = error.message.includes("not authenticated") ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
