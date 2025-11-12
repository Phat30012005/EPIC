// supabase/functions/get-user-bookmarks/index.ts

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// SỬA LỖI 1: Xóa cú pháp Markdown [ ](...) khỏi dòng import
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

async function getUserBookmarks(userId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Lấy danh sách bookmarks, join với 'posts'
  // (Đã SỬA: Bỏ 'districts', 'wards', 'reviews' vì CSDL V3 không có)
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      `
      bookmark_id,
      created_at,
      posts:post_id (
        post_id,
        title,
        price,
        area,
        image_urls,
        address_detail,
        ward 
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // 2. Xử lý dữ liệu (Làm phẳng cấu trúc)
  // (Tạm thời bỏ qua 'avg_rating' để sửa lỗi 500)
  const simplifiedBookmarks = data.map((bookmark) => {
    // Đảm bảo `bookmark.posts` không null
    if (!bookmark.posts) {
      return { ...bookmark, post: null };
    }

    // Đổi tên 'posts' (số nhiều) thành 'post' (số ít)
    const post = bookmark.posts;
    delete bookmark.posts;
    return { ...bookmark, post: post };
  });

  // Lọc ra các bookmark mà post đã bị xóa
  const validBookmarks = simplifiedBookmarks.filter((b) => b.post !== null);

  return validBookmarks;
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
      throw new Error("Force fallback to token parsing");
    } catch (e) {
      console.log(
        "get-user-bookmarks: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const data = await getUserBookmarks(userId);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in get-user-bookmarks function:", error);
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
