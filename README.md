# 🃏 Poker Hand Replayer with GTO Integration

A sophisticated poker hand replayer application that combines hand history visualization with real-time Game Theory Optimal (GTO) range analysis. Built for serious poker players who want to study hands with solver-based insights.

---

## ✨ Features

### 🎯 **Interactive Hand Replay**
- **Step-by-step hand progression** through preflop, flop, turn, and river
- **Real-time pot tracking** with accurate bet sizing and side pot calculations
- **Player action visualization** with fold/call/raise animations
- **Showdown analysis** with winner determination and chip distribution

### 🧠 **GTO Range Integration**
- **Dynamic range display** that updates as you step through the hand
- **Position-aware ranges** (UTG, LJ, HJ, CO, BTN, SB, BB) for different table sizes
- **Effective stack depth calculation** showing relevant ranges based on actual stack sizes
- **1,000+ solver images** organized by position and stack depth (15BB-100BB)

### 📊 **Advanced Hand Analysis**
- **Red Dragon hand history parsing** with comprehensive action tracking
- **Investment tracking** for accurate profit/loss calculations
- **Multi-way pot handling** with proper side pot logic
- **Ante and blind management** for tournament scenarios

### 🎨 **Modern UI/UX**
- **Responsive poker table** with realistic chip and card representations
- **Smooth animations** for betting actions and chip movements
- **Clean, intuitive interface** focused on study efficiency
- **Real-time GTO panel** showing optimal ranges for current decision points

---

## 🛠 Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** CSS3 with custom poker table animations
- **Hand Parsing:** Custom Red Dragon format parser with Web Workers
- **GTO Integration:** Dynamic range URL resolution with 1,000+ solver images
- **State Management:** React hooks with optimized re-rendering
- **Build Tool:** Vite for fast development and production builds

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd capstone_project/ui

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
ui/
├── src/
│   ├── components/
│   │   ├── PokerTable.jsx      # Main hand replayer component
│   │   ├── GtoPanel.jsx        # GTO range display panel
│   │   └── HandRanks.jsx       # Hand ranking component
│   ├── workers/
│   │   └── parser.worker.js    # Background hand parsing
│   ├── utils/
│   │   └── parser.js           # Hand history parser
│   └── css/                    # Component-specific styles
├── public/
│   └── ranges/
│       └── Main/
│           ├── 7max/open/      # Original GTO ranges (15-100BB)
│           └── all/             # New organized ranges by position
└── scripts/                    # Organization utilities
```

---

## 🎯 GTO Range System

### Range Organization
- **Position-based folders:** UTG, LJ, HJ, CO, BTN, SB, BB
- **Stack depth ranges:** 15BB, 20BB, 25BB, 30BB, 40BB, 50BB, 60BB, 80BB, 100BB
- **Dynamic selection:** Automatically chooses closest available stack depth
- **Real-time updates:** Ranges change as you progress through the hand

### Effective Stack Calculation
The system intelligently calculates effective stack depth by taking the minimum of:
- Current player's stack
- Largest remaining opponent's stack

This ensures the displayed range is relevant to the actual decision being made.

---

## 🔧 Development

### Key Components

**PokerTable.jsx** - Main application component handling:
- Hand state management and progression
- GTO range URL resolution
- Pot calculations and winner determination
- Player action animations

**GtoPanel.jsx** - GTO range display component:
- Dynamic range image loading
- Position and stack depth parsing
- Real-time range updates

**parser.js** - Hand history parsing:
- Red Dragon format support
- Investment tracking for accurate profit calculations
- Winner determination with net profit analysis

### Adding New GTO Ranges

1. Add images to `public/ranges/Main/all/[POSITION]/`
2. Use the organization script: `node scripts/organizeByRowNumbers.mjs`
3. Images are automatically detected and organized by row number mapping

---

## 🎮 Usage

1. **Load a hand history** by pasting Red Dragon format text
2. **Step through the hand** using the navigation controls
3. **View GTO ranges** in the side panel - they update automatically
4. **Analyze decisions** with solver-based insights
5. **Study showdowns** with accurate pot distribution

---

## 🚧 Future Enhancements

- **3betting range integration** for advanced scenarios
- **ICM considerations** for tournament play
- **Hand range vs range** analysis
- **Custom range upload** functionality
- **Export analysis** to study notes

---

## 📝 License

This project is for educational and personal use in poker study and analysis.