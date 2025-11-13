// public/js/main.js
// === PHIÊN BẢN ĐẦY ĐỦ (V_FINAL) ===
// ĐÃ CẬP NHẬT ĐỂ PHÂN QUYỀN "ĐĂNG TIN" (LESSOR) vs "TÌM Ở GHÉP" (RENTER)

// --- Các hàm tiện ích (Giữ nguyên) ---
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

// --- Hàm active link (Giữ nguyên) ---
window.setupNavigation = function () {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const navLinks = document.querySelectorAll(".nav-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "#") {
      return;
    }
    const linkPath = href.split("/").pop() || "index.html";
    link.classList.remove("!text-[#007bff]");

    if (linkPath === path) {
      link.classList.add("text-primary");
    } else {
      link.classList.remove("text-primary");
    }
  });
};

// --- Hàm tìm kiếm (Giữ nguyên) ---
function setupSearchForm() {
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Ngăn form tải lại trang
      const query = searchInput.value.trim(); // Lấy từ khóa

      if (query) {
        // Nếu có từ khóa, chuyển hướng
        console.log(`Đang tìm kiếm: ${query}`);
        // Chuyển hướng đến trang danh sách VÀ đính kèm query
        window.location.href = `/public/danhsach.html?q=${encodeURIComponent(
          query
        )}`;
      }
    });
  }
}

// ===========================================
// 🚀 LOGIC KHỞI ĐỘNG CHÍNH (ĐÃ CẬP NHẬT)
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

  // 2. Tải Header VÀ CHẠY LOGIC AUTH (ĐÃ SỬA)
  loadComponent("/public/header.html", "header-placeholder", () => {
    // Callback này chạy SAU KHI header.html đã được chèn vào DOM

    setupNavigation();
    setupSearchForm(); // (Giữ nguyên)

    // (SỬA) Thêm 2 biến link mới
    const loginButton = document.getElementById("login-button");
    const adminLink = document.getElementById("admin-link");
    const profileLinkLi = document.getElementById("profile-link");
    const lessorPostLink = document.getElementById("lessor-post-link"); // <-- BIẾN MỚI
    const roommateLink = document.getElementById("roommate-link"); // <-- BIẾN MỚI

    const profileLinkA = profileLinkLi
      ? profileLinkLi.querySelector("a")
      : null;

    // (SỬA) Cập nhật kiểm tra lỗi
    if (
      !loginButton ||
      !adminLink ||
      !profileLinkA ||
      !lessorPostLink ||
      !roommateLink
    ) {
      console.error(
        "Lỗi DOM: Không tìm thấy một trong các element điều hướng quan trọng (login, admin, profile, lessor-post, roommate-link)"
      );
      return;
    }

    // (SỬA) Cập nhật onAuthStateChange
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || session) {
        // 1. Trường hợp: ĐÃ ĐĂNG NHẬP
        loginButton.textContent = "🚪 Đăng xuất";
        loginButton.href = "#";
        loginButton.classList.remove("btn-primary");
        loginButton.classList.add("btn-outline-danger");
        loginButton.onclick = async (e) => {
          e.preventDefault();
          await supabase.auth.signOut();
          window.location.reload();
        };

        const role = session.user.user_metadata.role;

        // === (SỬA) LOGIC PHÂN QUYỀN MỚI ===
        if (role === "LESSOR") {
          // 1. Cấu hình cho LESSOR (Chủ trọ)
          profileLinkA.href = "/public/profile-lessor.html";
          roommateLink.style.display = "none"; // Ẩn "Tìm ở ghép"
          lessorPostLink.style.display = "list-item"; // Hiện "Đăng tin"
        } else {
          // 2. Cấu hình cho RENTER (Người thuê)
          profileLinkA.href = "/public/profile-renter.html";
          roommateLink.style.display = "list-item"; // Hiện "Tìm ở ghép"
          lessorPostLink.style.display = "none"; // Ẩn "Đăng tin"
        }

        profileLinkLi.style.display = "list-item";

        // Logic Admin (giữ nguyên, độc lập)
        if (role === "ADMIN") {
          adminLink.style.display = "list-item";
        } else {
          adminLink.style.display = "none";
        }
        // === KẾT THÚC LOGIC MỚI ===

        setupNavigation(); // Chạy lại để active link
      } else if (
        event === "SIGNED_OUT" ||
        (event === "INITIAL_SESSION" && !session)
      ) {
        // 2. Trường hợp: ĐÃ ĐĂNG XUẤT
        loginButton.textContent = "🔑 Đăng nhập";
        loginButton.href = "/public/login.html";
        loginButton.classList.remove("btn-outline-danger");
        loginButton.classList.add("btn-primary");
        loginButton.onclick = null;

        // (SỬA) Ẩn tất cả các link động
        adminLink.style.display = "none";
        profileLinkLi.style.display = "none";
        roommateLink.style.display = "none";
        lessorPostLink.style.display = "none";

        setupNavigation();
      }
    });
  }); // Kết thúc loadComponent

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
