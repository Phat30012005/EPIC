// supabase/functions/create-post/index.ts
// PHIÊN BẢN V5 (Sửa triệt để lỗi 'kong:8000')

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";
const BUCKET_NAME = "post-images";

// === BEGIN: Hàm Helper Lấy Auth ===

// === END: Hàm Helper Lấy Auth ===

// === BEGIN: Các hàm Helper Response ===
const createErrorResponse = (message: string, statusCode: number) => {
  return new Response(JSON.stringify({ error: message }), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      Connection: "keep-alive",
    },
  });
};
const createSuccessResponse = (data: any) => {
  return new Response(JSON.stringify({ data: data }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      Connection: "keep-alive",
    },
  });
};
// === END: Các hàm Helper Response ===

console.log("Create Post Function (V5 - Sửa lỗi kong:8000) Initialized");

Deno.serve(async (req, context) => {
  // 1. Khởi tạo Supabase client
  const serviceRoleClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 2. Xử lý CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    // 3. Lấy User ID
    let userId: string | null = null;
    let userEmail: string | null = null;

    // Lấy URL cơ sở và loại bỏ dấu '/' ở cuối (nếu có)
    const BASE_URL = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";

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
        userEmail = user.email;
      } else {
        console.warn(
          "Local dev context detected. Falling back to manual JWT parsing."
        );
        // 1. Dùng hàm CHUẨN (sẽ throw nếu lỗi)
        userId = await getUserIdFromToken(req);

        // 2. Lấy email (logic này vẫn cần)
        const { data: authData, error: authError } =
          await serviceRoleClient.auth.admin.getUserById(userId);
        if (authError) throw authError;
        userEmail = authData.user.email;
      }
    } catch (authError) {
      // 3. Bắt lỗi (từ getUserIdFromToken hoặc getUserById)
      // Đây là cách 7 function kia đang làm, bây giờ create-post cũng làm vậy
      console.error("Authentication error:", authError.message);
      return createErrorResponse(
        authError.message || "User authentication failed",
        401
      );
    }

    // Câu lệnh này bây giờ an toàn vì đã qua try...catch
    if (!userId) {
      // Dòng này về lý thuyết không bao giờ chạy, nhưng để an toàn
      return createErrorResponse("User authentication failed", 401);
    }

    if (!userId) {
      return createErrorResponse("User authentication failed", 401);
    }

    // 4. Xử lý FormData
    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      return createErrorResponse(`Failed to parse FormData: ${e.message}`, 400);
    }

    const images = formData.getAll("images") as File[];
    if (images.length === 0 || images.some((img) => img.size === 0)) {
      return createErrorResponse("No images or invalid images provided.", 400);
    }

    // Xử lý 'highlights' (V4)
    const highlightsString = formData.get("highlights") as string;
    let highlightsArray: string[] = [];
    try {
      if (highlightsString) {
        highlightsArray = JSON.parse(highlightsString);
      }
    } catch (e) {
      console.error("Lỗi parse highlights JSON:", e.message);
    }

    const newPost = {
      title: formData.get("title") as string,
      motelName: formData.get("motelName") as string,
      price: Number(formData.get("price")),
      area: Number(formData.get("area")),
      rooms: Number(formData.get("rooms")),
      ward: formData.get("ward") as string,
      address_detail: formData.get("address_detail") as string,
      description: formData.get("description") as string,
      highlights: highlightsArray,
      room_type: formData.get("room_type") as string,
      user_id: userId,
      image_urls: [] as string[],
    };

    // 5. Upload ảnh lên Storage
    const uploadedImagePaths: string[] = [];
    const publicImageUrls: string[] = [];

    for (const image of images) {
      const timestamp = Date.now();
      const imagePath = `public/${userId}/${timestamp}-${image.name}`;
      uploadedImagePaths.push(imagePath);

      const { error: uploadError } = await serviceRoleClient.storage
        .from(BUCKET_NAME)
        .upload(imagePath, image, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        if (uploadedImagePaths.length > 0) {
          await serviceRoleClient.storage
            .from(BUCKET_NAME)
            .remove(uploadedImagePaths);
        }
        return createErrorResponse(
          `Failed to upload image: ${uploadError.message}`,
          500
        );
      }

      // (SỬA LỖI TRIỆT ĐỂ 'kong:8000' V5)
      // Sử dụng BASE_URL động để đảm bảo hoạt động trên cả Local và Production
      const publicUrl = `${BASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`;

      console.log(`[create-post] Generated Public URL (V5 Fix): ${publicUrl}`);
      publicImageUrls.push(publicUrl);
    }

    // 6. Thêm URL ảnh vào đối tượng bài đăng
    newPost.image_urls = publicImageUrls;

    // 7. Chèn bài đăng vào Database
    const { data: postData, error: dbError } = await serviceRoleClient
      .from("posts")
      .insert(newPost)
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      await serviceRoleClient.storage
        .from(BUCKET_NAME)
        .remove(uploadedImagePaths);
      return createErrorResponse(
        `Failed to create post in DB: ${dbError.message}`,
        500
      );
    }

    // 8. THÀNH CÔNG
    return createSuccessResponse(postData);
  } catch (error) {
    console.error("Critical error in create-post function:", error);
    return createErrorResponse(
      error.message || "An unexpected error occurred",
      500
    );
  }
});
