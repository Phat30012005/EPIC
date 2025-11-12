// supabase/functions/get-lessor-posts/index.ts
// PHIÊN BẢN V2 (Sửa lỗi 500, lỗi select CSDL, và lỗi logic Auth)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer";

// === BEGIN: Hàm Helper Lấy Auth (Giống các function khác) ===
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
// === END: Hàm Helper Lấy Auth ===

// Hàm logic (ĐÃ SỬA LỖI SELECT)
async function getLessorPosts(lessorId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // (SỬA LỖI: Bỏ 'districts' và 'wards'. Chỉ select cột có thật trong CSDL V4)
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      id:post_id,
      title,
      price,
      ward,
      created_at,
      reviews:reviews ( rating )
    `
    )
    .eq("user_id", lessorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // Tính toán avg_rating (Giữ nguyên)
  const postsWithAvgRating = data.map((post) => {
    let totalRating = 0;
    const reviewsCount = Array.isArray(post.reviews) ? post.reviews.length : 0;

    if (reviewsCount > 0) {
      post.reviews.forEach((review) => {
        totalRating += review.rating;
      });
      post.average_rating = (totalRating / reviewsCount).toFixed(1);
    } else {
      post.average_rating = "N/A";
    }
    delete post.reviews;
    return post;
  });

  return postsWithAvgRating;
}

// Hàm Deno.serve (ĐÃ SỬA LỖI LOGIC AUTH)
Deno.serve(async (req, context) => {
  // Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS", // Chỉ cho phép GET
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    let userId;
    // (SỬA LỖI: Lấy userId từ token, không phải từ body)
    try {
      throw new Error("Force fallback to token parsing");
    } catch (e) {
      console.log(
        "get-lessor-posts: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Gọi hàm logic với userId (lessorId) đã xác thực
    const data = await getLessorPosts(userId);

    // Trả về thành công
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Lỗi trong function get-lessor-posts:", error.message);
    let status = 500;
    if (error.message.includes("not authenticated")) status = 401;

    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
