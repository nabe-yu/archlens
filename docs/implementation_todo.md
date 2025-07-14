# ArchLens 実装タスクリスト

## CLIツール (.NET 8 + Roslyn)
- [x] プロジェクト構成作成（`packages/cli/ArchLens.Cli/`）
- [x] クラス・メソッド・インターフェースの抽出機能実装
- [ ] 呼び出し関係（クラス・メソッド単位）の解析機能実装
- [ ] XMLコメント抽出機能実装
- [ ] JSON形式での構造化出力機能実装
- [ ] ユニットテストプロジェクト作成（`ArchLens.Tests/`、xUnit）
- [ ] 主要機能のテスト実装

## フロントエンド (React + Vite + React Router)
- [ ] プロジェクト構成作成（`packages/viewer/`）
- [x] ルーティング・UI骨組み実装
- [x] React Flowによるクラス・インターフェースノード表示
- [x] メソッド単位の呼び出し関係可視化
- [x] クラス/インターフェース詳細画面の内容拡充
- [x] XMLコメント表示
- [x] 呼び出し元・呼び出し先リンク実装
- [x] テストプロジェクト作成（Jest + React Testing Library）
- [ ] 主要UI・ロジックのテスト実装
- [x] サンプルJSONデータ作成・配置（`public/data/`）
- [x] JSONアップロードUI実装

## ドキュメント
- [ ] README・要件定義・仕様書の整備（`docs/` 配下） 