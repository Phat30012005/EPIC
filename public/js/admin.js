/* =======================================
   --- FILE: public/js/admin.js ---
   (PHIÊN BẢN V3 - QUẢN LÝ ĐA NĂNG: PHÒNG TRỌ & Ở GHÉP)
   ======================================= */

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("adminTableBody");
  const postTypeSelector = document.getElementById("adminPostType");

  // Nếu thiếu 1 trong 2 element này thì dừng lại (tránh lỗi null)
  if (!tableBody || !postTypeSelector) {
    console.error("Thiếu adminTableBody hoặc adminPostType trong HTML");
    return;
  }

  // --- 1. CẤU HÌNH API (PHẦN MỚI BẠN ĐANG THIẾU) ---
  const API_CONFIG = {
    rental: {
      api: "posts-api", // Tên function cho phòng trọ
      idField: "id", // Tên trường ID trả về
    },
    roommate: {
      api: "roommate-api", // Tên function cho tìm ở ghép
      idField: "posting_id", // Tên trường ID trả về
    },
  };

  // Biến lưu loại tin hiện tại đang xem (Mặc định là rental)
  let currentType = "rental";

  // --- 2. LẮNG NGHE SỰ KIỆN ĐỔI LOẠI TIN ---
  postTypeSelector.addEventListener("change", (e) => {
    currentType = e.target.value; // 'rental' hoặc 'roommate'
    console.log("Admin chuyển sang xem:", currentType);
    loadAdminPosts(); // Tải lại dữ liệu tương ứng
  });

  /**
   * Hàm tải dữ liệu
   */
  async function loadAdminPosts() {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">Đang tải dữ liệu...</td></tr>';

    // Lấy config dựa trên loại hiện tại
    const config = API_CONFIG[currentType];

    // Gọi API lấy 2 danh sách: Chờ duyệt (PENDING) và Đang hiện (APPROVED)
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
    if (pendingRes.data && pendingRes.data.data)
      allPosts = [...allPosts, ...pendingRes.data.data];
    if (approvedRes.data && approvedRes.data.data)
      allPosts = [...allPosts, ...approvedRes.data.data];

    if (allPosts.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Chưa có tin đăng nào.</td></tr>';
      return;
    }

    renderTable(allPosts);
  }

  /**
   * Hàm vẽ bảng
   */
  function renderTable(posts) {
    tableBody.innerHTML = "";
    const config = API_CONFIG[currentType];

    // Sắp xếp: Tin PENDING (Chờ duyệt) lên đầu
    posts.sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (a.status !== "PENDING" && b.status === "PENDING") return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    posts.forEach((post, index) => {
      const tr = document.createElement("tr");

      // Lấy ID linh hoạt (vì 2 bảng dùng tên cột khác nhau)
      const postId = post[config.idField] || post.post_id || post.id;

      // Tạo link xem chi tiết đúng loại
      const detailLink =
        currentType === "rental"
          ? `/public/chitiet.html?id=${postId}`
          : `/public/oghep-chitiet.html?id=${postId}`;

      // Badge trạng thái & Nút bấm
      let statusBadge = "";
      let actionButtons = "";

      if (post.status === "PENDING") {
        statusBadge =
          '<span class="badge bg-warning text-dark">Chờ duyệt</span>';
        actionButtons = `
            <button class="btn btn-success btn-sm approve-btn me-1" data-id="${postId}">
                <i class="fa-solid fa-check"></i> Duyệt
            </button>
            <button class="btn btn-secondary btn-sm reject-btn me-1" data-id="${postId}">
                <i class="fa-solid fa-xmark"></i> Từ chối
            </button>
          `;
      } else if (post.status === "APPROVED") {
        statusBadge = '<span class="badge bg-success">Đang hiển thị</span>';
        actionButtons = `
             <button class="btn btn-secondary btn-sm reject-btn me-1" data-id="${postId}">
                <i class="fa-solid fa-ban"></i> Gỡ bài
             </button>
          `;
      } else {
        statusBadge = `<span class="badge bg-danger">${post.status}</span>`;
      }

      // Nút Xóa (Luôn có)
      actionButtons += `
        <button class="btn btn-danger btn-sm delete-btn" data-id="${postId}">
           <i class="fa-solid fa-trash"></i>
        </button>
      `;

      // Định dạng giá (Dùng Utils nếu có, hoặc toLocaleString)
      const priceDisplay = post.price ? post.price.toLocaleString() : "0";
      const unit = currentType === "rental" ? "đ" : "đ/người";

      tr.innerHTML = `
          <td class="text-center">${index + 1}</td>
          <td>
              <a href="${detailLink}" target="_blank" class="fw-bold text-decoration-none">
                  ${post.title}
              </a>
              <br><small class="text-muted">${priceDisplay} ${unit}</small>
          </td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">
              <div class="d-flex justify-content-center">
                 ${actionButtons}
              </div>
          </td>
      `;
      tableBody.appendChild(tr);
    });

    addEventListeners();
  }

  /**
   * Gán sự kiện click cho các nút trong bảng
   */
  function addEventListeners() {
    // 1. Nút Duyệt
    document.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateStatus(btn.dataset.id, "APPROVED")
      );
    });

    // 2. Nút Từ chối / Gỡ
    document.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateStatus(btn.dataset.id, "REJECTED")
      );
    });

    // 3. Nút Xóa vĩnh viễn
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest("button").dataset.id;
        const config = API_CONFIG[currentType]; // Lấy config hiện tại để biết gọi API nào

        showConfirm("Xóa vĩnh viễn bài này?", async () => {
          const { error } = await callEdgeFunction(config.api, {
            method: "DELETE",
            params: { id: id },
          });
          if (!error) {
            alert("Đã xóa!");
            loadAdminPosts();
          } else {
            alert("Lỗi: " + error.message);
          }
        });
      });
    });
  }

  /**
   * Gọi API Patch Update Status
   */
  async function updateStatus(id, newStatus) {
    const config = API_CONFIG[currentType];

    const { error } = await callEdgeFunction(config.api, {
      method: "PATCH",
      body: { id: id, status: newStatus },
    });

    if (error) {
      alert("Lỗi cập nhật: " + error.message);
    } else {
      loadAdminPosts();
    }
  }

  // Chạy lần đầu khi vào trang
  loadAdminPosts();
});
