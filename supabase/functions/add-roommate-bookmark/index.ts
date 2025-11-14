// supabase/functions/add-roommate-bookmark/index.ts
// (Clone từ add-bookmark và SỬA LẠI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

// (SỬA) Đổi tên hàm và tham số
async function addRoommateBookmark(userId, posting_id) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // (SỬA) Dùng bảng và cột mới
  const { data: existing, error: checkError } = await supabase
    .from("roommate_bookmarks") // <-- SỬA
    .select("bookmark_id")
    .eq("user_id", userId)
    .eq("posting_id", posting_id) // <-- SỬA
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }
  if (existing) {
    return existing;
  }

  // (SỬA) Dùng bảng và cột mới
  const { data, error } = await supabase
    .from("roommate_bookmarks") // <-- SỬA
    .insert({
      user_id: userId,
      posting_id: posting_id, // <-- SỬA
    })
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

// Logic Deno.serve (giữ nguyên, chỉ SỬA tên biến)
Deno.serve(async (req, context) => {
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
    let userId: string;
    try {
      if (context && context.auth) {
        const {
          data: { user },
          error: authError,
        } = await context.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("User not found (from context)");
        userId = user.id;
      } else {
        userId = await getUserIdFromToken(req);
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

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // (SỬA) Nhận 'posting_id' từ frontend
    const { posting_id } = await req.json();
    if (!posting_id) {
      throw new Error("Missing posting_id");
    }

    // (SỬA) Gọi hàm logic mới
    const data = await addRoommateBookmark(userId, posting_id);

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in add-roommate-bookmark function:", error);
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
