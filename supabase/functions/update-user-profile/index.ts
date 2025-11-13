// supabase/functions/update-user-profile/index.ts
// PHIÊN BẢN V2 (Sửa triệt để lỗi 500 - Chỉ nhận JSON)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";
// === BEGIN: Hàm Helper Lấy Auth ===
Deno.serve(async (req, context) => {
  // Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS", // Chỉ cho phép POST
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  let userId;
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Lấy User ID (từ logic vá local)
    try {
      throw new Error("Force fallback to token parsing");
    } catch (e) {
      console.log(
        "update-user-profile: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // 2. (SỬA LỖI) Nhận JSON thay vì FormData
    const { full_name, phone_number } = await req.json();

    // 3. Chuẩn bị dữ liệu để update CSDL (bảng profiles)
    // (Khớp 100% với CSDL V5)
    const profileToUpdate = {
      full_name: full_name,
      phone_number: phone_number,
    };

    // 4. Update CSDL (bảng profiles)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileToUpdate)
      .eq("id", userId)
      .select()
      .single();

    if (profileError) {
      throw new Error(`Profile DB Error: ${profileError.message}`);
    }

    // 5. Thành công, trả về profile đã update
    return new Response(JSON.stringify(profileData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error in update-user-profile function:", error);
    let status = 500;
    if (error.message.includes("not authenticated")) status = 401;
    // Lỗi 'Body is unusable' (nếu gửi sai JSON)
    if (error.message.includes("Body")) status = 400;
    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
