# テーブルUX改善

## 概要
全ページのテーブルに対して、選択状態の視覚的フィードバックを強化し、ユーザーがどの行を選択しているか明確にわかるようにしました。また、フロー実行中のハイライト表示を点滅アニメーションで目立たせるようにしました。

## 実装した改善

### 1. 共通テーブルスタイル（`frontend/static/css/common_table.css`）

#### 追加機能
- **罫線の追加**: ヘッダーとセルに明確な罫線を表示
- **ホバー効果**: マウスを乗せた行を薄い青色でハイライト
- **選択状態の視覚化**: 
  - 背景色を薄い青色（`#e3f2fd`）に変更
  - 青色のアウトライン（2px）を表示
  - 選択された行のセルの罫線も青色に変更

```css
/* テーブルヘッダー */
.styled-table thead th {
    border: 1px solid #b0bec5;
}

/* テーブル行のホバー */
.styled-table tbody tr:hover {
    background-color: #f0f8ff;
}

/* テーブル行の選択状態 */
.styled-table tbody tr.selected {
    background-color: #e3f2fd;
    outline: 2px solid #0056b3;
    outline-offset: -2px;
}

/* セルに罫線 */
.styled-table tbody td {
    border: 1px solid #dcdcdc;
}

/* 選択された行のセル */
.styled-table tbody tr.selected td {
    border-color: #0056b3;
}
```

### 2. フロー実行中のハイライト（`modules/flow_designer/static/css/page.css`）

#### 点滅アニメーション
実行中のステップをより目立たせるため、緑色のパルスアニメーションを追加：

```css
.current-step-highlight {
    background-color: rgba(40, 167, 69, 0.4) !important;
    font-weight: bold;
    border: 2px solid #28a745 !important;
    animation: pulse-highlight 1.5s ease-in-out infinite;
}

@keyframes pulse-highlight {
    0%, 100% {
        background-color: rgba(40, 167, 69, 0.4);
        box-shadow: 0 0 5px rgba(40, 167, 69, 0.6);
    }
    50% {
        background-color: rgba(40, 167, 69, 0.7);
        box-shadow: 0 0 15px rgba(40, 167, 69, 0.9);
    }
}
```

#### 動作
- 1.5秒周期で背景色とシャドウが変化
- 実行中のステップが常に視覚的に確認可能
- Blocklyのブロックも同時にハイライト

### 3. Mappingモジュール（`modules/mapping/static/css/styles.css`）

#### 対象テーブル
- `data-table`: メインのグループ・要素テーブル
- `figure-table`: 図形設定テーブル
- `visual-table`: ビジュアル設定テーブル

#### 選択状態の強化
```css
.data-table tbody tr.selected {
    background-color: #e3f2fd;
    border: 2px solid #0056b3;
    box-shadow: 0 0 8px rgba(0, 86, 179, 0.4);
}
```

- 2pxの青い枠線
- 青色のボックスシャドウで立体的に強調
- ホバー時も異なる色で反応

### 4. 3D検出モジュール（`modules/3d_detect/static/css/styles.css`）

#### 対象テーブル
- `styled-table`: 原点設定テーブル
- `judge-table`: 判定設定テーブル

#### 選択状態の強化
```css
.styled-table tr.selected {
    background-color: #e3f2fd;
    outline: 2px solid #0056b3;
    outline-offset: -2px;
    box-shadow: 0 0 8px rgba(0, 86, 179, 0.4);
}

.judge-table tbody tr.selected {
    background-color: #e3f2fd;
    border: 2px solid #0056b3;
    box-shadow: 0 0 8px rgba(0, 86, 179, 0.4);
}
```

### 5. フローデザイナー（`modules/flow_designer/static/css/page.css`）

#### ステップ行の選択
```css
.step-row.selected {
    background-color: #e3f2fd;
    border: 2px solid #0056b3;
    box-shadow: 0 0 8px rgba(0, 86, 179, 0.4);
}
```

## 視覚的な変更点

### Before（改善前）
- ❌ 選択された行の背景色のみ変化
- ❌ 罫線がなく、行の境界が不明確
- ❌ ホバー効果が弱い
- ❌ フロー実行中のハイライトが目立たない

### After（改善後）
- ✅ 選択された行に明確な青い枠線
- ✅ すべてのセルに罫線があり、表が見やすい
- ✅ ホバー時に薄い青色でフィードバック
- ✅ 選択行にはボックスシャドウで立体的に強調
- ✅ フロー実行中は緑色の点滅アニメーション

## ユーザー体験の向上

### 選択状態の明確化
1. **視覚的階層**: 通常 → ホバー → 選択の3段階で明確に区別
2. **色のコントラスト**: 青系統の色で統一し、視認性向上
3. **立体感**: シャドウとアウトラインで選択行を強調

### フロー実行の可視性
1. **動的フィードバック**: 点滅アニメーションで実行中を一目で確認
2. **色の使い分け**: 
   - 通常選択: 青色
   - 実行中: 緑色（点滅）
3. **二重のハイライト**: テーブル行とBlocklyブロックの両方

## 影響範囲

### 変更ファイル
1. `frontend/static/css/common_table.css` - 共通テーブルスタイル
2. `modules/flow_designer/static/css/page.css` - フローデザイナー
3. `modules/mapping/static/css/styles.css` - マッピングモジュール
4. `modules/3d_detect/static/css/styles.css` - 3D検出モジュール

### 互換性
- 既存のJavaScriptコードは変更不要
- `.selected`クラスを使用している全テーブルに自動適用
- `current-step-highlight`クラスは既存の実装で使用中

## テスト確認項目

### 各ページで確認
1. **描画・音ページ**:
   - グループテーブルの行選択時に青い枠線が表示される
   - ホバー時に薄い青色になる
   - 図形/音設定タブのテーブルも同様

2. **3D画像（原点設定）**:
   - 原点テーブルの行選択時に青い枠線とシャドウが表示される
   - ホバー時の色が変わる

3. **3D画像（検知設定）**:
   - 原点選択テーブルと判定設定テーブルで選択状態が明確
   - 罫線がすべて表示される

4. **フローデザイナー**:
   - ステップテーブルの行選択時に青い枠線が表示される
   - フロー実行時、現在実行中のステップが緑色で点滅する
   - Blocklyのブロックも同時にハイライトされる

### 動作確認手順

#### フロー実行中のハイライト確認
1. フローデザイナーページを開く
2. Blocklyでいくつかのブロックを配置
3. 「実行」ボタンをクリック
4. **期待される動作**:
   - 現在実行中のステップが緑色で点滅
   - 対応するBlocklyブロックもハイライト
   - 実行が進むたびにハイライトが移動
   - 完了後、ハイライトが消える

## トラブルシューティング

### 選択状態が表示されない場合
1. ブラウザのキャッシュをクリア（Ctrl+Shift+R）
2. CSSファイルが正しく読み込まれているか確認
3. `.selected`クラスが正しく追加されているか開発者ツールで確認

### フロー実行中のハイライトが表示されない場合
1. `executionState.isRunning`が`true`になっているか確認
2. `renderSteps()`が呼ばれているか確認
3. `current-step-highlight`クラスが追加されているか確認
4. CSSアニメーションが有効か確認

## 今後の拡張可能性

### 追加可能な機能
1. **複数選択**: Ctrl+クリックで複数行選択
2. **ドラッグ選択**: マウスドラッグで範囲選択
3. **キーボード操作**: 矢印キーで選択行を移動
4. **カスタムテーマ**: ユーザーが色をカスタマイズ可能に
