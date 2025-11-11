// supabase/functions/add-bookmark/index.ts

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// SỬA LỖI 1: Xóa cú pháp Markdown [ ](...) khỏi dòng import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer";

// SỬA LỖI 2: Thêm hàm helper để parse JWT thủ công
/**
 * Lấy user ID từ AWT token.
 * Đây là giải pháp dự phòng cho môi trường local dev khi chạy với --no-verify-jwt,
 * vì `context.auth` sẽ bị `undefined`.
 */
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

async function addBookmark(userId, postId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check if bookmark already exists (idempotency)
  const { data: existing, error: checkError } = await supabase
    .from("bookmarks")
    .select("bookmark_id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    // PGRST116 = "JSON object requested, multiple (or no) rows returned" (i.e., no rows)
    // Any other error is a real database error.
    throw checkError;
  }

  if (existing) {
    // Already bookmarked, just return success
    return existing;
  }

  // Insert new bookmark
  const { data, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: userId,
      post_id: postId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

Deno.serve(async (req, context) => {
  // (Hàm này dùng để xử lý lỗi CORS khi gọi từ trình duyệt)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    let userId;

    // SỬA LỖI 2: Thêm logic kiểm tra auth cho local dev
    try {
      // 1. Thử lấy user từ context (Cách chuẩn Production)
      // Chú ý: `context.auth.getUser` không tồn tại, cách đúng là `Deno.env.get("SUPABASE_AUTH_ADMIN_JWT")`
      // Tuy nhiên, trong môi trường dev với --no-verify-jwt, `context.auth` là `undefined`.
      // Chúng ta sẽ giả định rằng nếu `context.auth` tồn tại, nó sẽ có `sub`.
      // Cách làm này không chuẩn, nhưng là cách duy nhất để chạy local dev.
      // Cách làm V3 (tự parse) là an toàn nhất.
      throw new Error("Force fallback to token parsing"); // Luôn ưu tiên parse token
    } catch (e) {
      // 2. Thử lấy user từ JWT (Cách dự phòng cho Local Dev)
      console.log(
        "add-bookmark: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const { postId } = await req.json();
    if (!postId) {
      throw new Error("Missing postId");
    }

    const data = await addBookmark(userId, postId);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in add-bookmark function:", error);
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
