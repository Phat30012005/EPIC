// supabase/functions/create-post/index.ts
// PHIÊN BẢN V4 (Sửa lỗi 'BUCKET_NAME' và lỗi logic 'highlights')

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer"; // Thêm thư viện decode

// (SỬA LỖI 1: Thêm định nghĩa BUCKET_NAME)
const BUCKET_NAME = "post-images";

// === BEGIN: Hàm Helper Lấy Auth ===
function getUserIdFromJwt(req: Request): string | null {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.warn("Local dev: No auth header found.");
      return null;
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      console.warn("Local dev: No token found in header.");
      return null;
    }
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch (error) {
    console.error("Local dev: Error parsing JWT:", error.message);
    return null;
  }
}
// === END: Hàm Helper Lấy Auth ===

// === BEGIN: Các hàm Helper Response (Giữ nguyên) ===
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

console.log("Create Post Function (V4 - Đã sửa lỗi) Initialized");

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
    // 3. Lấy User ID (Phần đã sửa lỗi V3)
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (context && context.auth) {
      console.log("Production context detected. Using context.auth.getUser()");
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
      userId = getUserIdFromJwt(req);
      if (!userId) {
        return createErrorResponse(
          "Unauthorized: Invalid token (local dev)",
          401
        );
      }
      // Lấy email (vì check local không có email)
      const { data: authData, error: authError } =
        await serviceRoleClient.auth.admin.getUserById(userId);
      if (authError) throw authError;
      userEmail = authData.user.email;
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

    // (SỬA LỖI 2: Sửa logic 'highlights'
    // Dùng 'get' (lấy 1 chuỗi) và 'JSON.parse' (giải mã chuỗi)
    const highlightsString = formData.get("highlights") as string;
    let highlightsArray: string[] = [];
    try {
      if (highlightsString) {
        highlightsArray = JSON.parse(highlightsString);
      }
    } catch (e) {
      console.error("Lỗi parse highlights JSON:", e.message);
      // (Không cần dừng, chỉ cần báo lỗi và tiếp tục với mảng rỗng)
    }

    const newPost = {
      title: formData.get("title") as string,
      motelName: formData.get("motelName") as string, // (Khớp CSDL V5)
      price: Number(formData.get("price")),
      area: Number(formData.get("area")),
      rooms: Number(formData.get("rooms")),
      ward: formData.get("ward") as string,
      address_detail: formData.get("address_detail") as string, // (Khớp CSDL V5)
      description: formData.get("description") as string,
      highlights: highlightsArray, // (Đã sửa)
      room_type: formData.get("room_type") as string,
      contactName: formData.get("contactName") as string, // (Khớp CSDL V5)
      phone: formData.get("phone") as string, // (Khớp CSDL V5)
      email: formData.get("email") as string, // (Khớp CSDL V5)
      user_id: userId,
      image_urls: [] as string[], // (Khớp CSDL V5)
    };

    // 5. Upload ảnh lên Storage (dùng Service Role)
    const uploadedImagePaths: string[] = [];
    const publicImageUrls: string[] = [];

    for (const image of images) {
      const timestamp = Date.now();
      const imagePath = `public/${userId}/${timestamp}-${image.name}`;
      uploadedImagePaths.push(imagePath);

      const { error: uploadError } = await serviceRoleClient.storage
        .from(BUCKET_NAME) // (Sử dụng biến đã định nghĩa)
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

      // (SỬA LỖI 1 - 'kong:8000')
      const localSupabaseUrl =
        Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
      const publicUrl = `${localSupabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`;

      console.log(`[create-post] Generated Public URL: ${publicUrl}`);
      publicImageUrls.push(publicUrl);
    }

    // 6. Thêm URL ảnh vào đối tượng bài đăng
    newPost.image_urls = publicImageUrls;

    // 7. Chèn bài đăng vào Database
    // (Sử dụng serviceRoleClient để chèn vì JS dùng key có dấu "")
    const { data: postData, error: dbError } = await serviceRoleClient
      .from("posts")
      .insert(newPost)
      .select()
      .single(); // Lấy bản ghi vừa tạo

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
