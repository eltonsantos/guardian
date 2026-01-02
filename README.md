# Guardian (Chrome Extension)

Guardian is a local content-blocking extension for Google Chrome.

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder (`guardian/`)

## What it does

- Blocks navigation by:
  - Exact domains (e.g., xvideos.com)
  - Subdomains (e.g., *.xvideos.com)
  - URL keyword matches (e.g., onlyfans, xxx)
- Provides a local blocked page
- Offers password-protected settings (with offline recovery)

## Notes

- Not a VPN / not system-wide.
- Data is stored locally via `chrome.storage.local`.
