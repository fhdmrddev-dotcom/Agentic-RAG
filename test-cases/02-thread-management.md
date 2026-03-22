# TC-02: Thread Management

## TC-02-01 — New chat starts blank

**GIVEN** I am signed in and no thread is selected
**WHEN** I look at the main area
**THEN**
- The welcome message ("How can I help you?") is visible
- The message input is present with General mode active
- No messages are shown

---

## TC-02-02 — Thread is auto-created on first message

**GIVEN** no thread is selected (welcome screen)
**WHEN** I type a message and press Send
**THEN**
- A new thread appears in the sidebar
- The message is sent and a response streams back
- The thread is selected and highlighted in the sidebar

---

## TC-02-03 — Thread auto-naming (General mode)

**GIVEN** a brand new thread with no messages
**WHEN** I send the first message (e.g., "What is machine learning?")
**THEN**
- After the response completes, the thread title in the sidebar updates from "New Chat" to a 4–6 word LLM-generated title
- The title is relevant to the message content

---

## TC-02-04 — Thread auto-naming (Explorer mode)

**GIVEN** a brand new thread with Explorer mode active
**WHEN** I send the first message (e.g., "Show me my folder structure")
**THEN**
- After the response completes, the thread title updates automatically
- Auto-naming works the same as General mode

---

## TC-02-05 — Thread switching preserves history

**GIVEN** two threads, each with messages
**WHEN** I click between threads in the sidebar
**THEN**
- Each thread shows its own message history
- No cross-contamination between threads

---

## TC-02-06 — Thread switching resets agent mode

**GIVEN** Explorer mode is active in the current thread
**WHEN** I click a different thread (or click New Chat)
**THEN**
- The mode selector returns to "General"
- The new thread starts in General mode by default

---

## TC-02-07 — Rename thread

**GIVEN** an existing thread in the sidebar
**WHEN** I hover over it, click the `...` menu, and select Rename
**THEN**
- An inline text input appears pre-filled with the current title
- I can edit the title and press Enter to save
- The new title appears in the sidebar immediately

---

## TC-02-08 — Delete thread

**GIVEN** an existing thread with messages
**WHEN** I hover over it, click `...`, and select Delete
**THEN**
- The thread is removed from the sidebar
- All its messages are deleted (cascade)
- If it was selected, the main area returns to the welcome screen

---

## TC-02-09 — Thread list ordering

**GIVEN** multiple threads
**WHEN** I send a message in an older thread
**THEN**
- That thread moves to the top of the sidebar list (sorted by updated_at desc)
