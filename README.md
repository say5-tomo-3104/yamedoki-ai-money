# やめどきAI Money

- `/` … サブスク管理アプリ「やめどきAI Money」
- `/game/` … 後半生シミュレーション＆短編小説生成ゲーム『黄金の夕暮れと同窓会（仮）』（仕様は [SPEC.md](SPEC.md)）

```bash
npm install
npm run dev   # http://localhost:5173/ と http://localhost:5173/game/
```

イラストは `public/assets/images/` に `スロットID.jpg` で置くと自動で表示されます（一覧は同フォルダの README.md）。

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
