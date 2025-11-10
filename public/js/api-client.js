/**
 * Tệp: public/js/api-client.js
 * (ĐÃ NÂNG CẤP ĐỂ HỖ TRỢ CẢ JSON VÀ FORMDATA - VAI TRÒ CỦA TÂM)
 *
 * Hàm này là "cầu nối" duy nhất giữa Frontend và Backend (Edge Functions)
 * Nó sẽ tự động đính kèm token xác thực của user vào mỗi yêu cầu.
 */

/**
 * Gọi một Edge Function của Supabase một cách an toàn.
 *
 * @param {string} functionName - Tên của function (ví dụ: 'create-post').
 * @param {object} options - Các tùy chọn.
 * @param {string} [options.method='POST'] - Phương thức HTTP (GET, POST, PUT, DELETE).
 * @param {object|FormData} [options.body=null] - Dữ liệu gửi đi.
 * - Nếu là Object, nó sẽ được 'JSON.stringify'.
 * - Nếu là FormData, nó sẽ được gửi nguyên mẫu.
 * @param {object} [options.params=null] - Các tham số query (ví dụ: { id: 1, type: 'a' })
 */
async function callEdgeFunction(
  functionName,
  { method = "POST", body = null, params = null } = {}
) {
  console.log(`[API Client] Đang gọi: ${functionName}`);

  // 1. Lấy session (chứa token) hiện tại của user
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Lỗi lấy session khi gọi function:", sessionError);
    return { data: null, error: sessionError };
  }

  // 2. Kiểm tra token cho các function cần (trừ các function public)
  const publicFunctions = [
    "get-posts-list",
    "get-post-detail",
    "user-login",
    "user-signup",
  ];
  if (!publicFunctions.includes(functionName) && !session) {
    console.error(
      `[API Client] Bị chặn: Function ${functionName} yêu cầu đăng nhập.`
    );
    // Trả về một lỗi chuẩn
    const authError = new Error(
      "Bạn cần đăng nhập để thực hiện hành động này."
    );
    authError.name = "AuthError";
    return { data: null, error: authError };
  }

  // 3. Xây dựng URL
  let functionUrl = `${supabase.functions.url}/${functionName}`;

  // Thêm query params nếu có
  if (params) {
    const urlParams = new URLSearchParams(Object.entries(params));
    functionUrl += `?${urlParams.toString()}`;
  }

  // 4. Chuẩn bị các tùy chọn cho Fetch
  const optionsFetch = {
    method: method,
    headers: {
      // KHÔNG set 'Content-Type' ở đây vội
    },
  };

  // 5. Gắn Token (nếu có)
  if (session) {
    optionsFetch.headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  // 6. === LOGIC QUAN TRỌNG: XỬ LÝ BODY ===
  if (body) {
    if (body instanceof FormData) {
      // A. Nếu là FormData:
      // KHÔNG set 'Content-Type'. Trình duyệt sẽ tự động làm
      // (bao gồm cả 'boundary'
      //
      // Bỏ: optionsFetch.headers['Content-Type'] = 'multipart/form-data';
      optionsFetch.body = body;
    } else {
      // B. Nếu là JSON (mặc định):
      // Set 'Content-Type' và stringify nó
      optionsFetch.headers["Content-Type"] = "application/json";
      optionsFetch.body = JSON.stringify(body);
    }
  }

  try {
    // 7. Thực hiện lệnh gọi
    const response = await fetch(functionUrl, optionsFetch);

    // 8. Xử lý phản hồi
    // Lấy dữ liệu JSON từ phản hồi (ngay cả khi là lỗi)
    const responseData = await response.json();

    if (!response.ok) {
      // Nếu server trả về lỗi (401, 400, 500)
      // 'responseData.error' là lỗi do function trả về
      const errorMsg = responseData.error || `Lỗi ${response.status}`;
      console.error(`[API Client] Lỗi từ Function ${functionName}:`, errorMsg);
      throw new Error(errorMsg);
    }

    // 9. Trả về thành công
    // Function của chúng ta trả về { data: ... }
    return { data: responseData.data || responseData, error: null };
  } catch (error) {
    // Bắt lỗi (lỗi mạng, lỗi parse JSON, hoặc lỗi ở 'throw' trên)
    console.error(`[API Client] Lỗi khi fetch ${functionName}:`, error);
    return { data: null, error: error };
  }
}
