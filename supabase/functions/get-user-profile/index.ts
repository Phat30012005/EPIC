// supabase/functions/get-user-profile/index.ts
// (PHIÊN BẢN ĐÃ CHUẨN HÓA LOGIC AUTH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

// (Hàm logic `getUserProfile` giữ nguyên)
async function getUserProfile(userId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(userId);
  if (authError) {
    throw new Error(`Auth Error: ${authError.message}`);
  }
  const email = authData.user.email;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, phone_number, avatar_url, role")
    .eq("id", userId)
    .single();
  if (profileError) {
    throw new Error(`Profile Error: ${profileError.message}`);
  }
  return {
    ...profileData,
    email: email,
    id: userId,
  };
}

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        // SỬA LỖI LOGIC: Hàm "get" phải cho phép "GET" (khớp với frontend)
        "Access-Control-Allow-Methods": "GET, OPTIONS",
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
    // (Đây là hàm GET, không cần req.json())
    const data = await getUserProfile(userId);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
    // --- KẾT THÚC BƯỚC B ---

    // --- BƯỚC C: Block catch ngoài ---
  } catch (error) {
    console.error("Error in get-user-profile function:", error);
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
