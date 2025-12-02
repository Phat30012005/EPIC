/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V11 - ĐỒNG BỘ CLASS CHUẨN)
   ======================================= */

// Log để kiểm tra xem trình duyệt đã tải file mới chưa
console.log("✅ Chatbox V11 Loaded: Synchronized Classes");

let currentUser = null;
let isSending = false;

const SUGGESTED_QUESTIONS = [
  "Cách đăng tin cho thuê?",
  "Tìm phòng dưới 2 triệu",
  "Chính sách tìm người ở ghép?",
  "Khu vực nào gần ĐH Cần Thơ?",
];

async function initializeChatbox() {
  const widget = document.getElementById("chat-widget");
  if (!widget) return;

  // UI Elements Mapping
  const ui = {
    toggle: document.getElementById("chat-toggle"),
    box: document.getElementById("chat-box"),
    close: document.getElementById("chat-close"),
    send: document.getElementById("send-btn"),
    input: document.getElementById("chat-input"),
    body: document.getElementById("chat-body"),
  };

  // Thêm vùng gợi ý
  let suggestionBox = document.getElementById("suggestion-box");
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestion-box";
    suggestionBox.className = "hidden";
    const footer = document.querySelector(".chat-footer");
    if (footer) ui.box.insertBefore(suggestionBox, footer);
  }

  // 1. Check Auth
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user;

  if (!currentUser) {
    ui.body.innerHTML = `
      <div style="text-align:center; margin-top:60px; color:#666;">
        <p>Bạn cần đăng nhập để chat 🐣</p>
        <a href="/login.html" class="btn btn-primary btn-sm" style="margin-top:10px;">Đăng nhập ngay</a>
      </div>`;
    ui.input.disabled = true;
    ui.send.disabled = true;
  } else {
    // Tải lịch sử (quan trọng: Truyền ui.body vào)
    await loadChatHistory(ui.body);
    renderSuggestions();
  }

  // 2. Events
  ui.toggle.onclick = () => {
    ui.box.classList.toggle("hidden");
    if (!ui.box.classList.contains("hidden") && currentUser) {
      setTimeout(() => {
        ui.input.focus();
        scrollToBottom(ui.body);
      }, 150);
    }
  };
  ui.close.onclick = () => ui.box.classList.add("hidden");

  // 3. Handle Send
  window.handleSend = async (text = null) => {
    const msg = text || ui.input.value.trim();

    if (!msg) return;
    if (!currentUser) {
      alert("Vui lòng đăng nhập lại.");
      return;
    }
    if (isSending) return;
    isSending = true;

    // === UI UPDATE (Vẽ ngay lập tức) ===
    // 'user' ở đây là tham số sender, hàm appendMessage sẽ chuyển nó thành class 'is-user'
    appendMessage(ui.body, msg, "user");

    ui.input.value = "";
    if (suggestionBox) suggestionBox.classList.add("hidden");

    // Hiển thị typing
    const typingId = showTyping(ui.body);

    try {
      // Gọi song song DB và API
      const [dbRes, apiRes] = await Promise.all([
        supabase.from("chat_messages").insert({
          user_id: currentUser.id,
          content: msg,
          is_bot: false,
        }),
        callEdgeFunction("chat-bot", {
          method: "POST",
          body: { message: msg },
        }),
      ]);

      removeTyping(typingId);

      // Xử lý phản hồi Bot
      if (apiRes.error) {
        appendMessage(ui.body, "⚠️ Lỗi kết nối Gà Bông.", "bot");
      } else if (apiRes.data && apiRes.data.reply) {
        appendMessage(ui.body, apiRes.data.reply, "bot");
      } else {
        appendMessage(ui.body, "Gà Bông chưa hiểu ý bạn.", "bot");
      }
    } catch (err) {
      removeTyping(typingId);
      console.error(err);
      appendMessage(ui.body, "⚠️ Lỗi hệ thống.", "bot");
    } finally {
      isSending = false;
      setTimeout(() => {
        ui.input.focus();
        scrollToBottom(ui.body);
      }, 100);
    }
  };

  ui.send.onclick = () => window.handleSend();
  ui.input.onkeypress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.handleSend();
    }
  };
}

// --- UI RENDER FUNCTIONS (ĐÃ SỬA KHỚP VỚI CSS) ---

function appendMessage(container, text, sender) {
  if (!container) return;

  // 1. Tạo Row
  const row = document.createElement("div");

  // [SỬA LỖI QUAN TRỌNG]: Đồng bộ tên class với CSS
  // Nếu sender là 'user' -> class="chat-row is-user"
  // Nếu sender là 'bot'  -> class="chat-row is-bot"
  const modifier = sender === "user" ? "is-user" : "is-bot";
  row.className = `chat-row ${modifier}`;

  // 2. Tạo Bubble
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";

  // 3. Format Text
  let safeText = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  bubble.innerHTML = safeText;

  row.appendChild(bubble);
  container.appendChild(row);
  scrollToBottom(container);
}

function showTyping(container) {
  if (!container) return;
  const id = "typing-" + Date.now();
  const row = document.createElement("div");
  row.id = id;
  // Bot đang nhập -> is-bot
  row.className = "chat-row is-bot";

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.style.background = "transparent";
  bubble.style.fontStyle = "italic";
  bubble.style.color = "#999";
  bubble.style.padding = "0 10px";
  bubble.innerText = "Đang nhập...";

  row.appendChild(bubble);
  container.appendChild(row);
  scrollToBottom(container);
  return id;
}

function removeTyping(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom(container) {
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  }
}

async function loadChatHistory(container) {
  if (!container) return;

  if (!container.hasChildNodes()) {
    container.innerHTML =
      '<div style="text-align:center; color:#aaa; padding:20px; font-size:13px;">Đang tải...</div>';
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  container.innerHTML = ""; // Xóa loading

  if (!error && data && data.length > 0) {
    data.forEach((msg) => {
      // DB lưu 'is_bot' là boolean (true/false)
      // Chuyển đổi sang string 'bot'/'user' để hàm appendMessage xử lý
      const sender = msg.is_bot ? "bot" : "user";
      appendMessage(container, msg.content, sender);
    });
  } else {
    appendMessage(
      container,
      "Chào bạn! Mình là Gà Bông 🐣. Bạn cần tìm phòng trọ ở đâu?",
      "bot"
    );
  }
  scrollToBottom(container);
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
