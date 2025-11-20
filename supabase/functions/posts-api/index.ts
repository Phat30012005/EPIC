// supabase/functions/posts-api/index.ts
// (PHIÊN BẢN V3 - THÊM DUYỆT TIN PATCH & PENDING DEFAULT)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const BUCKET_NAME = "post-images";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS", // Thêm PATCH
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const createErrorResponse = (message: string, status: number) => {
  console.error(`[posts-api] Error ${status}: ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

const createSuccessResponse = (data: any) => {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const url = new URL(req.url);

    // ---------------------------------------------------------
    // 1. GET (Lấy danh sách hoặc Chi tiết)
    // ---------------------------------------------------------
    if (req.method === "GET") {
      const id = url.searchParams.get("id");

      if (id) {
        // Lấy chi tiết
        const { data, error } = await supabase
          .from("posts")
          .select(`*, profiles:user_id (full_name, phone_number, email)`)
          .eq("post_id", id)
          .single();
        if (error) return createErrorResponse(error.message, 404);
        return createSuccessResponse(data);
      }

      // Lấy danh sách
      const filters = {
        ward: url.searchParams.get("ward"),
        type: url.searchParams.get("type"),
        price: url.searchParams.get("price"),
        size: url.searchParams.get("size"),
        page: url.searchParams.get("page"),
        limit: url.searchParams.get("limit"),
        status: url.searchParams.get("status"),
        user_id: url.searchParams.get("user_id"),
      };

      let query = supabase
        .from("posts")
        .select(
          `id:post_id, post_id, title, motelName, price, area, image_urls, address_detail, ward, room_type, created_at, status, reviews:reviews(rating)`,
          { count: "exact" }
        );

      // Logic lọc Status:
      // Nếu có filter status (thường dùng cho Admin) thì lấy theo status đó
      // Nếu không (User thường), mặc định chỉ lấy APPROVED
      if (filters.status) {
        query = query.eq("status", filters.status);
      } else {
        query = query.eq("status", "APPROVED");
      }
      if (filters.user_id) {
        query = query.eq("user_id", filters.user_id);
      }
      if (filters.ward) query = query.ilike("ward", `%${filters.ward}%`);
      if (
        filters.type &&
        filters.type !== "undefined" &&
        filters.type.trim() !== ""
      ) {
        query = query.ilike("room_type", filters.type.trim());
      }

      if (filters.price) {
        if (filters.price === "tren6") query = query.gte("price", 6000000);
        else {
          const parts = filters.price.split("-").map(Number);
          if (parts.length === 2)
            query = query
              .gte("price", parts[0] * 1000000)
              .lte("price", parts[1] * 1000000);
        }
      }
      if (filters.size) {
        if (filters.size === "tren35") query = query.gte("area", 35);
        else {
          const parts = filters.size.split("-").map(Number);
          if (parts.length === 2)
            query = query.gte("area", parts[0]).lte("area", parts[1]);
        }
      }

      query = query.order("created_at", { ascending: false });
      const page = filters.page ? parseInt(filters.page) : 1;
      const limit = filters.limit ? parseInt(filters.limit) : 12;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Tính rating trung bình
      const postsWithAvgRating = data?.map((post: any) => {
        let totalRating = 0;
        const reviewsCount = Array.isArray(post.reviews)
          ? post.reviews.length
          : 0;
        if (reviewsCount > 0) {
          post.reviews.forEach((r: any) => (totalRating += r.rating));
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

    // ---------------------------------------------------------
    // 2. POST (Tạo bài đăng)
    // ---------------------------------------------------------
    if (req.method === "POST") {
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
        return createErrorResponse("Auth failed: " + e.message, 401);
      }

      let formData;
      try {
        formData = await req.formData();
      } catch {
        return createErrorResponse("Invalid FormData", 400);
      }

      const title = formData.get("title") as string;
      const price = formData.get("price");
      if (!title || !price)
        return createErrorResponse("Missing title/price", 400);

      const images = formData.getAll("images") as File[];
      const publicImageUrls: string[] = [];
      const publicSupabaseUrl = "http://127.0.0.1:54321"; // Local URL

      for (const image of images) {
        if (image.size > 0) {
          const timestamp = Date.now();
          const safeName = image.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const imagePath = `public/${userId}/${timestamp}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(imagePath, image, { upsert: false });
          if (!upErr)
            publicImageUrls.push(
              `${publicSupabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`
            );
        }
      }

      const highlightsString = formData.get("highlights") as string;
      let highlightsArray: string[] = [];
      try {
        if (highlightsString) highlightsArray = JSON.parse(highlightsString);
      } catch {}

      const newPost = {
        user_id: userId,
        title,
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

        // === [UPDATE QUAN TRỌNG] ===
        // Đổi thành PENDING để chờ Admin duyệt
        status: "PENDING",
      };

      const { data, error } = await supabase
        .from("posts")
        .insert(newPost)
        .select()
        .single();
      if (error) return createErrorResponse(error.message, 500);
      return createSuccessResponse(data);
    }

    // ---------------------------------------------------------
    // 3. PATCH (Cập nhật trạng thái - Chỉ Admin)
    // ---------------------------------------------------------
    if (req.method === "PATCH") {
      // Xác thực User
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
        return createErrorResponse("Auth failed", 401);
      }

      // Kiểm tra quyền Admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role !== "ADMIN") {
        return createErrorResponse(
          "Forbidden: Only Admin can update status",
          403
        );
      }

      // Lấy dữ liệu body
      const { id, status } = await req.json();
      if (!id || !status)
        return createErrorResponse("Missing id or status", 400);
      if (!["APPROVED", "REJECTED", "PENDING"].includes(status))
        return createErrorResponse("Invalid status", 400);

      // Update Database
      const { data, error } = await supabase
        .from("posts")
        .update({ status: status })
        .eq("post_id", id)
        .select()
        .single();

      if (error) return createErrorResponse(error.message, 500);
      return createSuccessResponse(data);
    }

    // ---------------------------------------------------------
    // 4. DELETE (Xóa tin)
    // ---------------------------------------------------------
    if (req.method === "DELETE") {
      // (Logic giữ nguyên như cũ)
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
        return createErrorResponse("Auth failed", 401);
      }

      const postId = url.searchParams.get("id");
      if (!postId) return createErrorResponse("Missing id", 400);

      const { data: post, error: pError } = await supabase
        .from("posts")
        .select("user_id, image_urls")
        .eq("post_id", postId)
        .single();
      if (pError || !post) return createErrorResponse("Post not found", 404);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (post.user_id !== userId && profile?.role !== "ADMIN")
        return createErrorResponse("Forbidden", 403);

      if (post.image_urls?.length) {
        const files = post.image_urls
          .map((u: string) => {
            try {
              return new URL(u).pathname.split(`/${BUCKET_NAME}/`)[1] || null;
            } catch {
              return null;
            }
          })
          .filter((p: string | null) => p);
        if (files.length)
          await supabase.storage.from(BUCKET_NAME).remove(files as string[]);
      }

      const { error: dError } = await supabase
        .from("posts")
        .delete()
        .eq("post_id", postId);
      if (dError) return createErrorResponse(dError.message, 500);
      return createSuccessResponse({ id: postId, status: "deleted" });
    }

    return createErrorResponse("Method Not Allowed", 405);
  } catch (err: any) {
    return createErrorResponse("Internal Server Error: " + err.message, 500);
  }
});
