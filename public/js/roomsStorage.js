(function () {
  const STORAGE_KEY = "roomsData";
  function loadRooms() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  }
  function saveRooms(rooms) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  }
  window.getRooms = () => loadRooms();
  window.addRoom = (room) => {
    const rooms = loadRooms();
    room.id = Date.now();
    rooms.push(room);
    saveRooms(rooms);
  };

  // === THÊM MỚI: Bổ sung hàm deleteRoom bị thiếu ===
  window.deleteRoom = (roomId) => {
    let rooms = loadRooms();
    // Chuyển đổi ID sang Number để đảm bảo so sánh chính xác
    const idToDelete = Number(roomId);
    rooms = rooms.filter((room) => Number(room.id) !== idToDelete);
    saveRooms(rooms);
  };
  // === KẾT THÚC THÊM MỚI ===
})();