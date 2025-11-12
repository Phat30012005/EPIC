// supabase/functions/add-review/index.ts
// PHIÊN BẢN V2 (Đã dọn dẹp 'post_id')

// Setup type definitions for built-in Supabase Runtime APIs
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
async function addReview(userId, post_id, rating, comment) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Check if user is RENTER (Policy RLS sẽ lo việc này, nhưng check ở đây tốt hơn)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError) {
    throw new Error(`Profile check failed: ${profileError.message}`);
  }
  if (profile.role !== "RENTER") {
    throw new Error("Only RENTERs can add reviews.");
  }

  // 2. Insert the review
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      user_id: userId,
      post_id: post_id, // <--- ĐÃ SỬA
      rating: rating,
      comment: comment,
    })
    .select(
      `
      *,
      profiles:user_id (full_name, avatar_url)
    `
    )
    .single();

  if (error) {
    // Check for unique constraint violation (user already reviewed this post)
    if (error.code === "23505") {
      // 23505 is unique_violation
      throw new Error("You have already reviewed this post.");
    }
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
      throw new Error("Force fallback to token parsing");
    } catch (e) {
      console.log(
        "add-review: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // (SỬA LỖI: Nhận 'post_id' (snake_case) từ frontend)
    const { post_id, rating, comment } = await req.json();
    if (!post_id || !rating) {
      // <--- ĐÃ SỬA
      throw new Error("Missing post_id or rating");
    }
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      throw new Error("Rating must be a number between 1 and 5");
    }

    const data = await addReview(userId, post_id, rating, comment); // <--- ĐÃ SỬA
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in add-review function:", error);
    let status = 500;
    if (error.message.includes("not authenticated")) {
      status = 401;
    }
    if (
      error.message.includes("already reviewed") ||
      error.message.includes("Only RENTERs")
    ) {
      status = 403;
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
