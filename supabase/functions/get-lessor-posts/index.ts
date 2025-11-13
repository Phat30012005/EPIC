// supabase/functions/get-lessor-posts/index.ts
// (PHIÊN BẢN ĐÃ CHUẨN HÓA LOGIC AUTH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

// (Hàm logic `getLessorPosts` giữ nguyên)
async function getLessorPosts(lessorId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
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

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 2. Block try...catch chính
  try {
    let userId: string; // Khai báo userId

    // --- BƯỚC A: Block Xác thực CHUẨN ---
    try {
      if (context && context.auth) {
        console.log(
          "Production context detected. Using context.auth.getUser()"
        );
        const {
          data: { user },
          error: authError,
        } = await context.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("User not found (from context)");
        userId = user.id;
      } else {
        console.warn(
          "Local dev context detected. Falling back to manual JWT parsing."
        );
        userId = await getUserIdFromToken(req); // Dùng shared helper
      }
    } catch (authError) {
      console.error("Authentication error:", authError.message);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    // --- KẾT THÚC BƯỚC A ---

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // --- BƯỚC B: Chạy LOGIC CỐT LÕI CỦA HÀM ---
    // (Đây là hàm GET, không cần req.json())
    const data = await getLessorPosts(userId);
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
    // --- KẾT THÚC BƯỚC B ---

    // --- BƯỚC C: Block catch ngoài ---
  } catch (error) {
    console.error("Error in get-lessor-posts function:", error.message);
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
