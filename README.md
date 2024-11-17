# chrome-extension-prototype-1
Prototype of a chrome extension using side panel.

# Directory Structure

```
├── dist/                        # Compiled files (git ignored)
├── node_modules/                # Node modules (git ignored)
├── public/
│   └── sidepanel.html
├── src/
│   ├── background.ts
│   ├── contentScript.ts
│   ├── lib/
│   │   └── connectionManager.ts
│   ├── sidepanel/
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── styles/
│       └── globals.css
├── manifest.json
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── webpack.config.js
```