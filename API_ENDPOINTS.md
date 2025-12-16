# API エンドポイント一覧

## 設計方針
各モジュールは url_prefix を使用して統一された階層構造を持ちます。

## 1. Flow Designer モジュール (`/flow`)
**Blueprint**: `flow_designer_bp`  
**定義**: `modules/flow_designer/app.py`  
**登録**: `core/app.py` (url_prefix='/flow')

### ページルート
- `GET /flow/list` - フロー一覧（リダイレクト）
- `GET /flow/designer` - フロー設計画面

### APIルート
- `GET /flow/api/flows` - フロー一覧取得
- `GET /flow/api/flows/<flow_id>` - 特定フロー取得
- `PUT /flow/api/flows/default` - フロー保存
- `DELETE /flow/api/flows/<flow_id>` - フロー削除
- `POST /flow/api/flows/<flow_id>/execute` - フロー実行開始
- `GET /flow/api/flows/<flow_id>/status` - 実行状態取得
- `POST /flow/api/flows/<flow_id>/stop` - 実行停止
- `POST /flow/api/flows/test` - テスト実行

---

## 2. Mapping モジュール (`/mapping`)
**Blueprint**: `mapping_bp`  
**定義**: `modules/mapping/app.py`  
**登録**: `core/app.py` (url_prefix='/mapping')

### ページルート
- `GET /mapping/register` - 描画・音メニュー画面
- `GET /mapping/preview` - プレビュー画面
- `GET /mapping/display/parts` - 部品棚ディスプレイ
- `GET /mapping/display/workbench` - 作業台ディスプレイ

### APIルート
- `GET /mapping/api/groups` - グループ一覧取得
- `POST /mapping/api/groups` - グループ作成
- `GET /mapping/api/groups/<int:group_id>` - グループ詳細取得
- `PUT /mapping/api/groups/<int:group_id>` - グループ更新
- `DELETE /mapping/api/groups/<int:group_id>` - グループ削除
- `GET /mapping/api/group_elements` - 要素一覧取得
- `POST /mapping/api/group_elements` - 要素作成
- `GET /mapping/api/group_elements/<int:element_id>` - 要素詳細取得
- `PUT /mapping/api/group_elements/<int:element_id>` - 要素更新
- `DELETE /mapping/api/group_elements/<int:element_id>` - 要素削除
- `POST /mapping/api/upload/image` - 画像アップロード
- `GET /mapping/media/<path:filename>` - メディアファイル取得

---

## 3. 3D Detection モジュール (`/detection`)
**Blueprint**: `detection_bp`  
**定義**: `modules/3d_detect/app.py`  
**登録**: `core/app.py` (url_prefix='/detection')

### ページルート
- `GET /detection/origin` - 原点設定画面
- `GET /detection/detect` - 検知画面

### APIルート
- `GET /detection/api/get_origins` - 原点一覧取得
- `POST /detection/api/save_judge` - 判定設定保存
- `POST /detection/api/update_judge` - 判定設定更新
- `POST /detection/api/delete_judge` - 判定設定削除
- `POST /detection/api/delete_origin` - 原点削除
- `POST /detection/api/count_pixels` - ピクセル数カウント
- `POST /detection/api/register_origin` - 原点登録
- `POST /detection/api/update_origin_comment` - 原点コメント更新

### カメラAPI
- `GET /detection/api/camera/depth_feed` - 深度カメラストリーム
- `GET /detection/api/camera/rgb_feed` - RGBカメラストリーム
- `POST /detection/api/camera/start` - カメラ開始
- `POST /detection/api/camera/stop` - カメラ停止

---

## 4. メインアプリケーション
**定義**: `core/app.py`

### ページルート
- `GET /` - トップページ（描画・音画面）

### ディスプレイウィンドウ
- `GET /display/parts` - 部品棚ディスプレイ
- `GET /display/workbench` - 作業台ディスプレイ

### モジュール管理API
- `GET /api/modules` - 全モジュール情報取得
- `GET /api/modules/<module_name>` - 特定モジュール詳細取得
- `GET /api/modules/<module_name>/status` - モジュール状態取得

### フロー実行API（レガシー）
- `POST /api/execution/start` - フロー実行開始
- `GET /api/execution/status` - 実行状態取得

---

## デバッグ方法

### ルート一覧の確認
サーバー起動時、DEBUG=True の場合は自動的にルート一覧がログ出力されます。

### 手動でルート確認
```powershell
python -c "from core.app import create_app; app = create_app(); [print(rule) for rule in app.url_map.iter_rules()]"
```

### エラー発生時の確認事項
1. **ターミナルログ** - サーバーのコンソール出力を確認
2. **ブラウザ開発者ツール** - F12 → Network タブで実際のリクエストURLを確認
3. **Blueprint登録ログ** - "✓ Registered blueprint" メッセージを確認

---

## 変更履歴
- 2025-12-04: url_prefix を導入し、統一された階層構造に変更
