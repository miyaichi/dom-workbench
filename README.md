# DOM Workbench

DOM Workbench is a Chrome extension designed to simplify DOM operations on web pages. It offers features such as screen capturing of selected DOM elements, adding comments, editing computed styles, and sharing annotated captures in PDF or PPT formats.

## Features

- **Select and Display DOM Elements**: Easily select DOM elements and view their information.
- **Screen Capture with Annotations**: Capture selected elements and add comments directly.
- **Edit Computed Styles**: Modify the computed styles of elements in real-time.
- **Share Captures**: Export annotated captures as PDF or PPT files for sharing.
- **Intuitive Side Panel UI**: Navigate and operate through a user-friendly side panel interface.

## Technology Stack

- **Language**: TypeScript
- **Library/Framework**: React
- **Tools**: Webpack, PostCSS

## Installation and Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/miyaichi/dom-workbench.git
   ```
2. **Install Dependencies**
   ```bash
   cd dom-workbench
   npm install
   ```
3. **Build the Extension**
   ```bash
   npm run build
   ```
4. **Load the Extension into Chrome**
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked" and select the `dist` directory from the project.

## Usage

1. Click the DOM Workbench extension icon to open the side panel.
2. Use the DOM selector tool to click on the element you wish to select.
3. Utilize the screen capture tool to capture the selected element.
4. Add comments or edit computed styles as needed.
5. Share your annotated capture by exporting it as a PDF or PPT file.

## Directory Structure

```plaintext
├── assets/
│   └── fonts/                   # Font files
├── dist/                        # Compiled files (git ignored)
├── node_modules/                # Node modules (git ignored)
├── public/
│   └── sidepanel.html           # Side panel HTML
├── src/
│   ├── background.ts            # Background script
│   ├── components/
│   │   ├── utils/               # Component-specific utilities
│   │   │   └── htmlTagFormatter.tsx # HTML tag formatting utility
│   │   ├── DOMSelector.css
│   │   ├── DOMSelector.tsx      # DOM selector component
│   │   ├── SettingPanel.css
│   │   ├── SettingPanel.tsx     # Settings panel component
│   │   ├── ShareCapture.css
│   │   ├── ShareCapture.tsx     # Share capture component
│   │   ├── TagInjection.css
│   │   └── TagInjection.tsx     # Tag injection component
│   ├── contentScript.ts         # Content script
│   ├── lib/
│   │   ├── connectionManager.ts # Connection manager
│   │   ├── logger.ts            # Logger utility
│   │   ├── settings.ts          # Settings management
│   │   ├── shareAsPDF.ts        # PDF export functionality
│   │   └── shareAsPPT.ts        # PPT export functionality
│   ├── sidepanel/
│   │   ├── App.css
│   │   ├── App.tsx              # Side panel application
│   │   └── index.tsx
│   ├── styles/
│   │   └── common.css           # Common styles
│   └── utils/                   # General utilities
│       ├── domSelection.ts      # DOM selection utility
│       ├── download.ts          # Download utility
│       └── formatter.ts         # Formatter utility
├── .gitignore                   # Git ignore file
├── .prettierrc                  # Prettier configuration
├── custom.d.ts                  # Custom type definitions
├── LICENSE                      # License file
├── manifest.json                # Chrome extension manifest
├── package-lock.json            # NPM lock file
├── package.json                 # NPM configuration
├── postcss.config.js            # PostCSS configuration
├── README.md                    # Readme file
├── tsconfig.json                # TypeScript configuration
└── webpack.config.js            # Webpack configuration
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## Contact

For questions or feedback, please open an issue on the [GitHub repository](https://github.com/miyaichi/dom-workbench/issues).
