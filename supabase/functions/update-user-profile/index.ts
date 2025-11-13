// supabase/functions/update-user-profile/index.ts
// (PHIÊN BẢN ĐÃ CHUẨN HÓA LOGIC AUTH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

// (Không có hàm logic helper, logic nằm thẳng trong Deno.serve)

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
    // (Cần khởi tạo supabaseAdmin ở đây)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { full_name, phone_number } = await req.json();
    const profileToUpdate = {
      full_name: full_name,
      phone_number: phone_number,
    };
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileToUpdate)
      .eq("id", userId)
      .select()
      .single();
    if (profileError) {
      throw new Error(`Profile DB Error: ${profileError.message}`);
    }
    return new Response(JSON.stringify(profileData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    // --- KẾT THÚC BƯỚC B ---

    // --- BƯỚC C: Block catch ngoài ---
  } catch (error) {
    console.error("Error in update-user-profile function:", error);
    let status = 500;
    if (error.message.includes("not authenticated")) status = 401;
    if (error.message.includes("Body")) status = 400; // Lỗi parse JSON
    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
