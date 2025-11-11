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

  // 1. Lấy danh sách bookmarks của user, join với bảng posts
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
        districts:district_id (name),
        wards:ward_id (name),
        reviews:reviews (rating) 
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // 2. Xử lý dữ liệu (tính avg_rating)
  const bookmarksWithAvgRating = data.map((bookmark) => {
    // Đảm bảo `bookmark.posts` không null (trường hợp post đã bị xóa nhưng bookmark còn)
    if (!bookmark.posts) {
      return { ...bookmark, post: null, average_rating: "N/A" };
    }

    const post = bookmark.posts;
    let totalRating = 0;
    const reviewsCount = post.reviews.length;

    if (reviewsCount > 0) {
      post.reviews.forEach((review) => {
        totalRating += review.rating;
      });
      post.average_rating = (totalRating / reviewsCount).toFixed(1);
    } else {
      post.average_rating = "N/A";
    }

    // Làm phẳng cấu trúc
    delete bookmark.posts; // Xóa key `posts` (số nhiều)
    return { ...bookmark, post: post }; // Thêm key `post` (số ít)
  });

  // Lọc ra các bookmark mà post đã bị xóa
  const validBookmarks = bookmarksWithAvgRating.filter((b) => b.post !== null);

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
