# Mapping モジュール アップデート - 実装概要

## 更新内容

### 1. データベーススキーマ拡張
**ファイル**: `modules/mapping/create_default_data.py`

追加されたカラム:
- `polygon_points` (TEXT): 多角形の頂点座標（JSON形式）
- `text_content` (TEXT): テキスト要素の内容
- `text_font_size` (INTEGER): フォントサイズ（デフォルト: 16）
- `text_color` (TEXT): 文字色（デフォルト: #000000）
- `image_asset_id`: NULLを許可（多角形やテキストの場合は画像不要）

### 2. API層の拡張
**ファイル**: `modules/mapping/app.py`

#### 新しいエンドポイント
- `GET /mapping/api/groups/<group_id>/elements/list`
  - テーブル表示用に、グループ内の全要素を取得
  - 要素タイプ（画像/多角形/テキスト）を含める

#### 既存エンドポイントの拡張
- `POST /mapping/api/group_elements`
  - 複数の要素タイプをサポート
  - `element_type`, `polygon_points`, `text_content` など対応

- `PUT /mapping/api/elements/<element_id>`
  - 多角形データ、テキストデータ更新に対応
  - `opacity`, `text_font_size`, `text_color` など対応

### 3. フロントエンド - 要素一覧テーブル
**ファイル**: 
- `modules/mapping/templates/register_figure.html`
- `modules/mapping/static/js/elements_table.js`

#### 動的テーブル表示
- DBから自動的に要素を読み込み
- 要素タイプ（画像/多角形/テキスト）をテーブルに表示
- 要素の座標 (X, Y) を表示
- 行クリックで要素を選択

### 4. UIコンポーネント拡張
**ファイル**: `modules/mapping/templates/components/visual_component.html`

#### 新しいタブボタン
- 図形（デフォルト）
- 画像
- **テキスト（新規）**

#### 図形設定セクション
- 多角形の頂点座標入力エリア
- ディスプレイウィンドウで右クリックして頂点を指定可能

#### テキスト設定セクション（新規）
- テキスト内容入力
- フォントサイズ設定
- 文字色選択
- 背景色選択
- 座標指定

### 5. ベクター図形描画エンジン
**ファイル**: `modules/mapping/static/js/vector_shape_drawer.js`

#### 機能
- SVGベースの図形描画
- 多角形（polygon）のサポート
- 矩形・円・三角形のプレビュー機能
- 頂点座標のJSON形式での保存・読み込み
- テキストフォーム データから図形データを抽出

### 6. プレビューウィンドウの拡張
**ファイル**: `modules/mapping/static/js/preview_window.js`

#### 複数要素タイプのレンダリング
- `renderImageElement()`: 画像要素の描画（従来）
- `renderPolygonElement()`: 多角形のSVG描画（新規）
- `renderTextElement()`: テキスト要素の描画（新規）

#### 各タイプの特性
**画像要素**:
- 従来通りの画像表示
- 拡大縮小、回転対応

**多角形要素**:
- ベクター形式（SVG）で描画
- 塗りつぶし色と輪郭色対応
- 複数の頂点で任意の形状

**テキスト要素**:
- フォントサイズ可変
- 背景色つき表示
- ドラッグで移動可能

## 使用方法

### 1. 多角形要素の追加
1. 「要素タイプ」から「図形」を選択
2. 「図形タイプ」で「多角形」を選択
3. ディスプレイウィンドウを開く
4. ディスプレイ上で右クリックして頂点を指定
5. テキストエリアに座標が自動入力される
6. 「追加」ボタンで登録

### 2. テキスト要素の追加
1. 「要素タイプ」から「テキスト」を選択
2. テキスト内容を入力
3. フォントサイズ、文字色、背景色を設定
4. 座標 (X, Y) を指定
5. 「追加」ボタンで登録

### 3. 要素一覧テーブルの確認
- 左ペインのテーブルに登録済みの全要素が表示される
- タイプ、コメント、座標が表示される
- 行をクリックすると要素が選択される

## データベーススキーマ更新の実行

既存のデータベースを更新するには:

```bash
python modules/mapping/create_default_data.py
```

このスクリプトは:
1. 新しいカラムが存在しなければ自動的に追加
2. デフォルトプロジェクトを作成（既存の場合はスキップ）
3. テーブル構造を確認して必要なマイグレーションを実行

## 技術仕様

### 多角形座標形式
JSON配列形式で保存:
```json
[[0, 0], [100, 0], [100, 100], [0, 100]]
```
各要素は `[x, y]` の座標ペア

### テキストバックグラウンドカラー
テキスト要素には `text_bg_color` カラムの追加が推奨されます:

```sql
ALTER TABLE group_elements ADD COLUMN text_bg_color TEXT DEFAULT '#FFFFFF';
```

## 今後の拡張予定
- 矩形・円・三角形の自動生成機能
- 図形の自由度高い編集UI
- テキストの右クリックメニューでスタイル変更
- 多言語テキストサポート
- ポリゴン頂点のドラッグ編集UI

