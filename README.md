# DOM Workbench

DOM Workbench is a Chrome extension designed to simplify DOM operations on web pages. It provides a powerful side panel interface for DOM element inspection, manipulation, and capture sharing capabilities.

## Features

### DOM Selection and Navigation
- **Interactive DOM Element Selection**: Click to select any DOM element on the page
- **DOM Path Display**: View the full DOM path of selected elements
- **Parent Navigation**: Easily navigate to parent elements using the dedicated button
- **DOM Tree View**: Visualize and interact with the DOM structure

### Element Manipulation
- **Tag Injection**:
  - Inject custom HTML tags into selected elements
  - Real-time HTML tag validation
  - Safe injection with dangerous element checking
  - Add or remove injected tags dynamically

### Screen Capture and Sharing
- **Element Capture**: Take screenshots of selected DOM elements
- **Annotation Support**: Add comments to captured elements
- **Multiple Export Formats**: Share captures as PDF or PPT
- **Contextual Information**: Automatically includes:
  - Page URL
  - DOM path
  - Element tag information
  - Applied style modifications

### Style Management
- **Style Modifications**: Track and display style changes applied to elements
- **Style Preview**: See style changes in real-time
- **Style History**: Keep track of all style modifications

### Configuration
- **Customizable Settings**:
  - Log Level configuration (Error, Warning, Info, Debug)
  - Share Format preference (PDF/PPT)
- **Persistent Settings**: Settings are saved and maintained between sessions

## Technology Stack

- **Language**: TypeScript
- **Framework**: React with Hooks
- **UI Components**: 
  - Custom Card components
  - Tooltips
  - Modal dialogs
  - Tree views
- **Icons**: Lucide React icons
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
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

## Directory Structure

```plaintext
├── assets/
│   └── fonts/                   # Font files for PDF creation
├── dist/                        # Compiled files (git ignored)
├── node_modules/                # Node modules (git ignored)
├── public/
│   └── sidepanel.html           # Side panel HTML
├── src/
│   ├── background.ts            # Background script
│   ├── contentScript.ts         # Content script
│   ├── sidepanel                # Side panel
│   ├── components/              # React components
|   |   |  ├── common/           # Common components
|   |   |  └── utils/            # Utility components
│   │   ├── DOMSelector.tsx      # DOM selection interface
│   │   ├── SettingPanel.tsx     # Settings configuration
│   │   ├── ShareCapture.tsx     # Capture sharing modal
|   |   ├── StyleEditor.tsx      # Style modification interface
│   │   └── TagInjection.tsx     # HTML tag injection
│   ├── lib/                     # Core utilities
│   └── utils/                   # Helper functions
└── [Other configuration files]
```

## Usage Guide

1. **DOM Selection**
   - Click the DOM Workbench extension icon to open the side panel
   - Use the DOM selector to click and select page elements
   - Navigate the DOM hierarchy using the parent navigation button
   - View detailed element information in the DOM tree view

2. **Tag Injection**
   - Select a target element
   - Enter valid HTML in the tag injector
   - Click "Inject" to add the tag
   - Use "Remove" to revert changes

3. **Screen Capture and Sharing**
   - Select an element to capture
   - Add comments in the capture modal
   - Choose between PDF or PPT export format
   - Share the annotated capture with included context

4. **Settings Configuration**
   - Adjust log levels for debugging
   - Set preferred sharing format
   - Access settings through the settings panel

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Submit a pull request

## Contact

For questions or feedback, please open an issue on the [GitHub repository](https://github.com/miyaichi/dom-workbench/issues).