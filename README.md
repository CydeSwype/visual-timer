# Timer Application

A keyboard-first productivity timer with task management and gamification features.

Available as both a **browser extension** and a **desktop application** (Electron).

## Features

### Core Timer Functionality
- Pomodoro-style timer with visual progress bar
- Keyboard shortcuts for quick control
- Audio notifications when timer completes
- Pause/resume functionality

### Task List Management
- Add tasks with time estimates (format: "25 - Write report")
- Start timers directly from task list
- Automatically proceed to next task
- Task summary with total time estimates

### 🎮 Gamification System (NEW!)
- **Points System**: Earn 1 point for every minute a task timer is running
- **Streak Tracking**: Maintain consecutive days with sufficient points
- **Customizable Goals**: Adjust daily point threshold in settings (default: 100)
- **Visual Feedback**: See real-time points and streak status
- **Activity Indicator**: Lightning bolt (⚡) shows when points are being earned

#### How Points Work
- Points are only earned when running timers from the Task List (not manual timers)
- Timer must be actively running (not paused or expired)
- 1 point = 1 minute of focused work time
- Points are automatically saved and tracked daily

#### Streak System
- A streak day requires earning at least your set threshold of points
- Streak counts consecutive days meeting the threshold
- Customize the threshold in Settings to match your productivity goals
- Current streak is displayed with a fire emoji (🔥)

## Keyboard Shortcuts
- **Space** or **P**: Pause/Resume timer
- **1-999**: Set timer for specified minutes (press Enter to start)
- **R**: Restart current timer
- **T**: Open/close task view
- **?**: Toggle settings panel  
- **>**: Mark current task complete and begin next task
- **Escape**: Close any open panels

## Settings
- Audio notification on/off
- Custom notification sound
- Timer progress bar color
- **Daily points threshold** for streak calculation

## Getting Started
1. Press **T** to open the task list
2. Add tasks in format: "duration - description" (e.g., "25 - Review code")
3. Click "start" on a task to begin earning points
4. Watch your points and streak grow in the gamification panel
5. Adjust settings with **?** to customize your experience

The gamification system encourages consistent use of the task list mode, helping build productive habits through points and streak tracking!

# demo
http://www.yawmp.com/timer/

## Building and Running

This project supports both browser extension and desktop app builds from a single codebase.

### Project Structure

```
keytimer/
├── src/              # Shared source code (HTML, CSS, JS, assets)
├── extension/        # Browser extension specific files
├── desktop/          # Electron desktop app files
└── scripts/          # Build scripts
```

### Browser Extension

#### Development

1. Package the extension:
```bash
npm run package:extension
```

2. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/extension` directory

#### Files Included
- `manifest.json` - Extension manifest
- `background.js` - Service worker for extension
- All shared files from `src/`

### Desktop Application (Electron)

#### Prerequisites

Install dependencies:
```bash
npm install
```

#### Development

Run the desktop app in development mode:
```bash
npm start
# or
npm run dev:desktop
```

#### Building for Production

Build for your current platform:
```bash
npm run build:desktop
```

Build for specific platforms:
```bash
npm run build:desktop:mac      # macOS (DMG, ZIP)
npm run build:desktop:win      # Windows (NSIS installer, ZIP)
npm run build:desktop:linux    # Linux (AppImage, DEB)
```

Built applications will be in the `dist/` directory.

### Shared Code

The core application logic in `src/` is shared between both platforms:
- `index.html` - Main UI
- `main.js` - Timer logic and functionality
- `styles.css` - Styling
- `assets/` - Icons and images
- `ding.mp3` - Default notification sound

The only platform-specific code is:
- **Extension**: `extension/background.js` (Chrome extension service worker)
- **Desktop**: `desktop/main.js` (Electron main process)
