// public/js/main.js
// === PHIÊN BẢN ĐẦY ĐỦ (V_FINAL) ===
// (Đã cập nhật logic theo yêu cầu mới)

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
      e.preventDefault();
      const query = searchInput.value.trim();

      if (query) {
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
    setupNavigation();
    setupSearchForm();

    // (SỬA) Lấy các element ID mới
    const loginButton = document.getElementById("login-button");
    const adminLink = document.getElementById("admin-link");
    const profileLinkLi = document.getElementById("profile-link");
    const lessorPostLink = document.getElementById("lessor-post-link"); // "Đăng tin" (chủ trọ)
    const renterPostLink = document.getElementById("renter-post-link"); // "Đăng tin tìm ở ghép" (người thuê)

    const profileLinkA = profileLinkLi
      ? profileLinkLi.querySelector("a")
      : null;

    if (
      !loginButton ||
      !adminLink ||
      !profileLinkA ||
      !lessorPostLink ||
      !renterPostLink
    ) {
      console.error(
        "Lỗi DOM: Không tìm thấy một trong các element điều hướng (login, admin, profile, lessor-post, renter-post)"
      );
      return;
    }

    // (SỬA) Cập nhật onAuthStateChange
    supabase.auth.onAuthStateChange(async (event, session) => {
      // Thêm async
      if (event === "SIGNED_IN" || session) {
        // 1. Xử lý giao diện Đăng nhập/Đăng xuất
        loginButton.textContent = "🚪 Đăng xuất";
        loginButton.href = "#";
        loginButton.classList.remove("btn-primary");
        loginButton.classList.add("btn-outline-danger");
        loginButton.onclick = async (e) => {
          e.preventDefault();
          await supabase.auth.signOut();
          window.location.reload();
        };

        // 2. LẤY ROLE MỚI NHẤT TỪ DATABASE (Thay vì lấy từ session cũ)
        let role = session.user.user_metadata.role; // Mặc định lấy từ session
        try {
          // Gọi API để lấy role chính xác nhất từ bảng profiles
          const { data: profile } = await callEdgeFunction("get-user-profile", {
            method: "GET",
          });
          if (profile && profile.role) {
            role = profile.role;
            console.log("Role thực tế từ DB:", role);
          }
        } catch (err) {
          console.error("Lỗi kiểm tra role:", err);
        }

        // 3. Phân quyền Menu
        if (role === "LESSOR") {
          profileLinkA.href = "/public/profile-lessor.html";
          renterPostLink.style.display = "none";
          lessorPostLink.style.display = "list-item";
        } else {
          profileLinkA.href = "/public/profile-renter.html";
          renterPostLink.style.display = "list-item";
          lessorPostLink.style.display = "none";
        }

        profileLinkLi.style.display = "list-item";

        // Hiển thị menu Admin nếu đúng quyền
        if (role === "ADMIN") {
          adminLink.style.display = "list-item";
        } else {
          adminLink.style.display = "none";
        }

        setupNavigation();
      } else if (
        event === "SIGNED_OUT" ||
        (event === "INITIAL_SESSION" && !session)
      ) {
        // ... (Giữ nguyên logic đăng xuất cũ) ...
        loginButton.textContent = "🔑 Đăng nhập";
        loginButton.href = "/public/login.html";
        loginButton.classList.remove("btn-outline-danger");
        loginButton.classList.add("btn-primary");
        loginButton.onclick = null;

        adminLink.style.display = "none";
        profileLinkLi.style.display = "none";
        renterPostLink.style.display = "none";
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
