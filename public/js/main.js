// public/js/main.js
// ĐÃ CẬP NHẬT LOGIC ĐỂ ĐIỀU HƯỚNG HỒ SƠ THEO VAI TRÒ

// ... (Giữ nguyên các hàm tiện ích showAlert, showConfirm, setupNavigation) ...
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
                    placeholder.outerHTML = data; 
                    if (callback) callback(); 
                }
            })
            .catch((error) => console.error(`Lỗi tải component: ${error}`));
    };

    // 2. Tải Header VÀ CHẠY LOGIC AUTH
    loadComponent("/public/header.html", "header-placeholder", () => {
        // Callback này chạy SAU KHI header.html đã được chèn vào DOM
        
        setupNavigation();

        const loginButton = document.getElementById('login-button');
        const adminLink = document.getElementById('admin-link');
        
        // === SỬA ĐỔI: Lấy cả <li> và <a> của link hồ sơ ===
        const profileLinkLi = document.getElementById('profile-link'); 
        const profileLinkA = profileLinkLi ? profileLinkLi.querySelector('a') : null; 
        // === KẾT THÚC SỬA ĐỔI ===

        if (!loginButton || !adminLink || !profileLinkA) { 
            console.error('Không tìm thấy #login-button, #admin-link hoặc #profile-link a');
            return;
        }

        // Danh sách email admin (Giữ nguyên)
        const ADMIN_EMAILS = [
            "phat30012005@gmail.com",
            "lethanhvy102005@gmail.com",
            "maib2308257@student.ctu.edu.vn",
            "ngab2308259@student.ctu.edu.vn",
            "tamb2308270@student.ctu.edu.vn"
        ];

        supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" || session) {
                // 1. Trường hợp: ĐÃ ĐĂNG NHẬP
                loginButton.textContent = '🚪 Đăng xuất';
                loginButton.href = '#';
                loginButton.classList.remove('btn-primary');
                loginButton.classList.add('btn-outline-danger');
                loginButton.onclick = async (e) => {
                    e.preventDefault();
                    await supabase.auth.signOut();
                    window.location.reload();
                };

                // === SỬA ĐỔI: Điều hướng hồ sơ theo vai trò ===
                const role = session.user.user_metadata.role;
                if (role === 'LESSOR') {
                    profileLinkA.href = '/public/profile-lessor.html'; // Trang cho chủ trọ
                } else { // Mặc định là 'RENTER'
                    profileLinkA.href = '/public/profile-renter.html'; // Trang cho người thuê
                }
                profileLinkLi.style.display = 'list-item'; // Hiển thị <li>
                // === KẾT THÚC SỬA ĐỔI ===

                // Logic admin (Giữ nguyên)
                if (ADMIN_EMAILS.includes(session.user.email)) {
                    adminLink.style.display = 'list-item'; 
                } else {
                    adminLink.style.display = 'none';
                }

            } else if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
                // 2. Trường hợp: ĐÃ ĐĂNG XUẤT
                loginButton.textContent = '🔑 Đăng nhập';
                loginButton.href = '/public/login.html';
                loginButton.classList.remove('btn-outline-danger');
                loginButton.classList.add('btn-primary');
                loginButton.onclick = null; 

                // Ẩn cả hai link khi đã đăng xuất
                adminLink.style.display = 'none';
                profileLinkLi.style.display = 'none'; // Ẩn <li>
            }
        });
    });

    // 3. Tải Footer (Giữ nguyên)
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