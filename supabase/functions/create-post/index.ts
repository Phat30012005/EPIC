// supabase/functions/create-post/index.ts
// PHIÊN BẢN V6 (Tự động APPROVED để test + Sửa lỗi URL ảnh)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const BUCKET_NAME = "post-images";

// === Các hàm Helper ===
const createErrorResponse = (message: string, statusCode: number) => {
  return new Response(JSON.stringify({ error: message }), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Fix CORS
    },
  });
};
const createSuccessResponse = (data: any) => {
  return new Response(JSON.stringify({ data: data }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Fix CORS
    },
  });
};

console.log("Function create-post (V6 - Auto Approve) Initialized");

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 2. Khởi tạo Supabase Admin Client
    const serviceRoleClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. Xác thực User
    let userId: string;
    try {
      // Ưu tiên lấy từ context (Production)
      if (context && context.auth) {
        const {
          data: { user },
          error,
        } = await context.auth.getUser();
        if (error || !user) throw new Error("User not found");
        userId = user.id;
      } else {
        // Fallback cho Local (no-verify-jwt)
        userId = await getUserIdFromToken(req);
      }
    } catch (e) {
      return createErrorResponse("Authentication failed: " + e.message, 401);
    }

    // 4. Parse FormData
    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      return createErrorResponse("Invalid FormData", 400);
    }

    const title = formData.get("title") as string;
    const price = formData.get("price");

    if (!title || !price) {
      return createErrorResponse("Missing required fields (title, price)", 400);
    }

    // 5. Upload ảnh và Tạo URL
    const images = formData.getAll("images") as File[];
    const publicImageUrls: string[] = [];

    // [QUAN TRỌNG] Cấu hình URL chuẩn cho Local
    // Khi deploy thật, bạn sẽ đổi dòng này thành Deno.env.get("SUPABASE_URL")
    const publicSupabaseUrl = "http://127.0.0.1:54321";

    for (const image of images) {
      if (image.size > 0) {
        const timestamp = Date.now();
        // Đặt tên file đơn giản để tránh lỗi ký tự đặc biệt
        const safeName = image.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const imagePath = `public/${userId}/${timestamp}-${safeName}`;

        const { error: uploadError } = await serviceRoleClient.storage
          .from(BUCKET_NAME)
          .upload(imagePath, image, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload failed:", uploadError);
          continue; // Bỏ qua ảnh lỗi, tiếp tục ảnh khác
        }

        // Tạo URL public chuẩn
        const publicUrl = `${publicSupabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`;
        publicImageUrls.push(publicUrl);
      }
    }

    // 6. Chuẩn bị dữ liệu lưu DB
    const highlightsString = formData.get("highlights") as string;
    let highlightsArray: string[] = [];
    try {
      if (highlightsString) highlightsArray = JSON.parse(highlightsString);
    } catch {}

    const newPost = {
      user_id: userId,
      title: title,
      motelName: formData.get("motelName") as string,
      price: Number(price),
      area: Number(formData.get("area")),
      rooms: Number(formData.get("rooms")),
      ward: formData.get("ward") as string,
      address_detail: formData.get("address_detail") as string,
      description: formData.get("description") as string,
      room_type: formData.get("room_type") as string,
      highlights: highlightsArray,
      image_urls: publicImageUrls,

      // [QUAN TRỌNG] Set luôn là APPROVED để hiện ngay lập tức
      status: "APPROVED",
    };

    // 7. Insert vào DB
    const { data, error: dbError } = await serviceRoleClient
      .from("posts")
      .insert(newPost)
      .select()
      .single();

    if (dbError) {
      return createErrorResponse(
        "Database Insert Error: " + dbError.message,
        500
      );
    }

    return createSuccessResponse(data);
  } catch (err) {
    return createErrorResponse("Server Error: " + err.message, 500);
  }
});
