---
title: Chatting with Syrel
slug: use/chat
section: use
audience: user
status: written
release: shipped
covers: [A5, A9, view:chat]
summary: >-
  Ask in the composer, watch Syrel work through its tools, read a cited answer, stop or resume a
  run, and hand a conversation on to a different Expert.
video: clip.chat
reviewed: 2026-10-04
---

Chat is where you spend most of your time in Syrel. Each chat is a separate conversation with its own history, files and scope.

![A Syrel chat with an Expert active: the answer, its confidence badge and references, and the workspace panel](/docs-assets/shots/chat.png)

## Starting a chat

Choose **New chat** at the top of the rail. Your chats are listed beside the conversation, grouped by date; press ⌘K (Ctrl+K) to find one by name.

## The composer

Type your question and press Enter. From the composer you can also:

- **Pick a model.** The model picker lists the models your organisation allows. If you pick a model that is not in Syrel's capability registry, the composer warns you, because some features may not work with it.
- **Choose General or Explorer.** General is the full agent. Explorer gives Syrel only the tools for browsing and reading your Library, and asks it to answer in plain prose. See [Deep mode and Workflow mode](/docs/use/chat-modes).
- **Attach a file** from your computer, or pick one from a connected service. See [Attaching files to a chat](/docs/use/attachments).
- **Limit the chat to a folder** with the scope chip. See [Limiting a chat to a folder](/docs/use/chat-scope).
- **Add a connected service** to the chat. Chips show which connections are active for the next message.
- **Invite an Expert.** See [Bringing an Expert into a chat](/docs/experts/using-experts).

## Watching Syrel work

While Syrel answers, the chat shows what it is doing in plain words, such as "Searching knowledge base…". Each tool it uses appears as a card in the run, with the tool's own details one click away: search results, the code it ran and its output, a file it read. The run shows a timer and a step counter, and the provider and model that produced the answer.

When the model reasons before it answers, a calm "thinking" line appears. Open it to read the reasoning as a timeline.

If Syrel needs a decision, it pauses and asks you — in the chat and in the workspace panel. A tool that is set to **Ask** on a connection also waits here for your approval before anything leaves Syrel.

## Reading the answer

- **Citations.** Claims taken from your documents carry numbered markers. Hover one to preview the passage; click it to pin the passage and highlight its row in the references under the answer.
- **Confidence.** Answers grounded in your documents carry a High, Medium or Low confidence badge. A low-confidence answer asks you to check the sources.
- **Follow-up suggestions.** Two or three suggested questions may appear under an answer. Click one to send it.
- **Feedback.** Rate any finished answer with thumbs up or down. A thumbs down asks why: wrong answer, not from my documents, incomplete or other.

## Stopping, resuming and refreshing

- **Stop** ends the run promptly and keeps the partial answer. A stopped answer still reads as stopped after you navigate away or reload.
- A run keeps going if you refresh, switch chats or open the same chat in another tab; you come back to the live answer.
- If a run reaches its time limit, the chat says "Agent reached time limit" and offers **Resume**.
- If a run pauses at its spending cap, the chat keeps the composer usable or offers the next action.
- If the model you picked is unavailable, Syrel falls back to another model and shows a notice naming both.

## Handing off to another Expert

A chat has one active Expert at a time. To ask a different Expert, start a new chat scoped to that Expert from the current one: Syrel writes a summary of the first chat and carries it over, and both chats record the handoff.

> **Note:** The handoff summary has been proven live on one AI provider. On some providers the summary can miss parts of its instructions; check it before you rely on it.

## The workspace panel

Files Syrel writes during a chat, its to-do list, helper tasks and pending questions appear in the panel on the right. See [The workspace panel](/docs/use/workspace-panel).
