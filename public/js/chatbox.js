/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN FINAL - LOGIC AN TOÀN & KHÔNG REALTIME)
   ======================================= */

// Log kiểm tra: Nếu bạn không thấy dòng này trong Console (F12), nghĩa là Cache chưa được xóa!
console.log(
  "%c ✅ CHATBOX SYSTEM LOADED (SAFE MODE) ",
  "background: green; color: white; font-size: 12px; padding: 4px;"
);

let currentUser = null;
let isSending = false; // Khóa chặn spam click

const SUGGESTED_QUESTIONS = [
  "Cách đăng tin cho thuê?",
  "Tìm phòng dưới 2 triệu",
  "Chính sách tìm người ở ghép?",
  "Khu vực nào gần ĐH Cần Thơ?",
];

async function initializeChatbox() {
  const chatWidget = document.getElementById("chat-widget");
  if (!chatWidget) return;

  const ui = {
    toggleBtn: document.getElementById("chat-toggle"),
    chatBox: document.getElementById("chat-box"),
    closeBtn: document.getElementById("chat-close"),
    sendBtn: document.getElementById("send-btn"),
    chatInput: document.getElementById("chat-input"),
    chatBody: document.getElementById("chat-body"),
  };

  // Thêm vùng gợi ý an toàn
  let suggestionBox = document.getElementById("suggestion-box");
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestion-box";
    suggestionBox.className = "suggestion-container hidden";
    const footer = document.querySelector(".chat-footer");
    if (footer) ui.chatBox.insertBefore(suggestionBox, footer);
  }

  if (!ui.toggleBtn || !ui.chatBox) return;

  // 1. KIỂM TRA NGƯỜI DÙNG
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user;

  if (!currentUser) {
    // Hiển thị thông báo cần đăng nhập
    ui.chatBody.innerHTML = `
      <div style="text-align: center; margin-top: 60px; color: #666;">
        <p style="margin-bottom: 10px;">Bạn cần đăng nhập để chat 🐣</p>
        <a href="/login.html" class="btn btn-sm btn-primary">Đăng nhập ngay</a>
      </div>
    `;
    ui.chatInput.placeholder = "Vui lòng đăng nhập...";
    ui.chatInput.disabled = true;
    ui.sendBtn.disabled = true;
  } else {
    // Đã đăng nhập -> Tải lịch sử
    await loadChatHistory(ui.chatBody);
    renderSuggestions();
  }

  // 2. SỰ KIỆN UI
  ui.toggleBtn.onclick = () => {
    ui.chatBox.classList.toggle("hidden");
    if (!ui.chatBox.classList.contains("hidden") && currentUser) {
      setTimeout(() => {
        ui.chatInput.focus();
        scrollToBottom();
      }, 150);
    }
  };

  ui.closeBtn.onclick = () => ui.chatBox.classList.add("hidden");

  // 3. HÀM GỬI TIN NHẮN (CORE LOGIC)
  window.handleSend = async (forcedText = null) => {
    if (isSending) return; // Chặn click liên tục

    const msg = forcedText || ui.chatInput.value.trim();
    if (!msg || !currentUser) return;

    isSending = true; // Khóa nút gửi

    // --- BƯỚC A: VẼ GIAO DIỆN NGAY LẬP TỨC (QUAN TRỌNG) ---
    // Không chờ server, vẽ luôn để người dùng thấy phản hồi
    appendMessageToUI(msg, "user");

    // Reset Input
    ui.chatInput.value = "";
    if (suggestionBox) suggestionBox.classList.add("hidden");

    // Hiện "Bot đang nhập..."
    const typingId = showTypingIndicator();

    try {
      // --- BƯỚC B: LƯU DB & GỌI AI (CHẠY SONG SONG) ---
      // Dùng Promise.all để tối ưu thời gian
      const [dbRes, apiRes] = await Promise.all([
        // 1. Lưu tin nhắn User vào DB (để lần sau F5 còn thấy)
        supabase.from("chat_messages").insert({
          user_id: currentUser.id,
          content: msg,
          is_bot: false,
        }),
        // 2. Gọi API Bot lấy câu trả lời
        callEdgeFunction("chat-bot", {
          method: "POST",
          body: { message: msg },
        }),
      ]);

      // Xóa hiệu ứng nhập
      removeTypingIndicator(typingId);

      // --- BƯỚC C: XỬ LÝ PHẢN HỒI ---
      if (apiRes.error) {
        console.error("Bot API Error:", apiRes.error);
        appendMessageToUI(
          "⚠️ Gà Bông đang mất kết nối. Thử lại sau nhé!",
          "bot"
        );
      } else if (apiRes.data && apiRes.data.reply) {
        // Vẽ câu trả lời của Bot
        appendMessageToUI(apiRes.data.reply, "bot");
      } else {
        appendMessageToUI("Gà Bông chưa hiểu ý bạn 🐣", "bot");
      }
    } catch (err) {
      removeTypingIndicator(typingId);
      console.error("System Error:", err);
      appendMessageToUI("⚠️ Lỗi hệ thống.", "bot");
    } finally {
      isSending = false; // Mở khóa nút gửi
      // Focus lại input để chat tiếp
      setTimeout(() => ui.chatInput.focus(), 100);
    }
  };

  // Gán sự kiện Enter & Click
  ui.sendBtn.onclick = () => window.handleSend();
  ui.chatInput.onkeypress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.handleSend();
    }
  };
}

// --- UI HELPERS (SỬ DỤNG CẤU TRÚC CLASS MỚI) ---

function appendMessageToUI(text, sender) {
  const chatBody = document.getElementById("chat-body");
  if (!chatBody) return;

  // 1. Tạo Container Dòng (Row) - Để căn trái/phải
  const rowDiv = document.createElement("div");
  // Thêm class: chat-msg-row + is-user/is-bot
  rowDiv.className = `chat-msg-row ${sender === "user" ? "is-user" : "is-bot"}`;

  // 2. Tạo Bong Bóng (Bubble) - Để chứa text & màu nền
  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "chat-bubble";

  // 3. Xử lý Text (An toàn & Format)
  let formatted = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;") // Chống mã độc HTML
    .replace(/\n/g, "<br>") // Xuống dòng
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>"); // In đậm markdown

  bubbleDiv.innerHTML = formatted;

  // 4. Gắn vào DOM
  rowDiv.appendChild(bubbleDiv);
  chatBody.appendChild(rowDiv);

  // 5. Cuộn xuống
  scrollToBottom();
}

function showTypingIndicator() {
  const chatBody = document.getElementById("chat-body");
  const id = "typing-" + Date.now();
  const row = document.createElement("div");
  row.id = id;
  row.className = "chat-msg-row is-bot";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.style.fontStyle = "italic";
  bubble.style.color = "#888";
  bubble.style.backgroundColor = "transparent";
  bubble.style.border = "none";
  bubble.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Đang nhập...`;

  row.appendChild(bubble);
  chatBody.appendChild(row);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const chatBody = document.getElementById("chat-body");
  if (chatBody) {
    setTimeout(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
    }, 50); // Delay nhẹ để đảm bảo trình duyệt đã render xong chiều cao mới
  }
}

// Load lịch sử (Không dùng Realtime để tránh xung đột)
async function loadChatHistory(chatBody) {
  // Loading state
  if (!chatBody.innerHTML.trim()) {
    chatBody.innerHTML =
      '<div style="text-align:center; margin-top:20px; color:#999; font-size:13px;">Đang tải tin nhắn...</div>';
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  chatBody.innerHTML = ""; // Clear loading

  if (!error && data && data.length > 0) {
    data.forEach((msg) => {
      appendMessageToUI(msg.content, msg.is_bot ? "bot" : "user");
    });
  } else {
    appendMessageToUI(
      "Chào bạn! Mình là Gà Bông 🐣. Bạn muốn tìm phòng ở đâu?",
      "bot"
    );
  }
  scrollToBottom();
}

function renderSuggestions() {
  const box = document.getElementById("suggestion-box");
  if (!box) return;
  box.innerHTML = "";
  box.classList.remove("hidden");
  SUGGESTED_QUESTIONS.forEach((q) => {
    const btn = document.createElement("button");
    btn.className = "suggestion-btn";
    btn.textContent = q;
    btn.onclick = () => window.handleSend(q);
    box.appendChild(btn);
  });
}
