# Changelog

## 1.0.4 - 2026-09-03

- Adapted the conversation row, chat title, message editor, and send-control selectors to the verified Douyin web message drawer.
- Dry Run now verifies the conversation, message editor, and send control without entering text or clicking send.

## 1.0.3 - 2026-09-03

- Open target conversations with simulated pointer interaction before each task.
- Verify that the chat is open from the visible chat title or message input, without requiring a selected-state marker on the conversation row.

## 1.0.2 - 2026-09-03

- Fixed checkbox sizing in the control panel.
- Confirm the selected conversation using either its active state or the visible chat title, instead of assuming a heading tag.
- Added `scripts/Release.ps1` to increment the Tampermonkey version consistently for future releases.

## 1.0.1 - 2026-09-03

- Fixed conversation discovery for current Douyin web message-list variants.
- Added a manual nickname or remark-name fallback when automatic discovery is unavailable.
- Added persistent drag-and-drop positioning for the control panel.
- Constrained the panel to the viewport so controls are not cut off on smaller windows.
- Tightened conversation-title validation and only record a message after the input is cleared.

## 1.0.0 - 2026-09-03

- Initial project structure and local Tampermonkey helper.
