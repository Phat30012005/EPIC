// public/js/main.js
// ĐÃ CẬP NHẬT LOGIC ĐỂ KIỂM TRA NHIỀU EMAIL ADMIN

// ===========================================
// 🛠️ HÀM TIỆN ÍCH CHUNG (Giữ nguyên)
// ===========================================
window.showAlert = function (message) {
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
        <div class="modal-content app-card p-6">
            <p class="text-lg font-semibold mb-4">${message}</p>
            <button onclick="this.closest('.modal-overlay').remove()" 
                    class="btn btn-primary px-4 py-2">Đóng</button>
        </div>
    `;
  document.body.appendChild(modalOverlay);
};

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

  document.getElementById("confirm-yes").onclick = () => {
    onConfirm();
    modalOverlay.remove();
  };
  document.getElementById("confirm-no").onclick = () => {
    modalOverlay.remove();
  };
};

window.setupNavigation = function () {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    const linkPath = link.getAttribute("href").split("/").pop() || "index.html";
    link.classList.remove("!text-[#007bff]");
    if (linkPath === path) {
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
    
    // 1. Hàm tải component (Giữ nguyên)
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
                    if (callback) callback(); // ⭐️ GỌI CALLBACK SAU KHI CHÈN HTML
                }
            })
            .catch((error) => console.error(`Lỗi tải component: ${error}`));
    };

    // 2. Tải Header VÀ CHẠY LOGIC AUTH
    loadComponent("/public/header.html", "header-placeholder", () => {
        // Callback này chạy SAU KHI header.html đã được chèn vào DOM
        
        // 2.1. Cập nhật link active
        setupNavigation();

        // 2.2. Xử lý trạng thái Đăng nhập/Đăng xuất
        const loginButton = document.getElementById('login-button');
        const adminLink = document.getElementById('admin-link');

        if (!loginButton || !adminLink) { // Cập nhật kiểm tra
            console.error('Không tìm thấy #login-button hoặc #admin-link trong header.html');
            return;
        }

        // === DANH SÁCH ADMIN EMAILS ===
        // Thêm tất cả các email admin của bạn vào mảng (array) này
        const ADMIN_EMAILS = [
            "phat30012005@gmail.com",
            "lethanhvy102005@gmail.com",
            "maib2308257@student.ctu.edu.vn",
            "ngab2308259@student.ctu.edu.vn",
            "tamb2308270@student.ctu.edu.vn"
        ];
        // === KẾT THÚC DANH SÁCH ===

        supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" || session) {
                // 1. Trường hợp: ĐÃ ĐĂNG NHẬP
                console.log('Người dùng đã đăng nhập:', session.user.email);
                
                loginButton.textContent = '🚪 Đăng xuất';
                loginButton.href = '#';
                loginButton.classList.remove('btn-primary');
                loginButton.classList.add('btn-outline-danger');

                // Thêm sự kiện click để Đăng xuất
                loginButton.onclick = async (e) => {
                    e.preventDefault();
                    const { error } = await supabase.auth.signOut();
                    if (error) {
                        console.error('Lỗi đăng xuất:', error);
                    } else {
                        // Đăng xuất thành công, tải lại trang
                        window.location.reload();
                    }
                };

                // === Kiểm tra email có nằm TRONG DANH SÁCH admin không ===
                if (ADMIN_EMAILS.includes(session.user.email)) {
                    // Nếu ĐÚNG là admin, hiện nút
                    adminLink.style.display = 'list-item'; 
                } else {
                    // Nếu KHÔNG phải admin, ẩn nút
                    adminLink.style.display = 'none';
                }
                // === KẾT THÚC KIỂM TRA ===

            } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
                // 2. Trường hợp: ĐÃ ĐĂNG XUẤT (hoặc chưa từng đăng nhập)
                console.log('Người dùng đã đăng xuất hoặc chưa đăng nhập.');
                
                loginButton.textContent = '🔑 Đăng nhập';
                loginButton.href = '/public/login.html';
                loginButton.classList.remove('btn-outline-danger');
                loginButton.classList.add('btn-primary');
                loginButton.onclick = null; // Xóa sự kiện click đăng xuất

                // Ẩn nút Admin khi đăng xuất
                adminLink.style.display = 'none';
            }
        });
    });

    // 3. Tải Footer
    loadComponent("/public/footer.html", "footer-placeholder");

    // 4. Tải và kích hoạt Chatbox (Giữ nguyên)
    fetch("/public/chatbox.html")
        .then((res) => res.text())
        .then((html) => {
            document.body.insertAdjacentHTML("beforeend", html);
            if (typeof initializeChatbox === "function") {
                initializeChatbox();
            }
        });
});