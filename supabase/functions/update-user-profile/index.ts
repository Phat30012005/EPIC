// supabase/functions/update-user-profile/index.ts
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
  // SỬA: Trả về 204 No Content cho OPTIONS (Chuẩn hơn)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
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

    const formData = await req.formData();
    const fullName = formData.get("full_name") as string;
    const phoneNumber = formData.get("phone_number") as string;
    const avatarFile = formData.get("avatar") as File | null;

    const updates: any = {
      full_name: fullName,
      phone_number: phoneNumber,
      updated_at: new Date(),
    };

    if (avatarFile && avatarFile.size > 0) {
      const fileExt = avatarFile.name.split(".").pop();
      const filePath = `${userId}/avatar.${fileExt}`;

      // Nếu bucket 'avatars' chưa có trên Cloud -> Dòng này sẽ gây lỗi 500 -> CORS Error
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, avatarFile, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // Logic URL thông minh: Chỉ fix nếu là local
      let finalUrl = publicUrl;
      if (finalUrl.includes("kong:8000")) {
        finalUrl = finalUrl.replace(
          "http://kong:8000",
          "http://127.0.0.1:54321"
        );
      }

      updates.avatar_url = `${finalUrl}?t=${Date.now()}`;
    }

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
    console.error("Error:", error); // Log lỗi để xem trên Dashboard
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
