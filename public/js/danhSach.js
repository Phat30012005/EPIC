// public/js/danhSach.js
// ĐÃ VIẾT LẠI HOÀN TOÀN ĐỂ DÙNG SUPABASE VÀ BỘ LỌC

document.addEventListener("DOMContentLoaded", () => {
    // Lấy các phần tử DOM
    const filterPrice = document.getElementById("filterPrice");
    const filterType = document.getElementById("filterType");
    const filterSize = document.getElementById("roomsize-desktop");
    const filterLocal = document.getElementById("local-desktop");
    const roomList = document.getElementById("roomList");

    if (!roomList) {
        console.error("Không tìm thấy #roomList");
        return;
    }

    // Hàm render danh sách phòng
    function renderRooms(rooms) {
        roomList.innerHTML = ""; // Xóa nội dung cũ
        if (!rooms || rooms.length === 0) {
            roomList.innerHTML = `<p class="text-center text-gray-500 mt-4 col-span-3">Không có phòng nào phù hợp.</p>`;
            return;
        }

        rooms.forEach((room) => {
            const div = document.createElement("div");
            div.className = "bg-white rounded shadow p-3 hover:shadow-lg transition";
            
            // Sử dụng tên cột từ CSDL Supabase (vd: image_url, title, price)
            div.innerHTML = `
              <img src="${room.image_url || "/public/assets/logo2.jpg"}"
                   alt="${room.title}"
                   class="w-full h-40 object-cover mb-3 rounded">
              <h5 class="font-bold text-lg mb-1">${room.title || "Chưa có tiêu đề"}</h5>
              <p class="text-gray-600 mb-1">${room.address || "Chưa có địa chỉ"}</p>
              <p class="text-primary font-semibold mb-2">${room.price?.toLocaleString() || 0} đ/tháng</p>
              <a href="chitiet.html?id=${room.id}" class="btn btn-sm btn-primary">Xem chi tiết</a>
            `;
            roomList.appendChild(div);
        });
    }

    // Hàm tải dữ liệu từ Supabase và áp dụng bộ lọc
    async function loadAndFilterRooms() {
        console.log("Đang tải dữ liệu từ Supabase...");
        
        // 1. Lấy tham số loại phòng từ URL (vd: ?type=Phòng%20đơn)
        const params = new URLSearchParams(window.location.search);
        const urlRoomType = params.get('type');

        // 2. Bắt đầu query
        let query = supabase.from("posts").select("*");

        // 3. Lọc theo loại phòng từ URL (nếu có)
        if (urlRoomType) {
            query = query.eq('room_type', urlRoomType);
            
            // Cập nhật giá trị của <select> bộ lọc
            if(filterType) filterType.value = urlRoomType;
        }

        // 4. Lọc theo giá
        const priceValue = filterPrice?.value;
        if (priceValue === "1-2") query = query.gte('price', 1000000).lte('price', 2000000);
        else if (priceValue === "3-4") query = query.gte('price', 3000000).lte('price', 4000000);
        else if (priceValue === "5-6") query = query.gte('price', 5000000).lte('price', 6000000);
        else if (priceValue === "tren6") query = query.gt('price', 6000000);

        // 5. Lọc theo loại phòng (từ <select>)
        const typeValue = filterType?.value;
        if (typeValue && typeValue !== "Loại phòng trọ") {
             query = query.eq('room_type', typeValue);
        }

        // 6. Lọc theo diện tích
        const sizeValue = filterSize?.value;
        if (sizeValue === "10-16") query = query.gte('area', 10).lte('area', 16);
        else if (sizeValue === "17-25") query = query.gte('area', 17).lte('area', 25);
        else if (sizeValue === "26-35") query = query.gte('area', 26).lte('area', 35);
        else if (sizeValue === "tren35") query = query.gt('area', 35);

        // 7. Lọc theo khu vực (ward) - Lọc bằng tên Quận/Huyện
        const localValue = filterLocal?.value;
        if (localValue && localValue !== "Khu vực") {
            // Dùng ilike để tìm kiếm (không phân biệt hoa thường)
            // Lọc các 'ward' có chứa tên khu vực, ví dụ "An Cư (Ninh Kiều)" chứa "Ninh Kiều"
            query = query.ilike('ward', `%${localValue}%`);
        }

        // 8. Thực thi query
        const { data, error } = await query;

        if (error) {
            console.error("Lỗi khi tải dữ liệu:", error);
            roomList.innerHTML = `<p class="text-center text-red-500">Lỗi: ${error.message}</p>`;
            return;
        }

        if (data) {
            console.log("Tải dữ liệu thành công:", data);
            renderRooms(data); // Render dữ liệu thật
        }
    }

    // --- Gán sự kiện cho bộ lọc ---
    [filterPrice, filterType, filterSize, filterLocal].forEach((el) => {
        if (el) {
            el.addEventListener("change", loadAndFilterRooms);
        }
    });

    // --- Tải lần đầu ---
    loadAndFilterRooms();
});