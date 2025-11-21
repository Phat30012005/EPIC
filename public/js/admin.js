/* =======================================
   --- FILE: public/js/admin.js ---
   (PHIÊN BẢN V5 - DASHBOARD THỐNG KÊ)
   ======================================= */

document.addEventListener("DOMContentLoaded", () => {
  // UI Elements
  const dashboardContainer = document.getElementById("dashboard-container");
  const filtersContainer = document.getElementById("filters-container");
  const tableContainer = document.getElementById("table-container");

  const tableBody = document.getElementById("adminTableBody");
  const tableHead = document.getElementById("table-head");
  const postTypeSelector = document.getElementById("adminPostType");
  const sectionTitle = document.getElementById("section-title");

  // Stats Elements
  const statUsers = document.getElementById("stat-users");
  const statPosts = document.getElementById("stat-posts");
  const statPending = document.getElementById("stat-pending");
  const statReviews = document.getElementById("stat-reviews");

  let currentTab = "dashboard";
  let currentPostType = "rental";

  const API_CONFIG = {
    rental: { api: "posts-api", idField: "id" },
    roommate: { api: "roommate-api", idField: "posting_id" },
  };

  // --- 1. EVENT LISTENERS ---
  document
    .getElementById("tab-dashboard")
    .addEventListener("click", (e) => switchTab("dashboard", e.target));
  document
    .getElementById("tab-posts")
    .addEventListener("click", (e) => switchTab("posts", e.target));
  document
    .getElementById("tab-users")
    .addEventListener("click", (e) => switchTab("users", e.target));
  document
    .getElementById("tab-reviews")
    .addEventListener("click", (e) => switchTab("reviews", e.target));

  postTypeSelector.addEventListener("change", (e) => {
    currentPostType = e.target.value;
    loadAdminPosts();
  });

  // --- 2. HÀM CHUYỂN TAB ---
  function switchTab(tabName, clickedBtn) {
    currentTab = tabName;

    // Update UI Nav
    document
      .querySelectorAll(".nav-link")
      .forEach((b) => b.classList.remove("active", "text-primary"));
    clickedBtn.classList.add("active", "text-primary");

    // Reset Title text element (tìm lại nếu bị overwrite)
    const titleEl = document.getElementById("section-title");

    if (tabName === "dashboard") {
      if (titleEl) titleEl.textContent = "Tổng quan hệ thống";
      dashboardContainer.style.display = "block";
      filtersContainer.style.setProperty("display", "none", "important"); // Ẩn bộ lọc
      tableContainer.style.display = "none"; // Ẩn bảng
      loadDashboardStats();
    } else {
      dashboardContainer.style.display = "none";
      filtersContainer.style.display = "flex"; // Hiện bộ lọc (chỉ cho Posts)
      tableContainer.style.display = "block"; // Hiện bảng

      if (tabName === "posts") {
        if (titleEl) titleEl.textContent = "Danh sách Tin đăng";
        filtersContainer.style.setProperty("display", "flex", "important");
        loadAdminPosts();
      } else if (tabName === "users") {
        if (titleEl) titleEl.textContent = "Danh sách Người dùng";
        filtersContainer.style.setProperty("display", "none", "important");
        loadAdminUsers();
      } else if (tabName === "reviews") {
        if (titleEl) titleEl.textContent = "Danh sách Đánh giá";
        filtersContainer.style.setProperty("display", "none", "important");
        loadAdminReviews();
      }
    }
  }

  // --- 3. LOGIC DASHBOARD (MỚI) ---
  async function loadDashboardStats() {
    // Reset số liệu
    statUsers.textContent = "...";
    statPosts.textContent = "...";
    statPending.textContent = "...";
    statReviews.textContent = "...";

    const { data, error } = await callEdgeFunction("admin-get-stats", {
      method: "GET",
    });

    if (error) {
      console.error("Lỗi thống kê:", error);
      statUsers.textContent = "Lỗi";
      return;
    }

    // Cập nhật UI (Hiệu ứng đếm số có thể thêm sau)
    statUsers.textContent = data.users;
    statPosts.textContent = data.posts;
    statPending.textContent = data.pending_posts; // Tin chờ duyệt là quan trọng nhất
    statReviews.textContent = data.reviews;
  }

  // --- 4. LOGIC POSTS, USERS, REVIEWS (GIỮ NGUYÊN TỪ V4) ---
  // (Mình gộp gọn lại để code ngắn hơn, logic y hệt phiên bản trước)

  async function loadAdminPosts() {
    renderTableHeader([
      "STT",
      "Tiêu đề / Giá",
      "Người đăng",
      "Trạng thái",
      "Hành động",
    ]);
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">Đang tải...</td></tr>';
    const config = API_CONFIG[currentPostType];
    const [pending, approved] = await Promise.all([
      callEdgeFunction(config.api, {
        method: "GET",
        params: { status: "PENDING", limit: 50 },
      }),
      callEdgeFunction(config.api, {
        method: "GET",
        params: { status: "APPROVED", limit: 50 },
      }),
    ]);
    let list = [...(pending.data?.data || []), ...(approved.data?.data || [])];
    list.sort((a, b) => (a.status === "PENDING" ? -1 : 1));
    renderPostTable(list);
  }

  function renderPostTable(posts) {
    if (posts.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Trống</td></tr>';
      return;
    }
    tableBody.innerHTML = "";
    const config = API_CONFIG[currentPostType];
    posts.forEach((p, i) => {
      const id = p[config.idField] || p.post_id || p.id;
      const link =
        currentPostType === "rental"
          ? `/chitiet.html?id=${id}`
          : `/oghep-chitiet.html?id=${id}`;
      const badge =
        p.status === "PENDING"
          ? '<span class="badge bg-warning text-dark">Chờ duyệt</span>'
          : '<span class="badge bg-success">Hiện</span>';
      let btns =
        p.status === "PENDING"
          ? `<button class="btn btn-success btn-sm me-1" onclick="updatePostStatus('${id}', 'APPROVED')">✔</button><button class="btn btn-secondary btn-sm me-1" onclick="updatePostStatus('${id}', 'REJECTED')">✖</button>`
          : `<button class="btn btn-secondary btn-sm me-1" onclick="updatePostStatus('${id}', 'REJECTED')">Gỡ</button>`;
      btns += `<button class="btn btn-danger btn-sm" onclick="deletePost('${id}')">🗑</button>`;

      tableBody.innerHTML += `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td><a href="${link}" target="_blank" class="fw-bold">${
        p.title
      }</a><br><small>${Utils.formatCurrencyShort(p.price)}</small></td>
          <td>${p.profiles?.full_name || "Ẩn danh"}</td>
          <td class="text-center">${badge}</td>
          <td class="text-center">${btns}</td>
        </tr>`;
    });
  }

  async function loadAdminUsers() {
    renderTableHeader(["STT", "User", "Role", "Status", "Action"]);
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">Đang tải...</td></tr>';
    const { data } = await callEdgeFunction("admin-manage-users", {
      method: "GET",
    });
    const list = data.data || data || [];
    tableBody.innerHTML = "";
    list.forEach((u, i) => {
      const isBanned = u.is_banned === true;
      const btn =
        u.role !== "ADMIN"
          ? `<button class="btn btn-sm ${
              isBanned ? "btn-success" : "btn-dark"
            }" onclick="toggleBan('${u.id}', ${!isBanned})">${
              isBanned ? "Mở" : "Cấm"
            }</button>`
          : "";
      tableBody.innerHTML += `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td><b>${u.full_name || "No Name"}</b><br><small>${
        u.email
      }</small></td>
          <td class="text-center">${u.role}</td>
          <td class="text-center">${isBanned ? "🚫" : "✅"}</td>
          <td class="text-center">${btn}</td>
        </tr>`;
    });
  }

  async function loadAdminReviews() {
    renderTableHeader(["STT", "Người đánh giá", "Nội dung", "Bài", "Xóa"]);
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">Đang tải...</td></tr>';
    const { data } = await callEdgeFunction("admin-manage-reviews", {
      method: "GET",
    });
    const list = data.data || data || [];
    tableBody.innerHTML = "";
    list.forEach((r, i) => {
      const stars = Utils.renderStars(r.rating);
      tableBody.innerHTML += `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td><b>${r.profiles?.full_name}</b><br><small>${
        r.profiles?.email
      }</small></td>
          <td>${stars}<br><i>"${r.comment}"</i></td>
          <td><small>${r.posts?.title || "Deleted"}</small></td>
          <td class="text-center"><button class="btn btn-danger btn-sm" onclick="deleteReview('${
            r.review_id
          }')">🗑</button></td>
        </tr>`;
    });
  }

  // Helpers
  function renderTableHeader(headers) {
    tableHead.innerHTML = `<tr>${headers
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr>`;
  }

  // Global Actions (Giữ nguyên logic cũ)
  window.updatePostStatus = async (id, status) => {
    const config = API_CONFIG[currentPostType];
    await callEdgeFunction(config.api, {
      method: "PATCH",
      body: { id, status },
    });
    loadAdminPosts();
  };
  window.deletePost = async (id) => {
    if (confirm("Xóa?")) {
      const config = API_CONFIG[currentPostType];
      await callEdgeFunction(config.api, { method: "DELETE", params: { id } });
      loadAdminPosts();
    }
  };
  window.toggleBan = async (uid, status) => {
    if (confirm("Xác nhận?")) {
      await callEdgeFunction("admin-manage-users", {
        method: "PATCH",
        body: { user_id: uid, is_banned: status },
      });
      loadAdminUsers();
    }
  };
  window.deleteReview = async (id) => {
    if (confirm("Xóa review?")) {
      await callEdgeFunction("admin-manage-reviews", {
        method: "DELETE",
        params: { id },
      });
      loadAdminReviews();
    }
  };

  // Khởi chạy: Vào thẳng Dashboard
  switchTab("dashboard", document.getElementById("tab-dashboard"));
});
