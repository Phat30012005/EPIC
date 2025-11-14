// supabase/functions/remove-roommate-bookmark/index.ts
// (Clone từ remove-bookmark và SỬA LẠI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts"; // (SỬA) Dùng helper chuẩn

// (SỬA) Đổi tên hàm và tham số
async function removeRoommateBookmark(userId, posting_id) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // (SỬA) Dùng bảng và cột mới
  const { error } = await supabase
    .from("roommate_bookmarks") // <-- SỬA
    .delete()
    .eq("user_id", userId)
    .eq("posting_id", posting_id); // <-- SỬA

  if (error) {
    throw error;
  }
  return { message: "Roommate bookmark removed successfully" };
}

// Logic Deno.serve (giữ nguyên, chỉ SỬA tên biến)
Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS", // (Giống remove-bookmark)
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    let userId: string;
    // (SỬA) Dùng logic auth chuẩn
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

    // (SỬA) Đọc 'posting_id' từ URL (Giống hệt remove-bookmark)
    const url = new URL(req.url);
    const posting_id = url.searchParams.get("posting_id"); // <-- SỬA

    if (!posting_id) {
      throw new Error("Missing 'posting_id' parameter");
    }

    // (SỬA) Gọi hàm logic mới
    const data = await removeRoommateBookmark(userId, posting_id);

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in remove-roommate-bookmark function:", error);
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
