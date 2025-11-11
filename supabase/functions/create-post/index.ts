// supabase/functions/create-post/index.ts
// PHIÊN BẢN HOÀN CHỈNH (CÓ VALIDATION & UPLOAD ẢNH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hàm tiện ích tạo lỗi (giữ nguyên)
function createErrorResponse(message: string, status: number) {
  console.error(`[create-post] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

const BUCKET_NAME = "post-images";
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_IMAGE_COUNT = 10;
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg", // (Một số trình duyệt dùng 'image/jpg')
];

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. === BẢO MẬT: LẤY USER ===
    const {
      data: { user },
      error: authError,
    } = await context.auth.getUser();

    if (authError) {
      return createErrorResponse("Chưa xác thực hoặc token không hợp lệ", 401);
    }
    console.log(`[create-post] Được gọi bởi user: ${user.email}`);

    // 3. === XỬ LÝ FORMDATA ===
    const formData = await req.formData();

    // 4. === VALIDATION (XÁC THỰC) DỮ LIỆU TEXT ===
    // (Lấy dữ liệu từ FormData)
    const title = formData.get("title") as string;
    const motelName = formData.get("motelName") as string;
    const priceRaw = Number(formData.get("price"));
    const areaRaw = Number(formData.get("area"));
    const roomsRaw = Number(formData.get("rooms"));
    const ward = formData.get("ward") as string;
    const address = formData.get("address") as string;
    const description = formData.get("description") as string;
    const roomType = formData.get("room_type") as string;
    const contactName = formData.get("contactName") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;

    // (Parse mảng 'highlights' từ chuỗi JSON)
    let highlights: string[] = [];
    try {
      highlights = JSON.parse((formData.get("highlights") as string) || "[]");
      if (!Array.isArray(highlights)) highlights = [];
    } catch (e) {
      console.warn("Lỗi parse highlights, dùng mảng rỗng:", e.message);
      highlights = [];
    }

    // (Kiểm tra các trường bắt buộc)
    if (
      !title ||
      !motelName ||
      !ward ||
      !address ||
      !description ||
      !roomType ||
      !contactName ||
      !phone ||
      !email
    ) {
      return createErrorResponse("Thiếu thông tin văn bản bắt buộc", 400);
    }
    if (isNaN(priceRaw) || priceRaw <= 0) {
      return createErrorResponse("Giá (price) không hợp lệ", 400);
    }
    if (isNaN(areaRaw) || areaRaw <= 0) {
      return createErrorResponse("Diện tích (area) không hợp lệ", 400);
    }
    if (isNaN(roomsRaw) || roomsRaw <= 0) {
      return createErrorResponse("Số phòng (rooms) không hợp lệ", 400);
    }

    // 5. === VALIDATION (XÁC THỰC) DỮ LIỆU FILE (ẢNH) ===
    const images = formData.getAll("images") as File[];

    if (images.length === 0) {
      return createErrorResponse("Cần ít nhất một ảnh", 400);
    }
    if (images.length > MAX_IMAGE_COUNT) {
      return createErrorResponse(
        `Chỉ được đăng tối đa ${MAX_IMAGE_COUNT} ảnh`,
        400
      );
    }

    // (Kiểm tra từng file)
    for (const file of images) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return createErrorResponse(
          `File '${file.name}' có định dạng không hợp lệ (${file.type})`,
          400
        );
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return createErrorResponse(
          `File '${file.name}' quá lớn (tối đa ${MAX_FILE_SIZE_MB}MB)`,
          400
        );
      }
    }

    // 6. === UPLOAD ẢNH LÊN STORAGE ===
    // (Khởi tạo Admin Client - Bắt buộc dùng Admin để upload)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const uploadPromises = images.map((file) => {
      // Tạo đường dẫn file duy nhất
      // Định dạng: public/[user_id]/[random_uuid]-[tên_file]
      const filePath = `public/${user.id}/${crypto.randomUUID()}-${file.name}`;

      return supabaseAdmin.storage.from(BUCKET_NAME).upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600", // Cache 1 giờ
      });
    });

    // (Chờ tất cả upload hoàn tất song song)
    const uploadResults = await Promise.all(uploadPromises);

    // (Kiểm tra lỗi upload)
    const failedUploads = uploadResults.filter((r) => r.error);
    if (failedUploads.length > 0) {
      console.error("Lỗi upload Storage:", failedUploads[0].error);
      return createErrorResponse(
        `Lỗi khi upload ảnh: ${failedUploads[0].error.message}`,
        500
      );
    }

    // (Lấy URL public của các ảnh đã upload)
    const imageUrls = uploadResults.map((r) => {
      return supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(r.data.path)
        .data.publicUrl;
    });

    // 7. === LƯU BÀI ĐĂNG VÀO CSDL ===
    const postData = {
      user_id: user.id, // ID của người đăng
      title: title,
      motelName: motelName,
      price: priceRaw,
      area: areaRaw,
      rooms: roomsRaw,
      ward: ward,
      address: address,
      description: description,
      room_type: roomType,
      contactName: contactName,
      phone: phone,
      email: email,
      highlights: highlights,
      image_url: imageUrls, // Mảng các URL public
    };

    const { data: newPost, error: insertError } = await supabaseAdmin
      .from("posts")
      .insert(postData)
      .select()
      .single();

    if (insertError) {
      console.error("Lỗi insert CSDL:", insertError);
      // (Nếu lỗi, phải XÓA các ảnh vừa upload để dọn dẹp)
      const filePathsToDelete = uploadResults.map((r) => r.data.path);
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(filePathsToDelete);

      return createErrorResponse(`Lỗi lưu CSDL: ${insertError.message}`, 500);
    }

    // 8. === TRẢ VỀ THÀNH CÔNG ===
    console.log(`[create-post] Đăng tin thành công: ${newPost.id}`);
    return new Response(JSON.stringify({ data: newPost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // 200 OK (hoặc 201 Created đều được)
    });
  } catch (err) {
    // (Bắt các lỗi chung, ví dụ: req.formData() thất bại)
    return createErrorResponse(err.message, 500);
  }
});
