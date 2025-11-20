// supabase/functions/update-user-profile/index.ts
// (PHIÊN BẢN V2 - HỖ TRỢ UPLOAD AVATAR)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Xác thực User
    let userId: string;
    try {
      if (context && context.auth) {
        const {
          data: { user },
        } = await context.auth.getUser();
        userId = user?.id || "";
      } else {
        userId = await getUserIdFromToken(req);
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    if (!userId) throw new Error("User not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Xử lý FormData (File + Text)
    const formData = await req.formData();
    const fullName = formData.get("full_name") as string;
    const phoneNumber = formData.get("phone_number") as string;
    const avatarFile = formData.get("avatar") as File | null;

    const updates: any = {
      full_name: fullName,
      phone_number: phoneNumber,
      updated_at: new Date(),
    };

    // 3. Upload Avatar (Nếu có)
    // 3. Upload Avatar (Nếu có)
    if (avatarFile && avatarFile.size > 0) {
      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `${userId}/avatar.${fileExt}`; // Luôn ghi đè file cũ

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Lấy URL public gốc từ Supabase
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // === [FIX LỖI KONG:8000] ===
      // Khi chạy local, Supabase trả về URL nội bộ docker (kong:8000)
      // Trình duyệt không hiểu 'kong', nên ta phải đổi thành localhost (127.0.0.1:54321)
      // Lấy URL public gốc
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      let finalUrl = publicUrl;

      // Chỉ sửa lỗi kong nếu đang chạy Local (khi URL chứa 'kong')
      // Khi lên Cloud, URL sẽ là 'supabase.co' nên dòng này sẽ tự động bị bỏ qua -> Đúng logic
      if (finalUrl.includes("kong:8000")) {
        finalUrl = finalUrl.replace(
          "http://kong:8000/",
          "http://127.0.0.1:54321"
        );
      }
      // ===========================

      // Thêm timestamp để tránh cache trình duyệt
      updates.avatar_url = `${finalUrl}?t=${Date.now()}`;
    }
    // 4. Update Database
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
