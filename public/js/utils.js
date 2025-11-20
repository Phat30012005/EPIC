// public/js/utils.js
// BỘ CÔNG CỤ TIỆN ÍCH DÙNG CHUNG (GLOBAL UTILS)

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
   * Dùng cho các thẻ card hiển thị giá ngắn gọn
   */
  formatCurrencyShort: (amount) => {
    if (!amount && amount !== 0) return "0";
    if (amount >= 1000000) {
      // Chia cho 1 triệu, lấy 1 số thập phân, xóa .0 nếu tròn
      return (amount / 1000000).toFixed(1).replace(/\.0$/, "") + " triệu";
    }
    return Utils.formatCurrency(amount) + " đ"; // Nhỏ hơn 1 triệu thì hiện đầy đủ
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
   * @param {number} rating - Số sao (1-5)
   * @param {string} size - Kích thước font (vd: "1rem")
   */
  renderStars: (rating, size = "1rem") => {
    let starsHtml = "";
    for (let i = 1; i <= 5; i++) {
      const color = i <= rating ? "#f59e0b" : "#d1d5db"; // Vàng (active) hoặc Xám (inactive)
      // Dùng thẻ span thay vì icon font để nhẹ hơn nếu cần, hoặc giữ nguyên logic của bạn
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

  setText: (elementId, text) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = text;
    } else {
      console.warn(`[Utils] Không tìm thấy element: ${elementId}`);
    }
  },
};

// Thông báo file đã load
console.log("✅ Utils loaded");
/**
   * 6. Tối ưu hóa đường dẫn ảnh Supabase
   * Chuyển đổi URL từ /object/public/ sang /render/image/public/ để resize ảnh
   * @param {string} url - URL ảnh gốc
   * @param {number} width - Chiều rộng mong muốn (mặc định 400px cho thumbnail)
   */
  getOptimizedImage: (url, width = 400) => {
    if (!url) return "/assets/logo2.jpg"; // Ảnh mặc định nếu không có URL
    
    // Kiểm tra xem có phải ảnh từ Supabase Storage không
    if (url.includes("/storage/v1/object/public/")) {
      // Thay thế /object/ bằng /render/image/ để kích hoạt tính năng resize
      let newUrl = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      // Thêm tham số resize
      return `${newUrl}?width=${width}&resize=cover&quality=80`;
    }
    
    return url; // Nếu là ảnh nguồn khác thì giữ nguyên
  },
