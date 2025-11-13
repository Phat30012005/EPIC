// supabase/functions/add-bookmark/index.ts
// (PHIÊN BẢN ĐÃ CHUẨN HÓA LOGIC AUTH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

// (Hàm logic `addBookmark` giữ nguyên)
async function addBookmark(userId, post_id) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: existing, error: checkError } = await supabase
    .from("bookmarks")
    .select("bookmark_id")
    .eq("user_id", userId)
    .eq("post_id", post_id)
    .single();
  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }
  if (existing) {
    return existing;
  }
  const { data, error } = await supabase
    .from("bookmarks")
    .insert({
      user_id: userId,
      post_id: post_id,
    })
    .select()
    .single();
  if (error) {
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
    const { post_id } = await req.json();
    if (!post_id) {
      throw new Error("Missing post_id");
    }
    const data = await addBookmark(userId, post_id);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    // --- KẾT THÚC BƯỚC B ---

    // --- BƯỚC C: Block catch ngoài ---
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
