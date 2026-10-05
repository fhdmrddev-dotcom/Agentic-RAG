---
title: Attaching files to a chat
slug: use/attachments
section: use
audience: user
status: written
release: shipped
covers: [A7]
summary: >-
  A file you attach in a chat belongs to that chat only: Syrel reads it there, it lasts as long as
  the chat, and it never appears in your Library or in document search. Save to Library copies it
  into a folder you choose when you want to keep it.
reviewed: 2026-10-05
---

A file you attach in a chat belongs to that chat. Syrel can read it while you talk, but it is not added to your Library, it is not indexed, and document search and other chats cannot find it.

## Attaching a file

Choose **+** in the composer, then:

- **Attach a file** to pick one from your computer, or
- **From cloud storage** to pick one from a connected source, such as a Google Drive connection.

The file appears as a chip above the composer and is sent with your next message. The chip says **this chat only**. You can attach text, Markdown, CSV, JSON and code files, Word, PowerPoint and Excel files, PDFs and images, up to 10 MB each. If a file is refused, Syrel shows the reason.

## What Syrel does with it

Syrel reads an attached file directly in the chat, using its code tools for spreadsheets, documents, slides, PDFs and images. Ask about it the way you would ask about anything else, for example *"What is the renewal date in the contract I attached?"*

The file stays private to the chat:

- It is **not in your Library**. It does not appear in any folder.
- It is **not found by document search**, and Syrel's knowledge-base search does not return it.
- **Other chats cannot see it.** Ask the same question in a different chat and Syrel will not know the answer.

## How long it lasts

An attached file lasts as long as the chat. It does not expire after a day. If you delete the chat, its attached files are deleted with it.

Files that a workflow uses as a template are different: they still expire after 24 hours.

## Keeping a file: Save to Library

When you want to keep an attached file, or make it searchable for future chats, save a copy to your Library:

1. Open the file's **⋯** menu. It is on the file's chip in the conversation, and on the file's row in the **Files** list of the workspace panel.
2. Choose **Save to Library…**.
3. Pick a folder. Type part of a name to search; folders are shown with their full path. There is no "top of the Library" option, so **Save to Library** stays disabled until you choose a folder.
4. Choose **Save to Library**.

The copy goes into the folder you picked, and the file also stays in the chat. The chip then reads **In Library ·** followed by the folder name, and says **indexing…** until the Library has finished processing the copy. Select that mark to open the document in the Library. In the workspace panel, the file's row shows the folder's full path.

Before you save, Syrel tells you what will happen:

- **The folder already has a file with that name.** Syrel warns you that saving makes a new version, and that the earlier version stays in the document's history.
- **The same file is already in your Library.** Nothing new is saved. Syrel says **Already in your Library** and names the folder where the existing copy is. If that is not the folder you picked, it says so; the existing copy is not moved. You can open it from there.
- **The Library does not accept this file type.** **Save to Library…** is unavailable on the menu, and the reason is shown.
- **You cannot save into the folder you picked.** The Library's own reason is shown, and you can pick another folder.

## Deleting a chat

Deleting a chat removes the files attached to it. A copy you saved to the Library is **not** affected: it stays in its folder, and you can still open and download it.

## Adding files to the Library directly

The chat composer never adds files to your Library. To add documents to the Library, upload them on the Library page, or set up a connection that brings files into a Library folder. See [Chatting with Syrel](/docs/use/chat) for the rest of the composer.
