// supabase/functions/delete-roommate-posting/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    let userId: string;

    // --- BƯỚC A: Block Xác thực CHUẨN ---
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

    // --- BƯỚC B: Logic Cốt Lõi ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // KIỂM TRA DOMINO: Lấy ID tin cần xóa từ URL (DELETE request)
    const url = new URL(req.url);
    const postingId = url.searchParams.get("id");
    if (!postingId) {
      throw new Error("Missing 'id' parameter for the posting.");
    }

    // KIỂM TRA DOMINO: Lấy vai trò của user (để check Admin)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw new Error("Could not find user profile.");
    }
    const userRole = profile.role;
    const isAdmin = userRole === "ADMIN";

    // Lấy thông tin tin đăng để kiểm tra chủ sở hữu
    const { data: posting, error: postError } = await supabaseAdmin
      .from("roommate_postings")
      .select("user_id")
      .eq("posting_id", postingId)
      .single();

    if (postError) {
      if (postError.code === "PGRST116") {
        return new Response(JSON.stringify({ error: "Posting not found" }), {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      throw new Error(`Post query error: ${postError.message}`);
    }

    // Logic bảo mật: Phải là chủ sở hữu HOẶC admin
    const isOwner = posting.user_id === userId;

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({
          error: "You do not have permission to delete this posting.",
        }),
        {
          status: 403, // Forbidden
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Thực hiện xóa
    const { error: deleteError } = await supabaseAdmin
      .from("roommate_postings")
      .delete()
      .eq("posting_id", postingId);

    if (deleteError) {
      throw new Error(`Database delete error: ${deleteError.message}`);
    }

    // Trả về thành công
    return new Response(
      JSON.stringify({ data: { id: postingId, status: "deleted" } }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        status: 200,
      }
    );

    // --- BƯỚC C: Block catch ngoài ---
  } catch (error) {
    console.error("Error in delete-roommate-posting function:", error);
    let status = 500;
    if (error.message.includes("not authenticated")) status = 401;
    if (error.message.includes("Missing 'id'")) status = 400;

    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
