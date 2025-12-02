// public/js/main.js
// === PHIÊN BẢN ĐẦY ĐỦ (V_FINAL_FIXED) ===

// --- Các hàm tiện ích ---
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

// --- Hàm active link ---
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

// --- Hàm tìm kiếm ---
function setupSearchForm() {
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");

  if (searchForm && searchInput) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = searchInput.value.trim();

      if (query) {
        window.location.href = `/danhsach.html?q=${encodeURIComponent(query)}`;
      }
    });
  }
}

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
          placeholder.outerHTML = data;
          if (callback) callback();
        }
      })
      .catch((error) => console.error(`Lỗi tải component: ${error}`));
  };

  // 2. Tải Header VÀ CHẠY LOGIC AUTH
  loadComponent("/header.html", "header-placeholder", () => {
    setupNavigation();
    setupSearchForm();

    const loginButton = document.getElementById("login-button");
    const adminLink = document.getElementById("admin-link");
    const profileLinkLi = document.getElementById("profile-link");
    const lessorPostLink = document.getElementById("lessor-post-link");
    const renterPostLink = document.getElementById("renter-post-link");

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
      // Bỏ qua nếu không tìm thấy DOM (tránh lỗi trang login/signup)
      return;
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      const heroBtn = document.getElementById("hero-post-btn");

      if (event === "SIGNED_IN" || session) {
        // Logged In
        loginButton.textContent = "🚪 Đăng xuất";
        loginButton.href = "#";
        loginButton.classList.remove("btn-primary");
        loginButton.classList.add("btn-outline-danger");
        loginButton.onclick = async (e) => {
          e.preventDefault();
          await supabase.auth.signOut();
          window.location.reload();
        };

        // Check Role
        let role = session.user.user_metadata.role;
        try {
          // Gọi API để lấy role chính xác nhất
          const { data: profile } = await callEdgeFunction("get-user-profile", {
            method: "GET",
          });
          if (profile && profile.role) {
            role = profile.role;
          }
        } catch (err) {
          console.error("Lỗi kiểm tra role:", err);
        }

        // UI theo Role
        if (role === "LESSOR") {
          profileLinkA.href = "/profile-lessor.html";
          renterPostLink.style.display = "none";
          lessorPostLink.style.display = "list-item";
          if (heroBtn) {
            heroBtn.href = "/dangtin.html";
            heroBtn.style.display = "inline-block";
          }
        } else {
          profileLinkA.href = "/profile-renter.html";
          renterPostLink.style.display = "list-item";
          lessorPostLink.style.display = "none";
          if (heroBtn) {
            heroBtn.href = "/oghep-dangtin.html";
            heroBtn.style.display = "inline-block";
          }
        }

        profileLinkLi.style.display = "list-item";

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
        // Logged Out
        loginButton.textContent = "🔑 Đăng nhập";
        loginButton.href = "/login.html";
        loginButton.classList.remove("btn-outline-danger");
        loginButton.classList.add("btn-primary");
        loginButton.onclick = null;

        adminLink.style.display = "none";
        profileLinkLi.style.display = "none";
        renterPostLink.style.display = "none";
        lessorPostLink.style.display = "none";

        if (heroBtn) {
          heroBtn.href = "/login.html";
          heroBtn.style.display = "inline-block";
        }

        setupNavigation();
      }
    });
  });

  // 3. Tải Footer
  loadComponent("/footer.html", "footer-placeholder");

  // 4. Tải và kích hoạt Chatbox (QUAN TRỌNG: SỬA LỖI RACE CONDITION)
  fetch("/chatbox.html")
    .then((res) => {
      if (!res.ok) throw new Error("Chatbox HTML not found");
      return res.text();
    })
    .then((html) => {
      // A. Chèn HTML
      document.body.insertAdjacentHTML("beforeend", html);

      // B. Kích hoạt logic từ chatbox.js (đã được tải trước đó)
      if (typeof window.initializeChatbox === "function") {
        window.initializeChatbox();
      } else {
        console.warn("⚠️ initializeChatbox chưa sẵn sàng hoặc không tồn tại.");
      }
    })
    .catch((err) => console.error("Lỗi tải Chatbox HTML:", err));
});
