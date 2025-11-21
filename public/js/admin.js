/* =======================================
   --- FILE: public/js/admin.js ---
   (PHIÊN BẢN V4 - QUẢN LÝ TIN & NGƯỜI DÙNG)
   ======================================= */

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("adminTableBody");
  const tableHead = document.getElementById("table-head");
  const postTypeSelector = document.getElementById("adminPostType");
  const sectionTitle = document.getElementById("section-title");

  // State quản lý trạng thái hiện tại
  let currentTab = "posts"; // 'posts' hoặc 'users'
  let currentPostType = "rental"; // 'rental' hoặc 'roommate'

  // Cấu hình API
  const API_CONFIG = {
    rental: { api: "posts-api", idField: "id" },
    roommate: { api: "roommate-api", idField: "posting_id" },
  };

  // --- 1. XỬ LÝ CHUYỂN TAB ---
  document
    .getElementById("tab-posts")
    .addEventListener("click", (e) => switchTab("posts", e.target));
  document
    .getElementById("tab-users")
    .addEventListener("click", (e) => switchTab("users", e.target));

  function switchTab(tabName, clickedBtn) {
    currentTab = tabName;

    // Update UI Tabs
    document
      .querySelectorAll(".nav-link")
      .forEach((b) => b.classList.remove("active", "text-primary"));
    clickedBtn.classList.add("active", "text-primary");

    if (tabName === "posts") {
      postTypeSelector.style.display = "block";
      sectionTitle.textContent = "Danh sách Tin đăng";
      loadAdminPosts();
    } else {
      postTypeSelector.style.display = "none";
      sectionTitle.textContent = "Danh sách Người dùng";
      loadAdminUsers();
    }
  }

  // --- 2. LOGIC QUẢN LÝ TIN ĐĂNG (POSTS) ---
  postTypeSelector.addEventListener("change", (e) => {
    currentPostType = e.target.value;
    loadAdminPosts();
  });

  async function loadAdminPosts() {
    renderTableHeader([
      "STT",
      "Tiêu đề / Giá",
      "Người đăng",
      "Trạng thái",
      "Hành động",
    ]);
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">Đang tải dữ liệu...</td></tr>';

    const config = API_CONFIG[currentPostType];

    // Gọi 2 API song song (Pending & Approved)
    const [pendingRes, approvedRes] = await Promise.all([
      callEdgeFunction(config.api, {
        method: "GET",
        params: { status: "PENDING", limit: 50 },
      }),
      callEdgeFunction(config.api, {
        method: "GET",
        params: { status: "APPROVED", limit: 50 },
      }),
    ]);

    let allPosts = [];
    if (pendingRes.data?.data)
      allPosts = [...allPosts, ...pendingRes.data.data];
    if (approvedRes.data?.data)
      allPosts = [...allPosts, ...approvedRes.data.data];

    if (allPosts.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Chưa có tin đăng nào.</td></tr>';
      return;
    }

    renderPostTable(allPosts);
  }

  function renderPostTable(posts) {
    tableBody.innerHTML = "";
    const config = API_CONFIG[currentPostType];

    // Sắp xếp: PENDING lên đầu
    posts.sort((a, b) => (a.status === "PENDING" ? -1 : 1));

    posts.forEach((post, index) => {
      const tr = document.createElement("tr");
      const postId = post[config.idField] || post.post_id || post.id;
      const detailLink =
        currentPostType === "rental"
          ? `/chitiet.html?id=${postId}`
          : `/oghep-chitiet.html?id=${postId}`;

      // Badge trạng thái
      let statusBadge =
        post.status === "PENDING"
          ? '<span class="badge bg-warning text-dark">Chờ duyệt</span>'
          : '<span class="badge bg-success">Đang hiển thị</span>';

      // Nút bấm
      let buttons = "";
      if (post.status === "PENDING") {
        buttons += `<button class="btn btn-success btn-sm me-1" onclick="updatePostStatus('${postId}', 'APPROVED')"><i class="fa-solid fa-check"></i> Duyệt</button>`;
        buttons += `<button class="btn btn-secondary btn-sm me-1" onclick="updatePostStatus('${postId}', 'REJECTED')"><i class="fa-solid fa-xmark"></i> Từ chối</button>`;
      } else {
        buttons += `<button class="btn btn-secondary btn-sm me-1" onclick="updatePostStatus('${postId}', 'REJECTED')"><i class="fa-solid fa-ban"></i> Gỡ</button>`;
      }
      buttons += `<button class="btn btn-danger btn-sm" onclick="deletePost('${postId}')"><i class="fa-solid fa-trash"></i></button>`;

      const price = Utils.formatCurrencyShort(post.price);
      const author = post.profiles?.full_name || "Ẩn danh";

      tr.innerHTML = `
          <td class="text-center">${index + 1}</td>
          <td><a href="${detailLink}" target="_blank" class="fw-bold text-decoration-none">${
        post.title
      }</a><br><small class="text-muted">${price}</small></td>
          <td>${author}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center"><div class="d-flex justify-content-center">${buttons}</div></td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // --- 3. LOGIC QUẢN LÝ NGƯỜI DÙNG (USERS) ---
  async function loadAdminUsers() {
    renderTableHeader([
      "STT",
      "Thông tin",
      "Vai trò",
      "Trạng thái",
      "Hành động",
    ]);
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">Đang tải danh sách người dùng...</td></tr>';

    const { data, error } = await callEdgeFunction("admin-manage-users", {
      method: "GET",
    });

    if (error) {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Lỗi: ${error.message}</td></tr>`;
      return;
    }

    const users = data.data || data; // Support cả 2 format trả về
    if (!users || users.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Chưa có người dùng nào.</td></tr>';
      return;
    }

    renderUserTable(users);
  }

  function renderUserTable(users) {
    tableBody.innerHTML = "";
    users.forEach((user, index) => {
      const tr = document.createElement("tr");

      // Badge vai trò
      const roleBadge =
        user.role === "ADMIN"
          ? '<span class="badge bg-danger">ADMIN</span>'
          : user.role === "LESSOR"
          ? '<span class="badge bg-primary">Chủ trọ</span>'
          : '<span class="badge bg-info">Người thuê</span>';

      // Trạng thái Cấm
      const isBanned = user.is_banned === true;
      const statusHtml = isBanned
        ? '<span class="badge bg-dark">🚫 Đã bị cấm</span>'
        : '<span class="badge bg-success">Hoạt động</span>';

      // Nút hành động (Không cho ban Admin)
      let actionBtn = "";
      if (user.role !== "ADMIN") {
        if (isBanned) {
          actionBtn = `<button class="btn btn-outline-success btn-sm" onclick="toggleBan('${user.id}', false)">🔓 Mở khóa</button>`;
        } else {
          actionBtn = `<button class="btn btn-outline-dark btn-sm" onclick="toggleBan('${user.id}', true)">🚫 Cấm</button>`;
        }
      }

      const avatar = user.avatar_url || "/assets/logo2.jpg";

      tr.innerHTML = `
        <td class="text-center">${index + 1}</td>
        <td>
          <div class="d-flex align-items-center">
            <img src="${avatar}" class="rounded-circle border me-2" style="width:40px; height:40px; object-fit:cover;">
            <div>
              <div class="fw-bold">${user.full_name || "Chưa đặt tên"}</div>
              <div class="small text-muted">${user.email}</div>
              <div class="small text-muted">${user.phone_number || ""}</div>
            </div>
          </div>
        </td>
        <td class="text-center">${roleBadge}</td>
        <td class="text-center">${statusHtml}</td>
        <td class="text-center">${actionBtn}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // --- 4. CÁC HÀM HÀNH ĐỘNG (GLOBAL) ---

  // Helper vẽ Header bảng
  function renderTableHeader(headers) {
    tableHead.innerHTML = `<tr>${headers
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr>`;
  }

  // Action: Update Post Status
  window.updatePostStatus = async (id, status) => {
    const config = API_CONFIG[currentPostType];
    // Nếu là post (rental), dùng posts-api PATCH
    // Nếu là roommate, dùng roommate-api PATCH
    // Logic hơi khác nhau ở API nên cần check

    // Để đơn giản, posts-api hỗ trợ PATCH {id, status}
    // roommate-api cũng hỗ trợ PATCH {id, status}
    // -> Dùng chung logic
    const { error } = await callEdgeFunction(config.api, {
      method: "PATCH",
      body: { id: id, status: status },
    });

    if (error) alert("Lỗi: " + error.message);
    else loadAdminPosts();
  };

  // Action: Delete Post
  window.deletePost = async (id) => {
    if (!confirm("Xóa vĩnh viễn tin này?")) return;
    const config = API_CONFIG[currentPostType];
    const { error } = await callEdgeFunction(config.api, {
      method: "DELETE",
      params: { id: id },
    });
    if (error) alert("Lỗi xóa: " + error.message);
    else loadAdminPosts();
  };

  // Action: Ban/Unban User
  window.toggleBan = async (userId, banStatus) => {
    const action = banStatus ? "Cấm" : "Mở khóa";
    if (!confirm(`Bạn có chắc muốn ${action} người dùng này?`)) return;

    const { error } = await callEdgeFunction("admin-manage-users", {
      method: "PATCH",
      body: { user_id: userId, is_banned: banStatus },
    });

    if (error) alert("Lỗi: " + error.message);
    else {
      alert(`Đã ${action} thành công!`);
      loadAdminUsers();
    }
  };

  // Khởi chạy mặc định
  loadAdminPosts();
});
