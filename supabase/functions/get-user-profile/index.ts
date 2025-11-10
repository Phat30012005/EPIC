// supabase/functions/get-user-profile/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hàm tạo phản hồi lỗi chuẩn
function createErrorResponse(message: string, status: number) {
  console.error(`[get-user-profile] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("[get-user-profile] Function đã sẵn sàng.");

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Khởi tạo Admin Client (an toàn ở backend)
  // Dùng Deno.env.get()
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // 3. Lấy thông tin user TỪ TOKEN
    // Đây là phần quan trọng nhất. Vì 'verify_jwt = true',
    // Supabase đã xác thực token và cung cấp 'context.auth.getUser()'
    const {
      data: { user },
      error: authError,
    } = await context.auth.getUser();

    if (authError) {
      return createErrorResponse(
        `Xác thực thất bại: ${authError.message}`,
        401
      );
    }

    if (!user) {
      return createErrorResponse(
        "Không tìm thấy user (token không hợp lệ?)",
        401
      );
    }

    // 4. Lấy thông tin profiles TỪ CSDL
    // Thông tin trong auth.user (metadata) có thể bị cũ.
    // Lấy thông tin mới nhất từ bảng 'profiles' là tốt nhất.
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("contactName, phone, role, email") // Chỉ lấy các trường cần thiết
      .eq("id", user.id) // Dùng user.id từ token
      .single();

    if (profileError) {
      // Lỗi này có thể xảy ra nếu Trigger 'handle_new_user' của bạn thất bại
      console.error("Lỗi khi query bảng profiles:", profileError.message);
      return createErrorResponse(
        "Không thể lấy thông tin profile từ CSDL.",
        500
      );
    }

    // 5. Trả về thành công
    // Chúng ta trả về thông tin từ bảng 'profiles'
    console.log(`[get-user-profile] Trả về profile cho: ${profileData.email}`);
    return new Response(JSON.stringify({ data: profileData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message || "Lỗi không xác định", 500);
  }
});
