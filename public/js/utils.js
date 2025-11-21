/* =======================================
   --- FILE: public/js/utils.js ---
   (PHIÊN BẢN FINAL - ĐÃ CÓ getOptimizedImage)
   ======================================= */

const Utils = {
  /**
   * 1. Định dạng tiền tệ đầy đủ (VD: 1000000 -> "1.000.000")
   */
  formatCurrency: (amount) => {
    if (!amount && amount !== 0) return "0";
    return Number(amount).toLocaleString("vi-VN");
  },

  /**
   * 2. Định dạng tiền tệ rút gọn (VD: 1500000 -> "1.5 triệu")
   */
  formatCurrencyShort: (amount) => {
    if (!amount && amount !== 0) return "0";
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1).replace(/\.0$/, "") + " triệu";
    }
    return Utils.formatCurrency(amount) + " đ";
  },

  /**
   * 3. Định dạng ngày tháng (VD: "20/11/2023")
   */
  formatDate: (dateString) => {
    if (!dateString) return "Không rõ";
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? "Không rõ"
      : date.toLocaleDateString("vi-VN");
  },

  /**
   * 4. Render số sao đánh giá ra HTML
   */
  renderStars: (rating, size = "1rem") => {
    let starsHtml = "";
    for (let i = 1; i <= 5; i++) {
      const color = i <= rating ? "#f59e0b" : "#d1d5db";
      starsHtml += `<span style="color: ${color}; font-size: ${size}; margin-right: 2px;">★</span>`;
    }
    return starsHtml;
  },

  /**
   * 5. Hàm an toàn để lấy tham số từ URL
   */
  getParam: (paramName) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(paramName);
  },

  /**
   * 6. Hàm set text an toàn
   */
  setText: (elementId, text) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = text;
    } else {
      console.warn(`[Utils] Không tìm thấy element: ${elementId}`);
    }
  },

  /**
   * 7. Tối ưu hóa đường dẫn ảnh Supabase (MỚI THÊM)
   * Chuyển đổi URL từ /object/public/ sang /render/image/public/ để resize ảnh
   * @param {string} url - URL ảnh gốc
   * @param {number} width - Chiều rộng mong muốn
   */
  getOptimizedImage: (url, width = 400) => {
    if (!url) return "/assets/logo1.png";

    // Kiểm tra xem có phải ảnh từ Supabase Storage không
    if (url.includes("/storage/v1/object/public/")) {
      // Thay thế /object/ bằng /render/image/
      let newUrl = url.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
      // Thêm tham số resize
      return `${newUrl}?width=${width}&resize=cover&quality=80`;
    }

    return url;
  },
}; // <--- DẤU NGOẶC QUAN TRỌNG BẠN ĐÃ THIẾU

console.log("✅ Utils loaded");
