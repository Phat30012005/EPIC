/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V2.2 - NO SYNTAX ERROR)
   ======================================= */

window.initializeChatbox = async function () {
  console.log("Chatbox V2.2 Initializing...");

  const ui = {
    toggleBtn: document.getElementById("chat-toggle"),
    chatBox: document.getElementById("chat-box"),
    closeBtn: document.getElementById("chat-close"),
    chatBody: document.getElementById("chat-body"),
    optionContainer: document.getElementById("option-buttons"),
    loadingIndicator: document.getElementById("loading-indicator"),
  };

  // Kiểm tra an toàn
  if (!ui.chatBox) {
    console.warn("⚠️ Không tìm thấy Chatbox UI");
    return;
  }

  let currentUser = null;
  let isProcessing = false;

  // 1. Kiểm tra đăng nhập
  try {
    const { data } = await supabase.auth.getSession();
    currentUser = data?.session?.user;
  } catch (err) {
    console.warn("Auth Error:", err);
  }

  // 2. Hiển thị giao diện ban đầu
  if (!currentUser) {
    ui.chatBody.innerHTML = `
        <div style="text-align: center; margin-top: 50px; color: #666;">
          <p>Xin chào! 👋</p>
          <p>Vui lòng đăng nhập để chat.</p>
          <a href="/login.html" class="btn btn-sm btn-primary" style="margin-top:10px;">Đăng nhập</a>
        </div>`;
    if (ui.optionContainer) ui.optionContainer.innerHTML = "";
  } else {
    // Nếu đã đăng nhập, tải lịch sử
    await loadChatHistory();
    // Nếu chưa có tin nhắn nào, gọi bước Start
    if (!ui.chatBody.hasChildNodes() || ui.chatBody.children.length === 0) {
      handleStep("start");
    }
  }

  // === SỰ KIỆN CLICK ===
  if (ui.toggleBtn) {
    ui.toggleBtn.onclick = () => {
      ui.chatBox.classList.toggle("hidden");
      scrollToBottom();
    };
  }

  if (ui.closeBtn) {
    ui.closeBtn.onclick = () => ui.chatBox.classList.add("hidden");
  }

  // === HÀM XỬ LÝ CHÍNH (Gửi yêu cầu lên Server) ===
  async function handleStep(stepId, userLabel = null) {
    if (isProcessing) return;
    isProcessing = true;

    // 1. Hiện tin nhắn người dùng chọn (nếu có)
    if (userLabel) {
      appendMessage(userLabel, "user");
      ui.optionContainer.innerHTML = ""; // Xóa nút cũ
    }

    // 2. Hiện loading
    if (ui.loadingIndicator) ui.loadingIndicator.classList.remove("hidden");

    try {
      // Gọi API chat-bot
      const { data, error } = await callEdgeFunction("chat-bot", {
        method: "POST",
        body: { step_id: stepId },
      });

      if (ui.loadingIndicator) ui.loadingIndicator.classList.add("hidden");

      if (error) {
        console.error("API Error:", error);
        appendMessage("⚠️ Lỗi kết nối server.", "bot");
        return;
      }

      // 3. Hiện tin nhắn Bot
      if (data && data.reply) {
        appendMessage(data.reply, "bot");
      }

      // 4. Hiện các nút chọn tiếp theo
      if (data && data.options) {
        renderOptions(data.options);
      }
    } catch (err) {
      console.error("System Error:", err);
      if (ui.loadingIndicator) ui.loadingIndicator.classList.add("hidden");
      appendMessage("⚠️ Lỗi hệ thống.", "bot");
    } finally {
      isProcessing = false;
      scrollToBottom();
    }
  }

  // === HÀM RENDER NÚT BẤM (Giao diện mới) ===
  function renderOptions(options) {
    ui.optionContainer.innerHTML = "";

    options.forEach((opt, index) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt.label;

      // Hiệu ứng xuất hiện lần lượt
      btn.style.animationDelay = `${index * 0.1}s`;

      // Gán sự kiện click
      btn.onclick = () => handleStep(opt.next_step, opt.label);

      ui.optionContainer.appendChild(btn);
    });

    setTimeout(scrollToBottom, 100);
  }

  // === CÁC HÀM HỖ TRỢ UI ===
  function appendMessage(text, sender) {
    const row = document.createElement("div");
    row.className = `chat-row ${sender === "user" ? "is-user" : "is-bot"}`;

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.innerHTML = text.replace(/\n/g, "<br>");

    row.appendChild(bubble);
    ui.chatBody.appendChild(row);
    scrollToBottom();
  }

  function scrollToBottom() {
    if (ui.chatBody) {
      ui.chatBody.scrollTop = ui.chatBody.scrollHeight;
    }
  }

  async function loadChatHistory() {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true });

    if (data) {
      data.forEach((msg) =>
        appendMessage(msg.content, msg.is_bot ? "bot" : "user")
      );
      // Luôn hiện nút Menu Chính khi load lại trang để user không bị cụt đường
      if (data.length > 0) {
        renderOptions([{ label: "🐣 Menu Chính", next_step: "start" }]);
      }
    }
  }
};
