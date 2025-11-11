// supabase/functions/get-lessor-posts/index.ts

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// SỬA LỖI 1: Xóa cú pháp Markdown [ ](...) khỏi dòng import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function getLessorPosts(lessorId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      *,
      districts:district_id (name),
      wards:ward_id (name),
      reviews:reviews (
        review_id,
        created_at,
        rating,
        profiles:user_id (full_name)
      )
    `
    )
    .eq("user_id", lessorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // Calculate average rating for each post
  const postsWithAvgRating = data.map((post) => {
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
    return post;
  });

  return postsWithAvgRating;
}

Deno.serve(async (req) => {
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
    const { lessorId } = await req.json();
    if (!lessorId) {
      throw new Error("Missing lessorId parameter");
    }

    const data = await getLessorPosts(lessorId);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in get-lessor-posts function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
