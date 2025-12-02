/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V12 - ĐỒNG BỘ CLASS JS <-> CSS)
   ======================================= */

// Log kiểm tra phiên bản
console.log("✅ Chatbox V12 Loaded: Sync Fixed");

let currentUser = null;
let isSending = false;

const SUGGESTED_QUESTIONS = [
  "Cách đăng tin cho thuê?",
  "Tìm phòng dưới 2 triệu",
  "Chính sách tìm người ở ghép?",
  "Khu vực nào gần ĐH Cần Thơ?",
];

async function initializeChatbox() {
  const chatWidget = document.getElementById("chat-widget");
  if (!chatWidget) return;

  // Mapping UI Elements
  const ui = {
    toggleBtn: document.getElementById("chat-toggle"),
    chatBox: document.getElementById("chat-box"),
    closeBtn: document.getElementById("chat-close"),
    sendBtn: document.getElementById("send-btn"),
    chatInput: document.getElementById("chat-input"),
    chatBody: document.getElementById("chat-body"),
  };

  // Thêm vùng gợi ý
  let suggestionBox = document.getElementById("suggestion-box");
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestion-box";
    suggestionBox.className = "hidden";
    const footer = document.querySelector(".chat-footer");
    if (footer) ui.chatBox.insertBefore(suggestionBox, footer);
  }

  // 1. Check Auth
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user;

  if (!currentUser) {
    ui.chatBody.innerHTML = `
      <div style="text-align: center; margin-top: 60px; color: #666;">
        <p>Vui lòng đăng nhập để chat 🐣</p>
        <a href="/login.html" class="btn btn-primary btn-sm" style="margin-top:10px;">Đăng nhập ngay</a>
      </div>
    `;
    ui.chatInput.disabled = true;
    ui.sendBtn.disabled = true;
  } else {
    await loadChatHistory(ui.chatBody);
    renderSuggestions();
  }

  // 2. Events
  ui.toggleBtn.onclick = () => {
    ui.chatBox.classList.toggle("hidden");
    if (!ui.chatBox.classList.contains("hidden") && currentUser) {
      setTimeout(() => {
        ui.chatInput.focus();
        scrollToBottom(ui.chatBody);
      }, 150);
    }
  };

  ui.closeBtn.onclick = () => ui.chatBox.classList.add("hidden");

  // 3. Handle Send (Core Logic)
  window.handleSend = async (text = null) => {
    const msg = text || ui.chatInput.value.trim();

    if (!msg) return;
    if (!currentUser) {
      alert("Phiên đăng nhập hết hạn.");
      return;
    }
    if (isSending) return;
    isSending = true;

    // --- A. UI UPDATE (Vẽ ngay lập tức) ---
    // Tham số thứ 2 là 'user' -> Hàm appendMessage sẽ đổi thành class 'is-user'
    appendMessage(ui.chatBody, msg, "user");

    ui.chatInput.value = "";
    if (suggestionBox) suggestionBox.classList.add("hidden");

    const typingId = showTyping(ui.chatBody);

    try {
      // --- B. Process: Save DB & Call AI ---
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

      // --- C. Handle Response ---
      if (apiRes.error) {
        appendMessage(ui.chatBody, "⚠️ Lỗi kết nối Gà Bông.", "bot");
      } else if (apiRes.data && apiRes.data.reply) {
        appendMessage(ui.chatBody, apiRes.data.reply, "bot");
      } else {
        appendMessage(ui.chatBody, "Gà Bông chưa hiểu ý bạn.", "bot");
      }
    } catch (err) {
      removeTyping(typingId);
      console.error(err);
      appendMessage(ui.chatBody, "⚠️ Lỗi hệ thống.", "bot");
    } finally {
      isSending = false;
      setTimeout(() => ui.chatInput.focus(), 100);
    }
  };

  ui.sendBtn.onclick = () => window.handleSend();
  ui.chatInput.onkeypress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.handleSend();
    }
  };
}

// --- UI RENDER FUNCTIONS (SỬA LẠI ĐỂ KHỚP CSS) ---

function appendMessage(container, text, sender) {
  if (!container) return;

  // 1. Tạo Wrapper Row
  const row = document.createElement("div");

  // [FIX]: Chuyển đổi "user" -> "is-user", "bot" -> "is-bot"
  // Để khớp với CSS .chat-row.is-user
  const modifier = sender === "user" ? "is-user" : "is-bot";
  row.className = `chat-row ${modifier}`;

  // 2. Tạo Bubble
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";

  // 3. Format Text
  let formatted = text
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  bubble.innerHTML = formatted;

  // 4. Append
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
  bubble.style.color = "#888";
  bubble.style.fontStyle = "italic";
  bubble.style.border = "none"; // Xóa viền cho đẹp
  bubble.innerText = "Đang nhập...";

  row.appendChild(bubble);
  container.appendChild(row);
  scrollToBottom(container);
  return id;
}

function removeTyping(id) {
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
      // [FIX]: Chuyển boolean is_bot thành string 'bot'/'user'
      const sender = msg.is_bot ? "bot" : "user";
      appendMessage(container, msg.content, sender);
    });
  } else {
    appendMessage(
      container,
      "Chào bạn! Mình là Gà Bông 🐣. Bạn muốn tìm phòng trọ ở khu vực nào?",
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
