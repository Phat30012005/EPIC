// supabase/functions/add-review/index.ts
// (PHIÊN BẢN ĐÃ CHUẨN HÓA LOGIC AUTH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

// (Hàm logic `addReview` giữ nguyên)
async function addReview(userId, post_id, rating, comment) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
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
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      user_id: userId,
      post_id: post_id,
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
    if (error.code === "23505") {
      throw new Error("You have already reviewed this post.");
    }
    throw error;
  }
  return data;
}

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const { post_id, rating, comment } = await req.json();
    if (!post_id || !rating) {
      throw new Error("Missing post_id or rating");
    }
    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      throw new Error("Rating must be a number between 1 and 5");
    }
    const data = await addReview(userId, post_id, rating, comment);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    // --- KẾT THÚC BƯỚC B ---

    // --- BƯỚC C: Block catch ngoài ---
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
      status = 403; // Lỗi 403 (Forbidden) cho logic nghiệp vụ
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
