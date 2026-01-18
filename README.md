# Guardian - Content Blocker

A powerful and private content blocking extension for Google Chrome. Block distracting websites and keywords locally with password-protected settings.

## Features

- **Domain Blocking** - Block entire websites and all their subdomains
- **Keyword Filtering** - Block any URL containing specific words or phrases
- **Password Protection** - Lock settings with a secure password to prevent unauthorized changes
- **Recovery Options** - Generate backup codes and a recovery phrase in case you forget your password
- **Quick Add** - Easily add new rules directly from the popup
- **Incognito Support** - Enforce blocking even in private browsing mode
- **Block Logs** - Track blocked attempts locally (URLs are obfuscated for privacy)
- **Allowlist** - Whitelist trusted domains that should never be blocked

## Privacy

- 100% Local Processing - All data stays on your device
- No Analytics - Zero tracking or data collection
- No External Servers - Works completely offline
- No Account Required - Just install and use

## Installation

### Developer Mode (Local)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `guardian/` folder

### Chrome Web Store

Coming soon...

## How It Works

1. **Setup** - Install Guardian and create a secure password
2. **Configure** - Add domains or keywords you want to block
3. **Protect** - Enable protection and browse distraction-free
4. **Manage** - Use your password to make changes or temporarily allow sites

## Security

- Password is hashed using PBKDF2 with 150,000 iterations
- Recovery codes are single-use and stored as SHA-256 hashes
- Settings cannot be changed without authentication when locked
- All data stored locally via `chrome.storage.local`

## Project Structure

```
guardian/
├── assets/           # Icons and wordlist
├── background/       # Service worker
├── blocked/          # Blocked page UI
├── options/          # Settings page
├── popup/            # Extension popup
├── shared/           # Shared utilities
└── manifest.json     # Extension manifest
```

## Notes

- This is a browser extension, not a VPN or system-wide filter
- Only blocks navigation in Chrome (and Incognito if enabled)
- Requires password setup on first install

## License

MIT
