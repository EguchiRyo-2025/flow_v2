# 開発環境セットアップガイド

このドキュメントでは、Flow Designerプロジェクトの開発環境を構築する手順を説明します。

## 目次

- [前提条件](#前提条件)
- [環境構築手順](#環境構築手順)
- [開発時の操作](#開発時の操作)
- [トラブルシューティング](#トラブルシューティング)

## 前提条件

- Python 3.8以上
- uv (推奨) または pip
- Git

### uvのインストール（推奨）

uvは高速なPythonパッケージマネージャーです。従来のpipより10-100倍高速にパッケージをインストールできます。

**Windows（PowerShell）:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS/Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

インストール後、以下のコマンドでバージョンを確認できます：
```bash
uv --version
```

## 環境構築手順

### 方法1: uv を使用（推奨）

uvを使用すると、依存関係の解決とインストールが高速に行われ、完全な再現性が保証されます。

#### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd flow
```

#### 2. 依存関係のインストール

```bash
# 基本的な依存関係をインストール
uv sync --native-tls

# 開発用の依存関係も含めてインストール
uv sync --native-tls --extra dev
```

> **注意:** `--native-tls`フラグは企業ネットワーク環境でのTLS証明書エラーを回避するために使用します。
> エラーが発生しない場合は省略できます。

#### 3. 環境の有効化

uvは自動的に仮想環境（`.venv`）を作成します。以下のコマンドで有効化します：

**Windows（PowerShell）:**
```powershell
.venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
source .venv/bin/activate
```

または、uvを使って直接コマンドを実行：
```bash
uv run python core/app.py
```

### 方法2: pipを使用（従来の方法）

#### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd flow
```

#### 2. 仮想環境の作成

```bash
python -m venv .venv
```

#### 3. 仮想環境の有効化

**Windows（PowerShell）:**
```powershell
.venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
source .venv/bin/activate
```

#### 4. 依存関係のインストール

```bash
pip install -r requirements.txt

# 開発用の依存関係もインストールする場合
pip install -e .[dev]
```

## アプリケーションの起動

### 統合アプリケーション（推奨）

すべてのモジュールが統合されたメインアプリケーションを起動：

```bash
# uvを使用する場合
uv run python core/app.py

# 仮想環境を有効化している場合
python core/app.py
```

ブラウザで http://localhost:5000 にアクセスしてください。

### モジュール単体実行（開発・デバッグ用）

個別のモジュールを単体で起動できます：

```bash
# 3D検知モジュール
cd modules/detection_3d
uv run python app.py  # または python app.py
# → http://localhost:5001

# 投影モジュール
cd modules/projection_mapping
uv run python app.py  # または python app.py
# → http://localhost:5002
```

## 開発時の操作

### 新しい依存関係の追加

#### uvを使用する場合

```bash
# パッケージを追加（pyproject.tomlとuv.lockが自動更新される）
uv add <package-name>

# 開発用パッケージを追加
uv add --dev <package-name>

# 特定のバージョンを指定
uv add "<package-name>==1.2.3"
```

#### pipを使用する場合

```bash
# パッケージをインストール
pip install <package-name>

# requirements.txtに追加
pip freeze > requirements.txt
```

### 依存関係の更新

```bash
# uvを使用する場合
uv sync --native-tls --upgrade

# pipを使用する場合
pip install --upgrade -r requirements.txt
```

### テストの実行

```bash
# uvを使用する場合
uv run pytest

# 仮想環境を有効化している場合
pytest

# カバレッジ付きでテスト実行
pytest --cov=core --cov=modules --cov-report=html
```

### コードフォーマット

```bash
# Black (コードフォーマッター)
uv run black core/ modules/ frontend/

# Flake8 (リンター)
uv run flake8 core/ modules/ frontend/
```

## トラブルシューティング

### TLS証明書エラー

企業ネットワーク環境で以下のエラーが発生する場合：

```
error sending request for url (https://pypi.org/simple/...)
invalid peer certificate: UnknownIssuer
```

**解決策:** `--native-tls`フラグを使用してください：

```bash
uv sync --native-tls
```

### 既存の.venvがある場合

既存の仮想環境がある場合、一度削除してから再作成することを推奨します：

```bash
# Windowsの場合
Remove-Item -Recurse -Force .venv

# macOS/Linuxの場合
rm -rf .venv

# 再度セットアップ
uv sync --native-tls
```

### パッケージのバージョン競合

`uv.lock`ファイルを削除してから再度syncを実行：

```bash
# Windowsの場合
Remove-Item uv.lock

# macOS/Linuxの場合
rm uv.lock

# 再度解決
uv sync --native-tls
```

### Pythonバージョンが見つからない

uvは必要なPythonバージョンを自動的にダウンロードしますが、手動でインストールすることもできます：

```bash
uv python install 3.8
uv python install 3.11
```

## ファイル構成の説明

- **`pyproject.toml`**: プロジェクトのメタデータと依存関係を定義（PEP 621準拠）
- **`uv.lock`**: 依存関係のバージョンをロックするファイル（完全な再現性を保証）
- **`requirements.txt`**: pip互換用に残されている従来の依存関係リスト
- **`.venv/`**: Pythonの仮想環境ディレクトリ（自動生成、Gitにはコミットしない）

## 参考資料

- [uv公式ドキュメント](https://docs.astral.sh/uv/)
- [プロジェクトのREADME.md](./README.md)
- [モジュール開発ガイド](./docs/module_development_guide.md)

## よくある質問

### Q: uvとpip、どちらを使うべき？

**A:** 新規開発者はuvの使用を強く推奨します。理由：
- インストールが10-100倍高速
- 依存関係の完全な再現性（uv.lock）
- Pythonバージョンの自動管理
- より良いエラーメッセージ

ただし、既存の環境がある場合やCI/CD環境ではpipも使用可能です。

### Q: requirements.txtは削除しないの？

**A:** 互換性のため残しています。以下の理由があります：
- 既存のCI/CDパイプラインとの互換性
- pip only環境でも動作可能
- ツールによってはrequirements.txtを要求する場合がある

### Q: uv.lockファイルはコミットすべき？

**A:** はい、必ずコミットしてください。このファイルによって：
- すべての開発者が同じバージョンの依存関係を使用できる
- 本番環境と開発環境の一貫性が保たれる
- 依存関係の問題を早期に発見できる

### Q: チーム内で環境を統一するには？

**A:** 以下の手順をチームで共有してください：

1. 全員がuvをインストール
2. リポジトリをクローン
3. `uv sync --native-tls`を実行
4. 新しい依存関係は`uv add`で追加し、変更をコミット

これにより、`uv.lock`を通じて全員が同じ環境を使用できます。
