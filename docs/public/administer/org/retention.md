---
title: Retention
slug: administer/org/retention
section: administer
audience: admin
status: written
release: shipped
updated: v4.6
covers: [A46, E23, router:retention]
summary: >-
  Retention policies and legal holds in org admin: archive or delete documents on a schedule you
  preview first, and stop chosen documents from being deleted at all.
reviewed: 2026-10-14
---

Retention arrived in v4.5. **Scheduled sweeps are off by default:** until your operator turns them on, no policy archives or queues anything, and documents stay in the Library until someone deletes them. Preview and legal holds work either way.

## What Retention is for

Retention answers two questions for an organisation's shared Library:

- **How long do we keep a kind of document, and what happens after that?** A *policy* archives it, queues it for deletion, or lists it for a person to decide.
- **Which documents must not be deleted, by anyone, while a matter is open?** A *legal hold* stops every delete, by a person or by a policy, until an org admin releases it.

Everything lives in **Org admin → Retention**, which has four tabs: **Policies**, **Legal holds**, **Waiting for you** and **History**. A line at the top shows when the last sweep ran, when the next one is due, and how many policies and active holds there are.

## Who can do what

- **Org admins** create and change policies, place and release holds, confirm deletions and un-archive documents.
- **Members** cannot create or change a policy or a hold. The server refuses the request, whatever screen it comes from. A member sees that a document is held, and reads **"On legal hold. Ask an org admin."** in its detail panel. A member is never shown the matter's name, the reason or who placed it.

## Policies

A policy covers **one folder** (optionally with its subfolders) **or one document type**, never both. To cover both, make two policies.

Each policy says:

- **Keep for** a number of days, months or years.
- **Counted from** either *the document date* or *the day it was added to the Library*.
- **Then**: *archive it*, *delete it*, or *ask a person to decide*.
- Optionally, for an archive policy: **Then queue it for deletion** after a longer period, counted from the same date. The delete step must come after the archive step.

### Preview before Save

A policy cannot be saved until you have previewed it. **1 · Preview what this would do** lists the exact documents tonight's sweep would act on, by name, and the ones it would skip:

- documents **on legal hold**;
- documents that **can't be decided**: the policy counts from the document date and the document has none, or two policies disagree about it. Nothing happens to them;
- documents an admin chose to keep;
- documents **not due yet**, with the next due date.

If you change the policy after the preview, Save locks again until you preview the new version.

## The nightly sweep

When scheduled sweeps are on, the sweep applies every saved policy once a night:

- **Archive happens on its own.**
- **Deletes never run on their own.** A document due for deletion is put in **Waiting for you**.
- Documents for a person to decide are listed there too.

If the sweep cannot read everything it needs for a policy, it changes nothing for that policy and says so in the top line. A partial read never archives or queues anything.

**Scheduled sweeps are off until your operator turns them on.** While they are off, the top line reads *"Scheduled sweeps are off. Nothing is archived or queued until they are turned on. Preview still works."* Preview works either way, so you can see what the first sweep would do before it ever runs.

## Waiting for you

Deletes wait here, one batch per policy, with every document named. Untick any document to keep it. A kept document is not proposed again unless the policy is edited or the document changes.

To confirm, **type the number of documents** and press **Delete N documents permanently**. Every document is checked again at that moment. Anything put on hold, moved or edited since the sweep is dropped, not deleted, and the result names it.

A confirmed delete removes the document completely: every version, its search index and its stored file. **There is no undo.** The record of the delete is kept (see History).

## Legal holds

A hold has a **matter name** and a **reason**, and covers folders, documents, or both.

- A held document cannot be deleted by anyone, through any door: the Library, a folder delete, a watched-source purge, or a policy. The refusal is a sentence that says why, never a greyed-out button.
- A held **folder** also holds everything added to it later. A document moved out of a held folder stays held.
- Before you place it, the dialog counts how many documents the hold covers today.
- **Release hold…** tells you how many documents will no longer be protected. Documents still covered by another hold stay held.

## What "archived" means

An archived document:

- **is no longer used in chat answers**, by any search the assistant runs;
- **stays in the Library**: hidden in folders behind a line such as *"3 archived documents hidden · Show"*, and listed in Find when **Include archived** is on;
- **still opens and downloads** as normal.

An org admin can **Un-archive** a document from its detail panel. The policy then skips it until the policy or the document changes.

## History

Every action writes one record: archived, queued, deleted, did not delete, kept, un-archived, hold placed, extended or released, policy saved or removed, and every refused delete. Each names the document, the policy or matter, who did it and when. The record outlives the document it describes, and the person who approved it.

## Known limits

- **Private documents are not covered.** A policy or a hold reaches only documents shared with the organisation. Preview tells you how many private documents a policy does not reach. A hold on a named person's private documents is not available.
- **Re-uploading an archived file** finds the archived copy as a duplicate, so nothing new appears in chat. Un-archive it instead.
- **A watched source can bring a deleted file back.** If the file still exists in a watched Google Drive folder and changes there, the next sync can add it again.
- **Archiving a large share of the Library** can make some searches return fewer passages than usual. Your operator can turn on the iterative search setting (`hnsw_iterative_scan`) to fill them.
- Retention covers Library documents only. Chat messages, attachments and files made in chat are not covered.

## What retention does not remove

Retention deletes Library documents and their stored files. It does not remove chat history. If the assistant quoted a document in a reply, or showed a chart or table built from it, that reply and that chart stay in the conversation until the thread is deleted, or the account is.

A chart or table whose source document has been deleted keeps naming that file in its caption, as plain text. The caption is not a link, and nothing opens from it.

## Related

- [Org audit](/docs/administer/org/audit)
- [Finding a document](/docs/use/library/find)
- [Changelog: v4.5](/docs/changelog/v4.5)
