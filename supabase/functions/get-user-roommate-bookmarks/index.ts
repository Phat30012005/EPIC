// supabase/functions/get-user-roommate-bookmarks/index.ts
// (Clone từ get-user-bookmarks và SỬA LẠI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

// (SỬA) Đổi tên hàm
async function getUserRoommateBookmarks(userId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // (SỬA) Dùng bảng và JOIN mới
  const { data, error } = await supabase
    .from("roommate_bookmarks") // <-- SỬA
    .select(
      `
      bookmark_id,
      created_at,
      roommate_postings:posting_id (
        posting_id,
        title,
        price,
        ward 
      )
    ` // <-- SỬA
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // (SỬA) Logic xử lý JOIN
  const simplifiedBookmarks = data.map((bookmark) => {
    if (!bookmark.roommate_postings) {
      // <-- SỬA
      return { ...bookmark, posting: null }; // <-- SỬA
    }
    const posting = bookmark.roommate_postings; // <-- SỬA
    delete bookmark.roommate_postings; // <-- SỬA
    return { ...bookmark, posting: posting }; // <-- SỬA
  });

  const validBookmarks = simplifiedBookmarks.filter((b) => b.posting !== null); // <-- SỬA
  return validBookmarks;
}

// Logic Deno.serve (giữ nguyên, chỉ SỬA tên hàm)
Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
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

    // (SỬA) Gọi hàm logic mới
    const data = await getUserRoommateBookmarks(userId);

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in get-user-roommate-bookmarks function:", error);
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
