// public/js/admin.js
// ĐÃ VIẾT LẠI HOÀN TOÀN ĐỂ DÙNG SUPABASE

document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.getElementById("adminTableBody");

    if (!tableBody) {
        console.error("Lỗi: Không tìm thấy phần tử #adminTableBody");
        return;
    }

    async function renderRooms() {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center">Đang tải...</td></tr>`;

        // 1. Lấy dữ liệu từ Supabase
        const { data: rooms, error } = await supabase
            .from('posts')
            .select('*');

        if (error) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Lỗi: ${error.message}</td></tr>`;
            return;
        }

        if (rooms.length === 0) {
            tableBody.innerHTML = `
                <tr>
                  <td colspan="5" class="text-center text-muted p-4">
                    Chưa có bài đăng nào.
                  </td>
                </tr>`;
            return;
        }
        
        tableBody.innerHTML = ""; // Xóa nội dung
        
        // 2. Lặp và render
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

        // 3. Gắn sự kiện cho các nút Xóa
        tableBody.querySelectorAll(".delete-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                
                if (confirm("Bạn có chắc chắn muốn xóa tin này?")) {
                    // Gọi hàm xóa của Supabase
                    const { error: deleteError } = await supabase
                        .from('posts')
                        .delete()
                        .eq('id', id);

                    if (deleteError) {
                        alert('Xóa thất bại: ' + deleteError.message);
                    } else {
                        alert('Xóa thành công!');
                        renderRooms(); // Tải lại bảng
                    }
                }
            });
        });
    }

    // Lần chạy đầu tiên
    renderRooms();
});