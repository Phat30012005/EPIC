// supabase/functions/create-post/index.ts
// PHIÊN BẢN SỬA LỖI 500 (Internal Server Error) CHO LOCAL DEV

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// === BẮT ĐẦU PHẦN SỬA LỖI (V3) ===

// Hàm helper để parse JWT thủ công khi chạy local với --no-verify-jwt
// Vì khi đó context.auth sẽ bị undefined
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
    // Giải mã phần payload (thứ 2) của JWT
    const payload = JSON.parse(atob(token.split(".")[1]));
    // 'sub' (subject) chính là user ID
    return payload.sub || null;
  } catch (error) {
    console.error("Local dev: Error parsing JWT:", error.message);
    return null;
  }
}

// === KẾT THÚC PHẦN SỬA LỖI (V3) ===

// Hàm tạo phản hồi lỗi chuẩn
const createErrorResponse = (message: string, statusCode: number) => {
  return new Response(JSON.stringify({ error: message }), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      Connection: "keep-alive",
    },
  });
};

// Hàm tạo phản hồi thành công chuẩn
const createSuccessResponse = (data: any) => {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      Connection: "keep-alive",
    },
  });
};

console.log("Create Post Function Initialized");

Deno.serve(async (req) => {
  // 1. Khởi tạo Supabase client (cho cả Admin và Service)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

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

    // Lấy context.auth từ Supabase
    // @ts-ignore: Bỏ qua lỗi type vì Deno.serve không có context
    const { auth } = req.context || {};

    if (auth) {
      // Chạy trên Production (hoặc local nếu CÓ verify jwt)
      console.log("Production context detected. Using context.auth.getUser()");
      const {
        data: { user },
        error: authError,
      } = await auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("User not found (from context)");
      userId = user.id;
      userEmail = user.email;
    } else {
      // Chạy trên Local với --no-verify-jwt (context.auth bị undefined)
      console.warn(
        "Local dev context detected (context.auth is undefined). Falling back to manual JWT parsing."
      );
      userId = getUserIdFromJwt(req);
      if (!userId) {
        // Nếu không thể parse JWT, trả về lỗi 401 (như khi auth thất bại)
        return createErrorResponse(
          "Unauthorized: Invalid token (local dev)",
          401
        );
      }
      // Vì không có user object, chúng ta không thể lấy email từ token
      // (Token payload chỉ chứa userId ('sub'), không chứa email)
      // Chúng ta sẽ lấy email từ FormData sau
      console.log(`Local dev: Successfully parsed userId: ${userId}`);
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

    const newPost = {
      title: formData.get("title") as string,
      motelName: formData.get("motelName") as string,
      price: Number(formData.get("price")),
      area: Number(formData.get("area")),
      rooms: Number(formData.get("rooms")),
      ward: formData.get("ward") as string,
      address_detail: formData.get("address_detail") as string,
      description: formData.get("description") as string,
      highlights: formData.getAll("highlights") as string[],
      room_type: formData.get("room_type") as string,
      contactName: formData.get("contactName") as string,
      phone: formData.get("phone") as string,
      email: userEmail ?? (formData.get("email") as string), // Lấy email từ user nếu có, nếu không thì từ form
      user_id: userId,
      image_urls: [] as string[], // Sẽ được cập nhật sau khi upload
    };

    // 5. Upload ảnh lên Storage (dùng Service Role)
    const uploadedImagePaths: string[] = [];
    const publicImageUrls: string[] = [];

    for (const image of images) {
      const timestamp = Date.now();
      const imagePath = `public/${userId}/${timestamp}-${image.name}`;
      uploadedImagePaths.push(imagePath);

      const { error: uploadError } = await serviceRoleClient.storage
        .from("post-images")
        .upload(imagePath, image, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        // THẤT BẠI: Dọn dẹp những ảnh đã upload (nếu có)
        if (uploadedImagePaths.length > 0) {
          await serviceRoleClient.storage
            .from("post-images")
            .remove(uploadedImagePaths);
        }
        return createErrorResponse(
          `Failed to upload image: ${uploadError.message}`,
          500
        );
      }

      // Lấy URL public của ảnh
      const { data: publicUrlData } = serviceRoleClient.storage
        .from("post-images")
        .getPublicUrl(imagePath);

      if (!publicUrlData) {
        return createErrorResponse("Failed to get public URL for image", 500);
      }

      // (SỬA LỖI 'kong:8000'):
      // Tự xây dựng URL public-facing thay vì dùng URL nội bộ của Docker
      const localSupabaseUrl =
        Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
      const publicUrl = `${localSupabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`;

      publicImageUrls.push(publicUrl);
    }

    // 6. Thêm URL ảnh vào đối tượng bài đăng
    newPost.image_urls = publicImageUrls;

    // 7. Chèn bài đăng vào Database (dùng client của user)
    const { data: postData, error: dbError } = await supabase
      .from("posts")
      .insert(newPost)
      .select()
      .single(); // Lấy bản ghi vừa tạo

    if (dbError) {
      console.error("Database error:", dbError);
      // THẤT BẠI: Dọn dẹp ảnh đã upload (Rollback Storage)
      await serviceRoleClient.storage
        .from("post-images")
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
