// supabase/functions/search-posts/index.ts

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// SỬA LỖI 1: Xóa cú pháp Markdown [ ](...) khỏi dòng import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function searchPosts(searchTerm) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Use the search_posts_v2 RPC function defined in migration 20251110200000_add_fts_v2.sql
  const { data, error } = await supabase.rpc("search_posts_v2", {
    search_term: searchTerm,
  });

  if (error) {
    throw error;
  }

  // The RPC function returns posts, but we need to fetch reviews and calculate avg_rating
  if (!data || data.length === 0) {
    return [];
  }

  // Get post IDs
  const postIds = data.map((post) => post.post_id);

  // Fetch reviews for these posts
  const { data: reviewsData, error: reviewsError } = await supabase
    .from("reviews")
    .select("post_id, rating")
    .in("post_id", postIds);

  if (reviewsError) {
    throw reviewsError;
  }

  // Create a map for quick lookup of reviews
  const reviewsMap = new Map();
  reviewsData.forEach((review) => {
    if (!reviewsMap.has(review.post_id)) {
      reviewsMap.set(review.post_id, []);
    }
    reviewsMap.get(review.post_id).push(review.rating);
  });

  // Calculate average rating for each post
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
    const { searchTerm } = await req.json();
    if (typeof searchTerm !== "string" || searchTerm.trim() === "") {
      throw new Error("Missing or invalid searchTerm parameter");
    }

    const data = await searchPosts(searchTerm);
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
