# システムアーキテクチャ

## 全体構成

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Browser)                    │
│  ┌─────────────────┐         ┌─────────────────┐      │
│  │  Flow Designer  │         │  Flow Executor  │      │
│  │   (Blockly)     │         │   (Monitor)     │      │
│  └────────┬────────┘         └────────┬────────┘      │
└───────────┼──────────────────────────┼────────────────┘
            │                          │
            │     REST API (Flask)     │
            │                          │
┌───────────┼──────────────────────────┼────────────────┐
│           ▼                          ▼                 │
│  ┌──────────────────────────────────────────┐         │
│  │         Core Application (Flask)         │         │
│  │  ┌────────────┐      ┌───────────────┐  │         │
│  │  │   Module   │      │     Flow      │  │         │
│  │  │  Manager   │◄────►│    Engine     │  │         │
│  │  └─────┬──────┘      └───────────────┘  │         │
│  └────────┼─────────────────────────────────┘         │
│           │                                            │
│           │ ModuleInterface                            │
│           ▼                                            │
│  ┌─────────────────────────────────────────┐          │
│  │          Module Layer (Plugins)         │          │
│  │  ┌──────────┐  ┌──────────┐  ┌───────┐ │          │
│  │  │   3D     │  │Projection│  │  New  │ │          │
│  │  │Detection │  │ Mapping  │  │Module │ │          │
│  │  └──────────┘  └──────────┘  └───────┘ │          │
│  └─────────────────────────────────────────┘          │
│                                                        │
│  ┌─────────────────────────────────────────┐          │
│  │       Data Layer (SQLAlchemy)           │          │
│  │   ┌──────┐  ┌──────┐  ┌──────────┐     │          │
│  │   │ Flow │  │ Step │  │Execution │     │          │
│  │   └──────┘  └──────┘  └──────────┘     │          │
│  └─────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────┘
```

## レイヤー構成

### 1. Frontend Layer (フロントエンド層)

**役割**: ユーザーインターフェースの提供

- **Flow Designer**: フローを視覚的に設計
  - Blocklyベースのノードエディタ
  - モジュールから動的にノードを生成
  - JSON形式でフロー定義を保存

- **Flow Executor**: フローの実行と監視
  - リアルタイムステータス表示
  - 実行ログの表示
  - エラーハンドリング

**技術**:
- HTML5, CSS3, JavaScript (ES6+)
- Blockly (Google)
- Fetch API (REST通信)

### 2. Core Layer (コア層)

**役割**: システムの中核機能

#### Module Manager (モジュールマネージャー)

```python
class ModuleManager:
    - discover_modules()      # モジュール自動検出
    - load_module()          # モジュール読み込み
    - get_module()           # モジュール取得
    - unload_module()        # モジュールアンロード
```

- モジュールの検出・読み込み・管理
- `module_config.json`からメタデータを読み込み
- `interface.py`を動的にインポート
- モジュールのライフサイクル管理

#### Flow Engine (フロー実行エンジン)

```python
class FlowEngine:
    - load_flow()           # フロー定義の読み込み
    - execute_flow()        # フロー実行
    - _execute_step()       # 個別ステップ実行
    - get_execution_status() # 実行状態取得
```

- JSON形式のフロー定義を解釈
- ステップを順次実行
- モジュールのアクションを呼び出し
- 実行結果を記録

#### Module Interface (モジュールインターフェース)

```python
class ModuleInterface(ABC):
    @abstractmethod
    def initialize() -> bool
    
    @abstractmethod
    def execute_action(action_type, parameters) -> Dict
    
    @abstractmethod
    def get_status() -> Dict
    
    @abstractmethod
    def cleanup() -> bool
    
    @abstractmethod
    def get_capabilities() -> List[str]
```

- 全モジュールが実装すべき基底クラス
- 統一されたインターフェースで異なる機能を統合
- アクション実行、状態取得、初期化・終了処理を定義

### 3. Module Layer (モジュール層)

**役割**: 個別機能の実装

各モジュールは独立したプラグインとして動作：

#### Detection 3D Module
- 3Dカメラによる物体検知
- タッチ検知
- 距離測定

#### Projection Mapping Module
- プロジェクター制御
- 画像・映像の投影
- 投影位置の調整

#### 新規モジュール
- テンプレートから簡単に追加
- 独自のロジックを実装
- 既存システムに影響なし

**モジュールの構成**:
```
module_name/
├── module_config.json  # メタデータ
├── interface.py        # ModuleInterfaceの実装
├── app.py             # 単体実行用
└── (モジュール固有のファイル)
```

### 4. Data Layer (データ層)

**役割**: データの永続化

#### データモデル

```python
# Flow (フロー定義)
- id: int
- name: str
- description: str
- definition: JSON  # ステップ定義
- created_at: datetime
- updated_at: datetime

# Execution (実行履歴)
- id: int
- flow_id: int
- started_at: datetime
- completed_at: datetime
- status: str (completed/failed)
- results: JSON
```

## データフロー

### フロー設計時

```
1. User → Flow Designer: ノードを配置
2. Flow Designer: JSON形式に変換
3. Frontend → Core API: POST /api/flows
4. Core: ファイルまたはDBに保存
```

### フロー実行時

```
1. User → Flow Executor: 実行開始
2. Frontend → Core API: POST /api/execution/start
3. Flow Engine: フロー定義を読み込み
4. For each step:
   a. Flow Engine → Module Manager: モジュール取得
   b. Module Manager → Module: execute_action()
   c. Module: アクション実行
   d. Module → Flow Engine: 結果を返す
5. Flow Engine: 全結果を集約
6. Core API → Frontend: 実行結果を返す
```

### モジュール単体実行時

```
1. Developer: python modules/xxx/app.py
2. Module: Flaskサーバー起動 (port 5001+)
3. Developer → Module UI: ブラウザでアクセス
4. Module UI → Module API: 直接呼び出し
5. Module: デバッグ情報を表示
```

## API設計

### モジュール関連

```
GET  /api/modules              # 全モジュールのリスト
GET  /api/modules/{name}       # モジュール詳細
GET  /api/modules/{name}/status # モジュール状態
```

### フロー関連

```
GET  /api/flows                # フローリスト
GET  /api/flows/{filename}     # フロー詳細取得
POST /api/flows                # フロー保存
```

### 実行関連

```
POST /api/execution/start      # 実行開始
GET  /api/execution/status     # 実行状態取得
```

## 拡張性

### 新しいモジュールの追加

1. `modules/_template/`をコピー
2. `module_config.json`を編集
3. `interface.py`を実装
4. 自動検出されて統合完了

### 新しいステップタイプの追加

1. `FlowStepType`にenumを追加
2. `FlowEngine._execute_step()`に処理を追加
3. フロントエンドのノードパレットに追加

### データベースの変更

1. SQLite（開発） → PostgreSQL（本番）
2. `config/production.py`で接続文字列を変更
3. コードの変更不要（SQLAlchemy使用）

## セキュリティ考慮事項

- セッションの暗号化（SECRET_KEY）
- CORS設定（本番では適切なoriginを設定）
- ファイルアップロードの検証
- SQLインジェクション対策（ORMで自動対応）

## パフォーマンス考慮事項

- モジュールの遅延読み込み
- フロー実行の非同期化（将来実装）
- データベースのインデックス設定
- 静的ファイルのキャッシュ
