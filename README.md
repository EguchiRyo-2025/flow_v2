# Flow Designer - デジタル作業台フロー設計システム

プロジェクションマッピングと3D検知を統合したデジタル作業台のフロー設計・実行システムです。

## 概要

このシステムは以下の機能を提供します：

- **フロー設計GUI**: Blocklyベースの直感的なフロー設計インターフェース
- **モジュール統合**: 3D検知、プロジェクションマッピングなどの機能をプラグイン形式で統合
- **フロー実行エンジン**: 設計したフローを実行し、各モジュールを制御
- **拡張性**: 新しい機能モジュールを簡単に追加可能

## ディレクトリ構成

```
flow/
├── core/                   # コアシステム（統合層）
│   ├── app.py             # メインアプリケーション
│   ├── module_interface.py # モジュール統合インターフェース
│   ├── module_manager.py  # モジュール管理
│   └── flow_engine.py     # フロー実行エンジン
│
├── modules/               # 機能モジュール（プラグイン形式）
│   ├── _template/        # 新モジュール作成用テンプレート
│   ├── detection_3d/     # 3D検知モジュール
│   └── projection_mapping/ # 投影モジュール
│
├── frontend/             # フロー設計・実行UI
│   ├── static/          # CSS, JavaScript
│   └── templates/       # HTMLテンプレート
│
├── config/              # 設定ファイル
├── docs/                # ドキュメント
└── scripts/             # 開発支援スクリプト
```

## セットアップ

### クイックスタート

**新規開発者向け（uvを使用 - 推奨）:**

```bash
# 1. uvをインストール（未インストールの場合）
# Windows: powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
# macOS/Linux: curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. リポジトリをクローン
git clone <repository-url>
cd flow

# 3. 依存関係をインストール
uv sync --native-tls

# 4. アプリケーションを起動
uv run python core/app.py
```

**従来の方法（pipを使用）:**

```bash
# 1. 仮想環境を作成
python -m venv .venv

# 2. 仮想環境を有効化
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate

# 3. 依存関係をインストール
pip install -r requirements.txt

# 4. アプリケーションを起動
python core/app.py
```

詳細な環境構築手順は [SETUP.md](./SETUP.md) を参照してください。

### アプリケーションの起動

#### 統合アプリケーション（全モジュール統合）

```bash
python core/app.py
```

ブラウザで http://localhost:5000 にアクセス

#### モジュール単体実行（開発・デバッグ用）

```bash
# 3D検知モジュール単体
cd modules/detection_3d
python app.py
# → http://localhost:5001

# 投影モジュール単体
cd modules/projection_mapping
python app.py
# → http://localhost:5002
```

## 開発ガイド

### モジュールの開発

新しい機能モジュールを追加する方法：

1. `modules/_template/`をコピーして新しいモジュール名でリネーム
2. `module_config.json`を編集
3. `interface.py`に機能を実装
4. `app.py`で単体テスト
5. コアシステムから統合テスト

詳細は [モジュール開発ガイド](docs/module_development_guide.md) を参照

### フロー定義の形式

フローはJSON形式で定義します：

```json
{
  "name": "サンプルフロー",
  "description": "部品取り出しフロー",
  "steps": [
    {
      "id": "step1",
      "type": "action",
      "module": "projection_mapping",
      "action": "show_image",
      "parameters": {
        "image_path": "parts/part1.png",
        "position": {"x": 100, "y": 100}
      }
    },
    {
      "id": "step2",
      "type": "action",
      "module": "detection_3d",
      "action": "wait_for_touch",
      "parameters": {
        "target_area": "zone1",
        "timeout": 30
      }
    }
  ]
}
```

## 技術スタック

- **バックエンド**: Python 3.8, Flask
- **フロントエンド**: HTML, CSS, JavaScript
- **データベース**: SQLite (開発) / PostgreSQL (本番)
- **フロー設計**: Google Blockly

## ライセンス

社内プロジェクト

## 開発者向け情報

- [アーキテクチャドキュメント](docs/architecture.md)
- [API仕様](docs/api_specification.md)
- [モジュール開発ガイド](docs/module_development_guide.md)
