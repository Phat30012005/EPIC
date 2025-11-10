// supabase/functions/update-user-profile/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hàm tạo phản hồi lỗi chuẩn
function createErrorResponse(message: string, status: number) {
  console.error(`[update-user-profile] Lỗi ${status}:`, message);
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

console.log("[update-user-profile] Function đã sẵn sàng.");

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Lấy user ID từ token (Bảo mật)
  const {
    data: { user },
    error: authError,
  } = await context.auth.getUser();

  if (authError) {
    return createErrorResponse(`Xác thực thất bại: ${authError.message}`, 401);
  }
  if (!user) {
    return createErrorResponse(
      "Không tìm thấy user (token không hợp lệ?)",
      401
    );
  }

  // 3. Lấy dữ liệu mới từ body
  let newName, newPhone;
  try {
    const body = await req.json();
    newName = body.contactName;
    newPhone = body.phone;
    if (!newName || !newPhone) {
      return createErrorResponse("Thiếu contactName hoặc phone", 400);
    }
  } catch (e) {
    return createErrorResponse(`Body không phải JSON: ${e.message}`, 400);
  }

  // 4. Khởi tạo Admin Client
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 5. Logic cập nhật (2 BƯỚC QUAN TRỌNG)
  try {
    // Bước 5.1: Cập nhật bảng 'auth.users' (user_metadata)
    // Dùng 'updateUserById' vì chúng ta đang dùng Admin Client
    const { data: authUpdateData, error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          contactName: newName,
          phone: newPhone,
          // Giữ lại role cũ (rất quan trọng)
          role: user.user_metadata.role,
        },
      });

    if (authUpdateError) {
      throw new Error(
        `Lỗi khi cập nhật auth.users: ${authUpdateError.message}`
      );
    }

    // Bước 5.2: Cập nhật bảng 'public.profiles'
    const { data: profileUpdateData, error: profileUpdateError } =
      await supabaseAdmin
        .from("profiles")
        .update({
          contactName: newName,
          phone: newPhone,
        })
        .eq("id", user.id) // Cập nhật hàng có ID khớp
        .select() // Trả về data đã cập nhật
        .single();

    if (profileUpdateError) {
      throw new Error(
        `Lỗi khi cập nhật public.profiles: ${profileUpdateError.message}`
      );
    }

    // 6. Trả về thành công
    console.log(`[update-user-profile] Cập nhật thành công cho: ${user.email}`);
    // Trả về dữ liệu profile mới nhất từ bảng 'profiles'
    return new Response(JSON.stringify({ data: profileUpdateData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message || "Lỗi không xác định", 500);
  }
});
