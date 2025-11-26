# Pyke Dominator 🎣

<div align="center">

**A comprehensive League of Legends matchup analyzer and build optimizer for Pyke support players**

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](https://github.com/developer-az/pyke-dominator)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Usage](#usage)
- [Technical Details](#technical-details)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

---

## 🎯 Overview

**Pyke Dominator** is an intelligent desktop application designed to help League of Legends players optimize their Pyke support gameplay. The app analyzes enemy team compositions and provides:

- **Optimal item builds** based on enemy threats and team composition
- **Customized rune pages** tailored to specific matchups
- **Detailed matchup analysis** with strategic insights
- **2v2 damage comparisons** for bot lane scenarios
- **Automatic champion detection** via League Client API integration

Whether you're climbing ranked or improving your Pyke gameplay, Pyke Dominator provides data-driven recommendations to maximize your impact in every game.

---

## ✨ Features

### 🎮 Core Functionality

- **Smart Build Calculator**
  - Analyzes enemy team composition (Top, Jungle, Mid, Bot, Support)
  - Recommends optimal item builds based on threats (tanks, squishies, CC-heavy comps)
  - Suggests situational items (Edge of Night, Maw, Serpent's Fang, etc.)
  - Prioritizes items based on pro play meta and game state

- **Dynamic Rune Generator**
  - Automatically selects optimal rune pages for each matchup
  - Adapts secondary runes based on enemy composition (poke threats, CC, etc.)
  - Uses official Data Dragon API for up-to-date rune data
  - Provides explanations for each rune choice

- **Comprehensive Matchup Analysis**
  - **Bot Lane Matchup**: Detailed analysis of enemy ADC + Support
  - **Difficulty Rating**: EASY, MEDIUM, HARD, or VERY_HARD
  - **Strategic Insights**: Lane phase tips, all-in potential, key cooldowns
  - **Damage Analysis**: Pyke's all-in damage at levels 3, 6, and 6 with ult
  - **2v2 Damage Comparison**: Your bot lane vs enemy bot lane damage calculations

- **League Client Integration**
  - Automatically detects when you're in champion select
  - Auto-fills enemy team composition
  - Exports rune pages directly to League Client
  - Real-time updates during champion select

- **Modern UI/UX**
  - Beautiful dark theme with Pyke-inspired green accents
  - Searchable champion dropdowns with type-to-search
  - Responsive design (works on desktop and web)
  - Smooth animations and transitions
  - Professional, intuitive interface

---

## 📸 Screenshots

> **Note**: Add screenshots of your application here to showcase the UI and features.

---

## 🚀 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **League of Legends** client (for LCU integration)

### Desktop Application (Windows)

1. **Download the latest release**
   ```bash
   # Visit the Releases page and download the Windows installer
   # Or build from source (see Development section)
   ```

2. **Install and run**
   - Run the installer
   - Launch Pyke Dominator
   - The app will automatically connect to League Client when available

### Web Version

1. **Clone the repository**
   ```bash
   git clone https://github.com/developer-az/pyke-dominator.git
   cd pyke-dominator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build and preview**
   ```bash
   npm run build
   npm run preview
   ```

   The web version will be available at `http://localhost:4173`

---

## 💻 Usage

### Basic Usage

1. **Launch the application**
   - Desktop: Open Pyke Dominator
   - Web: Navigate to the web version

2. **Select enemy champions**
   - Use the searchable dropdowns to select enemy champions for each role
   - Type champion names to quickly filter and select
   - The app will automatically calculate builds and runes

3. **Select your ADC** (optional)
   - Choose your ADC in the "Your Team" section
   - This enables accurate 2v2 damage comparisons

4. **Review recommendations**
   - **Items**: Core items, situational items, and build path
   - **Runes**: Complete rune page with explanations
   - **Matchup Analysis**: Strategic insights and damage breakdowns

5. **Export runes** (Desktop only)
   - Click "Export Runes" when connected to League Client
   - Runes will be automatically imported into your League Client

### League Client Integration

The desktop app automatically connects to the League Client API when:
- League of Legends is running
- You're in champion select
- The app detects champion selections

**Note**: LCU integration requires League of Legends to be running and only works in champion select.

---

## 🔧 Technical Details

### Tech Stack

- **Frontend**: React 19.2, TypeScript 5.9
- **Build Tool**: Vite 7.2
- **Desktop**: Electron 39.2
- **Styling**: Tailwind CSS 3.4
- **Linting**: ESLint 9.39 with TypeScript support

### APIs Used

- **Data Dragon API**: Official Riot Games API for champion, item, and rune data
  - Champion data: `/cdn/{version}/data/en_US/champion.json`
  - Rune data: `/cdn/{version}/data/en_US/runesReforged.json`
  - Item/rune icons: `/cdn/{version}/img/{type}/{id}.png`

- **League Client API (LCU)**: Local API for League Client integration
  - Champion select detection: `/lol-champ-select/v1/session`
  - Rune page export: `/lol-perks/v1/pages`

### Architecture

```
pyke-dominator/
├── electron/          # Electron main process and LCU connector
├── src/
│   ├── components/   # React components (BuildDisplay, ChampionSelect)
│   ├── data/         # API services (championService, runeService)
│   ├── logic/        # Core business logic (pykeLogic.ts)
│   └── App.tsx       # Main application component
├── dist/             # Built web assets
└── dist-electron/    # Built Electron files
```

### Key Features Implementation

- **Build Logic**: Analyzes enemy composition and recommends items based on:
  - Tank count (Umbral Glaive priority)
  - Squishy targets (Voltaic Cyclosword for burst)
  - CC threats (Edge of Night, Mercury Treads)
  - Magic damage (Maw of Malmortius)
  - Pro play meta considerations

- **Rune Logic**: Dynamically selects runes based on:
  - Enemy poke threats (Second Wind vs Sixth Sense)
  - CC composition (Unflinching)
  - Team composition analysis

- **Damage Calculations**: Estimates Pyke's damage at different levels:
  - Level 3 combo (Q + E + autos)
  - Level 6 combo (full rotation)
  - Level 6 with ultimate (execute threshold)

---

## 🛠️ Development

### Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/developer-az/pyke-dominator.git
   cd pyke-dominator
   npm install
   ```

2. **Development mode**
   ```bash
   # Web development
   npm run dev

   # Desktop development (with Electron)
   npm run dev:electron
   ```

### Building

```bash
# Build web version
npm run build

# Build desktop application
npm run dist

# Build without installer (for testing)
npm run pack
```

### Scripts

- `npm run dev` - Start Vite dev server (web)
- `npm run dev:electron` - Start Electron app with hot reload
- `npm run build` - Build web version
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm run dist` - Build Electron app with installer

### Code Structure

- **`src/logic/pykeLogic.ts`**: Core logic for builds, runes, and analysis
- **`src/components/BuildDisplay.tsx`**: UI for displaying builds and runes
- **`src/components/ChampionSelect.tsx`**: Champion selection component
- **`src/data/runeService.ts`**: Data Dragon API integration for runes
- **`electron/main.ts`**: Electron main process and LCU handlers

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style (TypeScript, ESLint rules)
- Add comments for complex logic
- Test your changes thoroughly
- Update documentation as needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Riot Games** for the Data Dragon API and League Client API
- **League of Legends** community for gameplay insights
- **Open source contributors** who make projects like this possible

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/developer-az/pyke-dominator/issues)
- **Repository**: [GitHub Repository](https://github.com/developer-az/pyke-dominator)

---

<div align="center">

**Made with ❤️ for Pyke players**

*Pyke Dominator is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.*

</div>
