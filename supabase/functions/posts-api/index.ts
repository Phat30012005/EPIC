// supabase/functions/posts-api/index.ts
// (PHIÊN BẢN BẢO MẬT V2: ĐÃ KIỂM TRA KỸ)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const BUCKET_NAME = "post-images";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- HÀM XỬ LÝ LỖI CHUẨN ---
// Giúp ẩn lỗi 500 chi tiết khỏi người dùng, chỉ hiện log ở server
const createErrorResponse = (
  message: string,
  status: number,
  originalError?: any
) => {
  if (originalError) {
    // Log lỗi gốc ra Dashboard của Supabase để Admin kiểm tra
    console.error(`[posts-api Error ${status}]:`, originalError);
  }

  // Nếu là lỗi 500 (Server), trả về thông báo chung chung để bảo mật
  // Nếu là lỗi 4xx (Client sai), trả về message cụ thể (ví dụ: "Thiếu tiêu đề")
  const clientMessage =
    status >= 500 ? "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." : message;

  return new Response(JSON.stringify({ error: clientMessage }), {
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
  // Xử lý CORS (Preflight)
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const url = new URL(req.url);

    // ============================================================
    // 1. GET: LẤY DANH SÁCH HOẶC CHI TIẾT
    // ============================================================
    if (req.method === "GET") {
      const id = url.searchParams.get("id");

      try {
        // A. Lấy chi tiết 1 bài đăng
        if (id) {
          // Validate ID: Phải là UUID
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(id)) {
            return createErrorResponse("ID bài đăng không hợp lệ.", 400);
          }

          const { data, error } = await supabase
            .from("posts")
            .select(
              `*, profiles:user_id (full_name, phone_number, email, avatar_url)`
            )
            .eq("post_id", id)
            .single();

          if (error)
            return createErrorResponse(
              "Không tìm thấy bài đăng hoặc bài đăng đã bị xóa.",
              404,
              error
            );
          return createSuccessResponse(data);
        }

        // B. Lấy danh sách (Lọc & Phân trang)
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

        // Tối ưu query: Chỉ select những cột cần thiết để hiển thị list
        let query = supabase
          .from("posts")
          .select(
            `id:post_id, post_id, user_id, title, motelName, price, area, image_urls, address_detail, ward, room_type, created_at, status, reviews:reviews(rating), profiles:user_id ( full_name, avatar_url )`,
            { count: "exact" }
          );

        // Mặc định chỉ lấy tin APPROVED (trừ khi có filter khác - dành cho Admin/Profile)
        if (filters.status) {
          query = query.eq("status", filters.status);
        } else {
          query = query.eq("status", "APPROVED");
        }

        if (filters.user_id) query = query.eq("user_id", filters.user_id);

        // Tìm kiếm tương đối (ILIKE) cho khu vực
        if (filters.ward) query = query.ilike("ward", `%${filters.ward}%`);

        if (
          filters.type &&
          filters.type !== "undefined" &&
          filters.type.trim() !== ""
        ) {
          query = query.ilike("room_type", filters.type.trim());
        }

        // Filter Giá (Validation input)
        if (filters.price) {
          if (filters.price === "tren6") query = query.gte("price", 6000000);
          else {
            const parts = filters.price.split("-").map(Number);
            // Chỉ query nếu parse ra đúng 2 số
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
              query = query
                .gte("price", parts[0] * 1000000)
                .lte("price", parts[1] * 1000000);
          }
        }

        // Filter Diện tích
        if (filters.size) {
          if (filters.size === "tren35") query = query.gte("area", 35);
          else {
            const parts = filters.size.split("-").map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
              query = query.gte("area", parts[0]).lte("area", parts[1]);
          }
        }

        query = query.order("created_at", { ascending: false });

        // Phân trang an toàn (Chống user nhập page=-1 hoặc limit=1000)
        let page = parseInt(filters.page || "1");
        let limit = parseInt(filters.limit || "12");
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1 || limit > 50) limit = 12; // Max 50 item/page

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        // Tính toán Rating trung bình (Frontend đỡ phải tính)
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
          delete post.reviews; // Xóa mảng reviews thô cho nhẹ response
          return post;
        });

        return createSuccessResponse({
          data: postsWithAvgRating,
          pagination: {
            page,
            limit,
            total_records: count || 0,
            total_pages: count ? Math.ceil(count / limit) : 0,
          },
        });
      } catch (err) {
        return createErrorResponse("Lỗi khi tải dữ liệu.", 500, err);
      }
    }

    // ============================================================
    // 2. POST: ĐĂNG TIN MỚI (VALIDATION QUAN TRỌNG)
    // ============================================================
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
        return createErrorResponse(
          "Bạn cần đăng nhập để thực hiện thao tác này.",
          401,
          e
        );
      }

      let formData;
      try {
        formData = await req.formData();
      } catch (e) {
        return createErrorResponse(
          "Dữ liệu gửi lên không đúng định dạng (FormData).",
          400,
          e
        );
      }

      // --- VALIDATION LAYER (KIỂM TRA DỮ LIỆU) ---
      const title = formData.get("title") as string;
      const priceStr = formData.get("price");
      const areaStr = formData.get("area");
      const roomsStr = formData.get("rooms");
      const motelName = formData.get("motelName") as string;
      const ward = formData.get("ward") as string;

      // Kiểm tra bắt buộc
      if (!title || title.trim().length < 5 || title.length > 150) {
        return createErrorResponse("Tiêu đề phải từ 5 đến 150 ký tự.", 400);
      }
      if (!motelName || motelName.trim().length === 0) {
        return createErrorResponse("Vui lòng nhập tên trọ.", 400);
      }
      if (!ward || ward.trim().length === 0) {
        return createErrorResponse("Vui lòng chọn Phường/Xã.", 400);
      }

      // Kiểm tra số
      const price = Number(priceStr);
      const area = Number(areaStr);
      const rooms = Number(roomsStr);

      if (isNaN(price) || price <= 0)
        return createErrorResponse("Giá phòng phải là số dương hợp lệ.", 400);
      if (isNaN(area) || area <= 0)
        return createErrorResponse("Diện tích phải là số dương hợp lệ.", 400);
      // Rooms có thể không nhập -> mặc định là 1
      const validRooms = isNaN(rooms) || rooms <= 0 ? 1 : rooms;

      // Xử lý ảnh (Giới hạn số lượng và dung lượng)
      const images = formData.getAll("images") as File[];
      if (images.length > 10)
        return createErrorResponse("Bạn chỉ được đăng tối đa 10 ảnh.", 400);

      const publicImageUrls: string[] = [];
      const publicSupabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

      for (const image of images) {
        // Check dung lượng server-side (phòng trường hợp bypass JS)
        if (image.size > 5 * 1024 * 1024) {
          return createErrorResponse(`Ảnh ${image.name} quá lớn (>5MB).`, 400);
        }
        if (image.size > 0) {
          const timestamp = Date.now();
          // Xử lý tên file: bỏ ký tự lạ
          const safeName = image.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const imagePath = `public/${userId}/${timestamp}-${safeName}`;

          const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(imagePath, image, { upsert: false });

          if (!upErr) {
            publicImageUrls.push(
              `${publicSupabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`
            );
          } else {
            console.error("Upload error:", upErr);
            // Lưu ý: Ở đây ta chọn cách bỏ qua ảnh lỗi và tiếp tục,
            // thay vì dừng toàn bộ quá trình.
          }
        }
      }

      // Parse highlights an toàn (tránh lỗi JSON.parse làm crash server)
      const highlightsString = formData.get("highlights") as string;
      let highlightsArray: string[] = [];
      try {
        if (highlightsString) highlightsArray = JSON.parse(highlightsString);
        if (!Array.isArray(highlightsArray)) highlightsArray = [];
      } catch {
        highlightsArray = [];
      }

      const newPost = {
        user_id: userId,
        title: title.trim(),
        motelName: motelName.trim(),
        price,
        area,
        rooms: validRooms,
        ward,
        address_detail: (
          (formData.get("address_detail") as string) || ""
        ).trim(),
        description: ((formData.get("description") as string) || "").trim(),
        room_type: (formData.get("room_type") as string) || "Phòng đơn",
        highlights: highlightsArray,
        image_urls: publicImageUrls,
        status: "PENDING", // Mặc định luôn là PENDING để duyệt
      };

      const { data, error } = await supabase
        .from("posts")
        .insert(newPost)
        .select()
        .single();

      if (error)
        return createErrorResponse(
          "Không thể lưu bài đăng vào cơ sở dữ liệu.",
          500,
          error
        );

      return createSuccessResponse(data);
    }

    // ============================================================
    // 3. PATCH & DELETE (Dành cho Admin hoặc Chính chủ)
    // ============================================================
    if (req.method === "PATCH") {
      // Chỉ Admin mới được duyệt tin
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
        return createErrorResponse("Unauthorized", 401, e);
      }

      // Check quyền Admin (Query DB)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role !== "ADMIN")
        return createErrorResponse(
          "Bạn không có quyền thực hiện (Admin only).",
          403
        );

      const { id, status } = await req.json();
      if (!id || !status)
        return createErrorResponse("Thiếu thông tin ID hoặc Status.", 400);

      const { data, error } = await supabase
        .from("posts")
        .update({ status })
        .eq("post_id", id)
        .select()
        .single();
      if (error)
        return createErrorResponse("Lỗi khi cập nhật trạng thái.", 500, error);
      return createSuccessResponse(data);
    }

    if (req.method === "DELETE") {
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
        return createErrorResponse("Unauthorized", 401, e);
      }

      const postId = url.searchParams.get("id");
      if (!postId) return createErrorResponse("Thiếu ID bài đăng.", 400);

      // Lấy thông tin bài viết để check chủ sở hữu
      const { data: post } = await supabase
        .from("posts")
        .select("user_id, image_urls")
        .eq("post_id", postId)
        .single();
      if (!post)
        return createErrorResponse("Không tìm thấy bài đăng cần xóa.", 404);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      // Logic: Chỉ cho phép xóa nếu là CHỦ BÀI ĐĂNG hoặc ADMIN
      if (post.user_id !== userId && profile?.role !== "ADMIN") {
        return createErrorResponse("Bạn không có quyền xóa bài đăng này.", 403);
      }

      // Xóa ảnh trên Storage trước để tiết kiệm dung lượng
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
      if (dError)
        return createErrorResponse("Lỗi khi xóa bài đăng.", 500, dError);

      return createSuccessResponse({ id: postId, status: "deleted" });
    }

    return createErrorResponse("Method Not Allowed", 405);
  } catch (err: any) {
    return createErrorResponse(
      "Lỗi máy chủ nội bộ (Internal Server Error).",
      500,
      err
    );
  }
});
