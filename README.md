# Olle's Poker App

Solo side project for exploring poker theory, hand visualization, and preflop decision analysis — focused on **MTT** (multi-table tournament) play.

**Live demo (public):** [https://ollesl.github.io/poker-app/](https://ollesl.github.io/poker-app/)

Paste or upload hand histories to step through hands on a table UI.

**Supported today:** Red Dragon / PokerStars-style MTT text — including **CoinPoker** exports that come through Asian Hand Converter as `RedDragon Hand #…` (decimal chip amounts like `530.00` work), plus **PokerStars PKO/KO** bounty lines (`wins $X for eliminating …`). Other sites can be added later behind the same UI.

---

## What it does today

- React UI for loading and replaying poker hands
- Upload a `.txt` hand-history file or paste text from the clipboard
- Table visualization with street-by-street action playback
- Optional GTO / strategy panel hooks for further analysis

---

## Try it without your own hand histories

Most people won’t have Red Dragon `.txt` files handy. Use the included samples:

- Red Dragon / CoinPoker-style MTT: [`public/samples/red-dragon-mtt-sample.txt`](public/samples/red-dragon-mtt-sample.txt) · [download](https://ollesl.github.io/poker-app/samples/red-dragon-mtt-sample.txt)
- PokerStars Progressive KO (PKO): [`public/samples/pokerstars-pko-sample.txt`](public/samples/pokerstars-pko-sample.txt) · [download](https://ollesl.github.io/poker-app/samples/pokerstars-pko-sample.txt)

Then open the app → **Upload hand history** → select that file (or paste its contents).

The Red Dragon sample mirrors CoinPoker → converter formatting (decimals, antes, 6-max MTT). The PKO sample is a public PokerStars-format knockout hand (bounty award + finish place).

---

## Tech stack

- React + Vite
- React Router DOM
- JavaScript / JSX
- ESLint

---

## Getting started (local)

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal (default `http://127.0.0.1:5173/poker-app/`).

```bash
npm run build    # production build
npm run preview  # preview the production build
```

---

## Repository structure

- `src/` — application code (UI, parser, workers)
- `public/` — static assets and sample hand histories
- `public/samples/` — demo Red Dragon–style `.txt` files
- `.github/workflows/` — GitHub Pages deploy workflow

---

## Notes

- One parser covers **RedDragon** and **PokerStars-like** tournament text; CoinPoker files with decimal stacks/bets are supported.
- Cards render with public SVG faces ([`@heruka_urgyen/react-playing-cards`](https://www.npmjs.com/package/@heruka_urgyen/react-playing-cards), Adrian Kennard / CC0). Showdown uses [`pokersolver`](https://www.npmjs.com/package/pokersolver) for hand strength labels.
- **PKO/KO**: detects 3-part buy-ins (`$prize+$bounty+$fee`) and PokerStars bounty lines (`wins $X for eliminating …`). Replay shows KO cash on the award step when present.
- Native parsers for other rooms (GG, Party, etc.) and non-Stars bounty wording are not implemented yet — paste a sample if you want those added.
- Backend, database, Docker, and deeper solver integration are not in this repo yet.
