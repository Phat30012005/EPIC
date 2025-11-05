/* =======================================
   --- FILE: js/main.js ---
   (Đã tích hợp các hàm tiện ích chung)
   ======================================= */

// ===========================================
// 🛠️ HÀM TIỆN ÍCH CHUNG (GLOBAL UTILITIES)
// ===========================================

/**
 * Hiển thị thông báo nổi bật (modal/pop-up) với giao diện đồng bộ.
 * (Sử dụng các class CSS đã định nghĩa trong style.css)
 */
window.showAlert = function (message) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay"; // Cần định nghĩa style cho modal-overlay trong CSS
  modalOverlay.innerHTML = `
        <div class="modal-content app-card p-6">
            <p class="text-lg font-semibold mb-4">${message}</p>
            <button onclick="this.closest('.modal-overlay').remove()" 
                    class="btn btn-primary px-4 py-2">Đóng</button>
        </div>
    `;
  document.body.appendChild(modalOverlay);
};

/**
 * Hiển thị hộp thoại xác nhận (modal/pop-up) với giao diện đồng bộ.
 * (Sử dụng các class CSS đã định nghĩa trong style.css)
 */
window.showConfirm = function (message, onConfirm) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content app-card p-6">
            <p class="text-lg font-semibold mb-4">${message}</p>
            <div class="flex justify-center space-x-4">
                <button id="confirm-yes" class="btn btn-primary bg-danger border-danger px-4 py-2">Đồng ý</button>
                <button id="confirm-no" class="btn btn-outline-secondary px-4 py-2">Hủy</button>
            </div>
        </div>
    `;
  document.body.appendChild(modalOverlay);

  // Xử lý sự kiện click
  document.getElementById("confirm-yes").onclick = () => {
    onConfirm();
    modalOverlay.remove();
  };
  document.getElementById("confirm-no").onclick = () => {
    modalOverlay.remove();
  };
};

/**
 * Thiết lập trạng thái active cho các liên kết điều hướng dựa trên URL hiện tại.
 */
window.setupNavigation = function () {
  // Lấy tên file hiện tại (ví dụ: dangtin.html)
  const path = window.location.pathname.split("/").pop() || "index.html";

  // Tìm tất cả các liên kết có class nav-link (được load từ header.html)
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    const linkPath = link.getAttribute("href").split("/").pop() || "index.html";

    // Xóa trạng thái active cũ
    link.classList.remove("!text-[#007bff]");

    // So sánh path và thêm trạng thái active mới
    if (linkPath === path) {
      // Sử dụng màu primary đã định nghĩa trong style.css
      link.classList.add("text-primary");
    } else {
      link.classList.remove("text-primary");
    }
  });
};

// ===========================================
// 🚀 LOGIC KHỞI ĐỘNG CHÍNH
// ===========================================

document.addEventListener("DOMContentLoaded", function () {
  // 1. Hàm tải component
  const loadComponent = (url, placeholderId, callback) => {
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Không thể tải ${url}`);
        return response.text();
      })
      .then((data) => {
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
          placeholder.outerHTML = data; // Thay thế placeholder
          if (callback) callback();
        }
      })
      .catch((error) => console.error(`Lỗi tải component: ${error}`));
  };

  // 2. Tải Header và Footer
  // Gọi setupNavigation sau khi header đã được tải và chèn vào DOM
  loadComponent("header.html", "header-placeholder", setupNavigation);
  loadComponent("footer.html", "footer-placeholder");

  // 3. Tải và kích hoạt Chatbox
  fetch("chatbox.html")
    .then((res) => res.text())
    .then((html) => {
      document.body.insertAdjacentHTML("beforeend", html);
      // Hàm initializeChatbox() được định nghĩa trong file chatbox.js
      if (typeof initializeChatbox === "function") {
        initializeChatbox();
      }
    });

  // 4. Gọi setupNavigation lần đầu (nếu header không load từ file ngoài)
  // Nếu header load rất nhanh, gọi lần nữa để đảm bảo trạng thái active
  // setupNavigation();
});
