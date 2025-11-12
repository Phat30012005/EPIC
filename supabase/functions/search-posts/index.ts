// supabase/functions/search-posts/index.ts
// PHIÊN BẢN V2 (Sửa triệt để lỗi 500 do GET/POST)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// === PHẦN 1: HÀM LOGIC (Giữ nguyên) ===
// (Hàm này đã đúng với CSDL V5: dùng RPC 'search_posts_v2' và 'post_id')
async function searchPosts(searchTerm) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Gọi RPC (Full-Text Search)
  const { data, error } = await supabase.rpc("search_posts_v2", {
    search_term: searchTerm,
  });

  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    return [];
  }

  // 2. Lấy Post IDs (CSDL V5 dùng 'post_id' -> ĐÚNG)
  const postIds = data.map((post) => post.post_id);

  // 3. Lấy Reviews (CSDL V5 có bảng 'reviews' -> ĐÚNG)
  const { data: reviewsData, error: reviewsError } = await supabase
    .from("reviews")
    .select("post_id, rating")
    .in("post_id", postIds);

  if (reviewsError) {
    throw reviewsError;
  }

  // 4. Tạo map
  const reviewsMap = new Map();
  reviewsData.forEach((review) => {
    if (!reviewsMap.has(review.post_id)) {
      reviewsMap.set(review.post_id, []);
    }
    reviewsMap.get(review.post_id).push(review.rating);
  });

  // 5. Tính toán và gán 'id' cho frontend
  const postsWithAvgRating = data.map((post) => {
    const reviews = reviewsMap.get(post.post_id) || [];
    let totalRating = 0;
    const reviewsCount = reviews.length;

    if (reviewsCount > 0) {
      reviews.forEach((rating) => {
        totalRating += rating;
      });
      post.average_rating = (totalRating / reviewsCount).toFixed(1);
    } else {
      post.average_rating = "N/A";
    }

    // (SỬA LỖI: Thêm alias 'id' để frontend 'danhSach.js' hiểu)
    post.id = post.post_id;

    return post;
  });

  return postsWithAvgRating;
}

// === PHẦN 2: DENO.SERVE (Sửa triệt để lỗi GET/POST) ===
Deno.serve(async (req) => {
  // Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS", // <--- SỬA (Chỉ cho phép GET)
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // (SỬA LỖI: Đọc tham số từ URL thay vì req.json())
    const url = new URL(req.url);
    const searchTerm = url.searchParams.get("q"); // <--- SỬA (Đọc tham số 'q')

    if (typeof searchTerm !== "string" || searchTerm.trim() === "") {
      throw new Error("Missing or invalid 'q' parameter");
    }

    const data = await searchPosts(searchTerm);

    // (SỬA LỖI: Trả về mảng trực tiếp, vì 'danhSach.js' mong đợi 'data' là mảng)
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in search-posts function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
