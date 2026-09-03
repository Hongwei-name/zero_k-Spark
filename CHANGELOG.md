# Changelog

## 1.0.8 - 2026-09-03

- Match the verified Douyin message entry (`data-e2e="something-button"`) by its visible “消息” label instead of relying only on the outdated `im-entry` identifier.
- Match the verified red send SVG (`messageMsgInputpublishBtn`, `e2e-send-msg-btn`) directly, including layouts where it is outside the `im-dialog` wrapper.

## 1.0.7 - 2026-09-03

- Automatically open the Douyin message drawer and, when necessary, return from an open chat to the conversation list before locating targets.
- Require the visible chat header to match the selected recipient before any message action; an input box alone no longer passes verification.
- Use the browser's native editable-content path only, preventing text that appears in the editor but is treated as an empty message by Douyin.
- Send through the interactive send-control container and show each open, write, readiness, and send stage in the panel status.

## 1.0.6 - 2026-09-03

- Restrict friend discovery to actual conversation rows inside the Douyin message drawer.
- Exclude page navigation, download cards, and footer content from the friend list.
- Cancel a send when the message text cannot be confirmed in the editor, preventing blank-message clicks.
- Clarify the Dry Run switch and its successful verification status.

## 1.0.5 - 2026-09-03

- Send messages through the verified SVG send control using native pointer and mouse events.
- Use the browser's native text insertion path for the Slate message editor and normalize its zero-width placeholder before confirming send success.

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
