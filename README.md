# Chrome Extension – Page Summarizer (ChatGPT / Claude / DeepSeek)

Chrome extension that reads the current page’s visible text and generates a summary using either:

- OpenAI (ChatGPT) API, or
- Anthropic (Claude) API
- DeepSeek API

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this project folder (`myextension`)

The extension icon will appear in the toolbar. Click it to see:

- The current tab title / URL
- A **Summarize** button that generates a summary in the popup

## Privacy

- Your API keys are stored in `chrome.storage.local` on your device.
- Page text is sent to the selected provider only when you click **Summarize**.

## Setup

1. Load the extension (see installation above)
2. Open extension options to set your API key:
   - `chrome://extensions/` → your extension → **Details** → **Extension options**
3. Select your provider (ChatGPT/OpenAI or Claude/Anthropic)
4. Paste the corresponding API key and click **Save**

## Files

- `manifest.json` – extension configuration (Manifest V3)
- `background.js` – calls the selected provider API (OpenAI or Anthropic)
- `popup.html` – popup UI (summarize + summary output)
- `popup.css` – styles
- `popup.js` – reads current page text and shows the summary
