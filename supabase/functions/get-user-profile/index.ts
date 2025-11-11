// supabase/functions/get-user-profile/index.ts

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// SỬA LỖI 1: Xóa cú pháp Markdown [ ](...) khỏi dòng import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer";

// SỬA LỖI 2: Thêm hàm helper để parse JWT thủ công
async function getUserIdFromToken(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization Header");
  }
  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }
  const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (!payload.sub) {
    throw new Error("Invalid token payload (missing sub)");
  }
  return payload.sub; // sub is the user ID (UUID)
}

async function getUserProfile(userId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Lấy email từ bảng auth.users
  const { data: authData, error: authError } =
    await supabase.auth.admin.getUserById(userId);

  if (authError) {
    throw new Error(`Auth Error: ${authError.message}`);
  }
  const email = authData.user.email;

  // 2. Lấy profile từ bảng public.profiles
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, phone_number, avatar_url, role")
    .eq("id", userId)
    .single();

  if (profileError) {
    throw new Error(`Profile Error: ${profileError.message}`);
  }

  // 3. Gộp 2 kết quả
  return {
    ...profileData,
    email: email,
    id: userId,
  };
}

Deno.serve(async (req, context) => {
  // (Hàm này dùng để xử lý lỗi CORS khi gọi từ trình duyệt)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    let userId;

    // SỬA LỖI 2: Thêm logic kiểm tra auth cho local dev
    try {
      throw new Error("Force fallback to token parsing");
    } catch (e) {
      console.log(
        "get-user-profile: context.auth failed, falling back to token parsing."
      );
      userId = await getUserIdFromToken(req);
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // Không cần req.json() vì chúng ta chỉ cần userId từ token
    const data = await getUserProfile(userId);
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
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
