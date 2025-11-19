// supabase/functions/posts-api/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const BUCKET_NAME = "post-images";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper: Tạo phản hồi lỗi
const createErrorResponse = (message: string, status: number) => {
  console.error(`[posts-api] Error ${status}: ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

// Helper: Tạo phản hồi thành công
const createSuccessResponse = (data: any) => {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Khởi tạo Supabase Client (Admin quyền cao nhất để xử lý Storage/DB)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);

    // ============================================================
    // LOGIC GET: LẤY DANH SÁCH BÀI ĐĂNG (Từ get-posts-list cũ)
    // ============================================================
    if (req.method === "GET") {
      // Lấy bộ lọc từ URL
      const filters = {
        ward: url.searchParams.get("ward"),
        type: url.searchParams.get("type"),
        price: url.searchParams.get("price"),
        size: url.searchParams.get("size"),
        page: url.searchParams.get("page"),
        limit: url.searchParams.get("limit"),
      };

      let query = supabase.from("posts").select(
        `
          id:post_id, post_id, title, motelName, price, area, 
          image_urls, address_detail, ward, room_type, 
          created_at, status, reviews:reviews ( rating )
        `,
        { count: "exact" }
      );

      // Chỉ lấy tin đã duyệt
      query = query.eq("status", "APPROVED");

      // Áp dụng bộ lọc
      if (filters.ward) query = query.ilike("ward", `%${filters.ward}%`);
      if (filters.type) query = query.eq("room_type", filters.type);

      if (filters.price) {
        if (filters.price === "tren6") {
          query = query.gte("price", 6000000);
        } else {
          const parts = filters.price.split("-").map(Number);
          if (parts.length === 2) {
            query = query
              .gte("price", parts[0] * 1000000)
              .lte("price", parts[1] * 1000000);
          }
        }
      }

      if (filters.size) {
        if (filters.size === "tren35") {
          query = query.gte("area", 35);
        } else {
          const parts = filters.size.split("-").map(Number);
          if (parts.length === 2) {
            query = query.gte("area", parts[0]).lte("area", parts[1]);
          }
        }
      }

      // Phân trang
      query = query.order("created_at", { ascending: false });
      const page = filters.page ? parseInt(filters.page) : 1;
      const limit = filters.limit ? parseInt(filters.limit) : 12;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Tính điểm đánh giá trung bình
      const postsWithAvgRating = data?.map((post: any) => {
        let totalRating = 0;
        const reviewsCount = Array.isArray(post.reviews)
          ? post.reviews.length
          : 0;
        if (reviewsCount > 0) {
          post.reviews.forEach((review: any) => {
            totalRating += review.rating;
          });
          post.average_rating = (totalRating / reviewsCount).toFixed(1);
        } else {
          post.average_rating = "N/A";
        }
        delete post.reviews;
        return post;
      });

      return createSuccessResponse({
        data: postsWithAvgRating,
        pagination: {
          page,
          limit,
          total_records: count,
          total_pages: count ? Math.ceil(count / limit) : 0,
        },
      });
    }

    // ============================================================
    // LOGIC POST: TẠO BÀI ĐĂNG MỚI (Từ create-post cũ)
    // ============================================================
    if (req.method === "POST") {
      // 1. Xác thực User
      let userId: string;
      try {
        if (context && context.auth) {
          const {
            data: { user },
            error,
          } = await context.auth.getUser();
          if (error || !user) throw new Error("User not found");
          userId = user.id;
        } else {
          userId = await getUserIdFromToken(req);
        }
      } catch (e: any) {
        return createErrorResponse("Authentication failed: " + e.message, 401);
      }

      // 2. Parse FormData
      let formData;
      try {
        formData = await req.formData();
      } catch (e) {
        return createErrorResponse("Invalid FormData", 400);
      }

      const title = formData.get("title") as string;
      const price = formData.get("price");

      if (!title || !price) {
        return createErrorResponse(
          "Missing required fields (title, price)",
          400
        );
      }

      // 3. Upload ảnh
      const images = formData.getAll("images") as File[];
      const publicImageUrls: string[] = [];

      // Lưu ý: Khi deploy thật, đổi dòng này thành Deno.env.get("SUPABASE_URL")
      // Nhưng để chạy local ổn định, ta dùng URL local chuẩn:
      const publicSupabaseUrl = "http://127.0.0.1:54321";

      for (const image of images) {
        if (image.size > 0) {
          const timestamp = Date.now();
          const safeName = image.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const imagePath = `public/${userId}/${timestamp}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(imagePath, image, { cacheControl: "3600", upsert: false });

          if (uploadError) {
            console.error("Upload failed:", uploadError);
            continue;
          }

          const publicUrl = `${publicSupabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`;
          publicImageUrls.push(publicUrl);
        }
      }

      // 4. Parse Highlights
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
        status: "APPROVED", // Auto approve để test
      };

      const { data, error: dbError } = await supabase
        .from("posts")
        .insert(newPost)
        .select()
        .single();

      if (dbError)
        return createErrorResponse(
          "Database Insert Error: " + dbError.message,
          500
        );

      return createSuccessResponse(data);
    }

    // ============================================================
    // LOGIC DELETE: XÓA BÀI ĐĂNG (Từ delete-post cũ)
    // ============================================================
    if (req.method === "DELETE") {
      // 1. Xác thực User
      let userId: string;
      try {
        if (context && context.auth) {
          const {
            data: { user },
            error,
          } = await context.auth.getUser();
          if (error || !user) throw new Error("User not found");
          userId = user.id;
        } else {
          userId = await getUserIdFromToken(req);
        }
      } catch (e: any) {
        return createErrorResponse("Authentication failed: " + e.message, 401);
      }

      const postId = url.searchParams.get("id");
      if (!postId) return createErrorResponse("Missing 'id' parameter", 400);

      // 2. Kiểm tra quyền sở hữu hoặc Admin
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("user_id, image_urls")
        .eq("post_id", postId)
        .single();

      if (postError || !post) return createErrorResponse("Post not found", 404);

      // Lấy role user hiện tại
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const isAdmin = profile?.role === "ADMIN";
      const isOwner = post.user_id === userId;

      if (!isOwner && !isAdmin) {
        return createErrorResponse("Permission denied", 403);
      }

      // 3. Xóa ảnh trong Storage (Dọn dẹp)
      if (post.image_urls && post.image_urls.length > 0) {
        const filePaths = post.image_urls
          .map((url: string) => {
            try {
              const urlObj = new URL(url);
              const pathSegments = urlObj.pathname.split(`/${BUCKET_NAME}/`);
              return pathSegments.length > 1 ? pathSegments[1] : null;
            } catch {
              return null;
            }
          })
          .filter((p): p is string => p !== null);

        if (filePaths.length > 0) {
          await supabase.storage.from(BUCKET_NAME).remove(filePaths);
        }
      }

      // 4. Xóa Database
      const { error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("post_id", postId);

      if (deleteError) return createErrorResponse(deleteError.message, 500);

      return createSuccessResponse({ id: postId, status: "deleted" });
    }

    return createErrorResponse("Method Not Allowed", 405);
  } catch (err: any) {
    return createErrorResponse("Internal Server Error: " + err.message, 500);
  }
});
