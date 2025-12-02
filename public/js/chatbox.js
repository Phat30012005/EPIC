/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V8.0 - FIX LAYOUT & LOGIC)
   ======================================= */

// Log kiểm tra phiên bản
console.log(
  "%c Chatbox V8.0 Loaded (CSS Fixed)",
  "background: #007bff; color: #fff; padding: 2px 5px; border-radius: 3px;"
);

let currentUser = null;
let isSending = false; // Cờ chống spam click

const SUGGESTED_QUESTIONS = [
  "Cách đăng tin cho thuê?",
  "Tìm phòng dưới 2 triệu",
  "Chính sách tìm người ở ghép?",
  "Khu vực nào gần ĐH Cần Thơ?",
];

// 1. KHỞI TẠO CHATBOX
async function initializeChatbox() {
  const chatWidget = document.getElementById("chat-widget");
  if (!chatWidget) return;

  const elements = {
    toggleBtn: document.getElementById("chat-toggle"),
    chatBox: document.getElementById("chat-box"),
    closeBtn: document.getElementById("chat-close"),
    sendBtn: document.getElementById("send-btn"),
    chatInput: document.getElementById("chat-input"),
    chatBody: document.getElementById("chat-body"),
  };

  // Kiểm tra DOM tồn tại
  if (!elements.toggleBtn || !elements.chatBox) return;

  // Thêm vùng gợi ý (Suggestion Box) nếu chưa có
  let suggestionBox = document.getElementById("suggestion-box");
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestion-box";
    suggestionBox.className = "suggestion-container hidden";
    // Chèn vào TRƯỚC footer để đẹp hơn
    const footer = document.querySelector(".chat-footer");
    if (footer) elements.chatBox.insertBefore(suggestionBox, footer);
  }

  // === AUTH CHECK ===
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) console.warn("Auth Warning:", error);

    currentUser = session?.user;

    if (!currentUser) {
      renderLoginPrompt(elements.chatBody);
      if (elements.chatInput) elements.chatInput.disabled = true;
      if (elements.sendBtn) elements.sendBtn.disabled = true;
    } else {
      await loadChatHistory();
      renderSuggestions();
    }
  } catch (e) {
    console.error("Chatbox Init Error:", e);
  }

  // === EVENT LISTENERS ===

  // Mở/Đóng chat
  elements.toggleBtn.onclick = () => {
    elements.chatBox.classList.toggle("hidden");
    // Auto focus và scroll khi mở
    if (!elements.chatBox.classList.contains("hidden") && currentUser) {
      setTimeout(() => {
        elements.chatInput.focus();
        scrollToBottom();
      }, 100);
    }
  };

  elements.closeBtn.onclick = () => elements.chatBox.classList.add("hidden");

  // Gửi tin nhắn
  window.handleSend = async (text = null) => {
    if (isSending) return; // Chặn spam
    const msg = text || elements.chatInput.value.trim();

    if (!msg) return;
    if (!currentUser) {
      alert("Vui lòng đăng nhập để chat.");
      window.location.href = "/login.html";
      return;
    }

    isSending = true;

    // 1. UI: Vẽ tin nhắn User NGAY LẬP TỨC (Optimistic UI)
    appendMessage(msg, "user");

    // Reset UI
    elements.chatInput.value = "";
    if (suggestionBox) suggestionBox.classList.add("hidden");

    // Hiển thị "Bot đang nhập..."
    const typingId = showTypingIndicator();

    try {
      // 2. DATA: Lưu vào DB song song với gọi API
      const dbPromise = supabase.from("chat_messages").insert({
        user_id: currentUser.id,
        content: msg,
        is_bot: false,
      });

      const apiPromise = callEdgeFunction("chat-bot", {
        method: "POST",
        body: { message: msg },
      });

      // Chờ API phản hồi (quan trọng hơn DB lúc này)
      const [dbRes, apiRes] = await Promise.all([dbPromise, apiPromise]);

      if (dbRes.error) console.error("DB Save Error:", dbRes.error);

      removeTypingIndicator(typingId);

      // 3. UI: Vẽ tin nhắn Bot
      if (apiRes.error) {
        appendMessage("⚠️ Gà Bông đang mất kết nối. Thử lại sau nhé!", "bot");
      } else if (apiRes.data && apiRes.data.reply) {
        appendMessage(apiRes.data.reply, "bot");
      } else {
        appendMessage("Gà Bông không hiểu ý bạn. 🐣", "bot");
      }
    } catch (err) {
      console.error("Chat Error:", err);
      removeTypingIndicator(typingId);
      appendMessage("⚠️ Lỗi hệ thống.", "bot");
    } finally {
      isSending = false;
    }
  };

  elements.sendBtn.onclick = () => window.handleSend();
  elements.chatInput.onkeypress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.handleSend();
    }
  };
}

// --- HELPER FUNCTIONS ---

function renderLoginPrompt(chatBody) {
  chatBody.innerHTML = `
      <div style="text-align: center; margin-top: 40px; color: #666;">
        <div style="font-size: 40px; margin-bottom: 10px;">🐣</div>
        <p>Đăng nhập để chat với Gà Bông nhé!</p>
        <a href="/login.html" class="btn btn-primary btn-sm mt-2">Đăng nhập ngay</a>
      </div>
    `;
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

async function loadChatHistory() {
  const chatBody = document.getElementById("chat-body");
  if (!chatBody) return;

  if (!chatBody.hasChildNodes()) {
    chatBody.innerHTML =
      '<div style="text-align:center; color:#999; margin-top:20px;">Đang tải tin nhắn...</div>';
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  chatBody.innerHTML = ""; // Xóa loading

  if (!error && data && data.length > 0) {
    data.forEach((msg) =>
      appendMessage(msg.content, msg.is_bot ? "bot" : "user")
    );
  } else {
    appendMessage(
      "Chào bạn! Mình là Gà Bông 🐣. Bạn cần tìm phòng trọ khu vực nào?",
      "bot"
    );
  }
  scrollToBottom();
}

// [QUAN TRỌNG] Hàm vẽ tin nhắn đã được sửa lại cấu trúc HTML
function appendMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");
  if (!chatBody) return;

  // Tạo container dòng (Row)
  const rowDiv = document.createElement("div");
  rowDiv.className = `message-row ${
    sender === "user" ? "user-message-row" : "bot-message-row"
  }`;

  // Tạo bong bóng tin nhắn (Bubble)
  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = `message-bubble ${
    sender === "user" ? "user-message-bubble" : "bot-message-bubble"
  }`;

  // Xử lý text (xuống dòng, bold)
  let formattedText = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;") // Chống XSS cơ bản
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  bubbleDiv.innerHTML = formattedText;

  rowDiv.appendChild(bubbleDiv);
  chatBody.appendChild(rowDiv);

  scrollToBottom();
}

function showTypingIndicator() {
  const chatBody = document.getElementById("chat-body");
  const id = "typing-" + Date.now();

  const rowDiv = document.createElement("div");
  rowDiv.id = id;
  rowDiv.className = "message-row bot-message-row";

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "message-bubble bot-message-bubble";
  bubbleDiv.style.fontStyle = "italic";
  bubbleDiv.style.color = "#888";
  bubbleDiv.textContent = "Đang nhập...";

  rowDiv.appendChild(bubbleDiv);
  chatBody.appendChild(rowDiv);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const chatBody = document.getElementById("chat-body");
  if (chatBody) {
    // Dùng setTimeout để đảm bảo DOM đã render xong mới cuộn
    setTimeout(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
    }, 50);
  }
}
