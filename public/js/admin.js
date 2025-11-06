// public/js/admin.js (ĐÃ SỬA LỖI)

document.addEventListener("DOMContentLoaded", () => {
  // === SỬA LỖI: Đổi ID từ "adminRoomList" thành "adminTableBody" ===
  const tableBody = document.getElementById("adminTableBody");

  // Kiểm tra xem phần tử có tồn tại không
  if (!tableBody) {
    console.error("Lỗi: Không tìm thấy phần tử #adminTableBody trong admin.html");
    return;
  }

  function renderRooms() {
    tableBody.innerHTML = ""; // Xóa nội dung cũ
    const rooms = window.getRooms(); // Lấy dữ liệu từ storage

    if (rooms.length === 0) {
      // Hiển thị thông báo nếu không có dữ liệu
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted p-4">
            Chưa có bài đăng nào.
          </td>
        </tr>
      `;
      return;
    }

    // Lặp qua mảng rooms và tạo từng hàng (row)
    rooms.forEach((room, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-center">${index + 1}</td>
        <td>
          <a href="/public/chitiet.html?id=${room.id}" class="text-primary fw-bold">
            ${room.title || "Chưa có tiêu đề"}
          </a>
        </td>
        <td class="text-center">${Number(room.price).toLocaleString()} vnđ</td>
        <td class="text-center"><span class="badge bg-success">Đã duyệt</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-danger delete-btn" data-id="${room.id}">
            Xóa
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // Gắn sự kiện cho tất cả các nút Xóa
    const deleteButtons = tableBody.querySelectorAll(".delete-btn");
    deleteButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        
        // Sử dụng hàm confirm từ main.js (nếu có) hoặc confirm mặc định
        const confirmDelete = window.showConfirm || confirm;
        
        confirmDelete("Bạn có chắc chắn muốn xóa tin này?", () => {
          window.deleteRoom(Number(id)); // Gọi hàm xóa từ storage
          renderRooms(); // Vẽ lại bảng
        });
      });
    });
  }

  // Lần chạy đầu tiên
  renderRooms();
});