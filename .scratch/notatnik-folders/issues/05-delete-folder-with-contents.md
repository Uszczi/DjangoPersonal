# 05: Delete a Folder with its contents

**What to build:** Deleting a Folder deletes the Whiteboards and Notatki in it. Before it does, the user confirms with a message that says how many items will go: "Usunąć folder „<name>” i N elementów w nim?". For an empty Folder the message is "Usunąć folder „<name>”?".

**Blocked by:** 03 (Whiteboards and Notatki inside Folders).

**Status:** done

- [x] Deleting a Folder deletes its items (database cascade). Loose items and other Folders' items are untouched.
- [x] Another user's Folder can't be deleted (404).
- [x] A delete button in the Folder's header asks for confirmation with the item count (Polish plural forms correct: 1 element / 2–4 elementy / 5+ elementów), or the short message for an empty Folder.
- [x] Cancelling leaves everything in place. Confirming removes the Folder and its items from the list without a reload.
- [x] Backend API tests cover the cascade and isolation. Frontend tests cover both confirmation texts, cancel and confirm. `just check` passes.
