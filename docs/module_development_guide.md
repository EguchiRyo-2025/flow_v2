# モジュール開発ガイド

新しい機能モジュールを開発するためのガイドです。

## モジュールとは

モジュールは、特定の機能（3D検知、投影、制御など）を提供する独立したコンポーネントです。
各モジュールは：

- **単体で開発・テスト可能**
- **統合システムにプラグインとして追加可能**
- **フローデザイナーで使用可能なノードを提供**

## モジュールの構成

### 必須ファイル

```
modules/your_module/
├── module_config.json    # モジュールメタデータ
├── interface.py          # 統合インターフェース実装
├── __init__.py          # パッケージ初期化
└── README.md            # モジュールドキュメント
```

### 推奨ファイル

```
├── app.py               # 単体実行用Flaskアプリ
├── requirements.txt     # モジュール固有の依存関係
├── static/             # 単体実行用の静的ファイル
└── templates/          # 単体実行用のテンプレート
```

## 開発手順

### 1. テンプレートからコピー

```bash
cd modules
cp -r _template your_module_name
cd your_module_name
```

### 2. module_config.json の編集

```json
{
  "name": "your_module",
  "display_name": "あなたのモジュール",
  "version": "1.0.0",
  "author": "開発者名",
  "description": "モジュールの説明",
  "capabilities": [
    "action1",
    "action2"
  ],
  "flow_nodes": [
    {
      "type": "action1",
      "display_name": "アクション1",
      "icon": "icon.svg",
      "properties": {
        "param1": {
          "type": "string",
          "display_name": "パラメータ1",
          "default": ""
        }
      }
    }
  ],
  "api_endpoints": [
    "/api/your_module/action"
  ]
}
```

### 3. interface.py の実装

```python
from core.module_interface import ModuleInterface
from typing import Dict, Any, List

class YourModule(ModuleInterface):
    """あなたのモジュールの実装"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        # 初期化コード
    
    def initialize(self) -> bool:
        """初期化処理"""
        try:
            # ハードウェア接続、リソース確保など
            self._initialized = True
            return True
        except Exception as e:
            self.logger.error(f"Initialization failed: {e}")
            return False
    
    def execute_action(self, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """アクション実行"""
        if action_type == 'action1':
            return self._action1(parameters)
        else:
            return {'success': False, 'error': f'Unknown action: {action_type}'}
    
    def _action1(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """具体的なアクション実装"""
        # 処理を実装
        return {
            'success': True,
            'data': {},
            'message': 'Action completed'
        }
    
    def get_status(self) -> Dict[str, Any]:
        """状態取得"""
        return {
            'ready': self._initialized,
            'busy': False,
            'error': None
        }
    
    def cleanup(self) -> bool:
        """終了処理"""
        # リソース解放
        return True
    
    def get_capabilities(self) -> List[str]:
        """機能リスト"""
        return ['action1', 'action2']
```

### 4. 単体実行用アプリ (app.py) の実装

```python
from flask import Flask, jsonify, request
from interface import YourModule

app = Flask(__name__)
module = YourModule()
module.initialize()

@app.route('/')
def index():
    return "Your Module Debug Interface"

@app.route('/api/status')
def get_status():
    return jsonify(module.get_status())

@app.route('/api/action', methods=['POST'])
def execute_action():
    data = request.get_json()
    result = module.execute_action(
        data.get('action'),
        data.get('parameters', {})
    )
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
```

### 5. テスト

#### 単体テスト

```bash
python app.py
```

ブラウザで http://localhost:5001 にアクセスして動作確認

#### 統合テスト

コアシステムから起動してモジュールが読み込まれることを確認：

```bash
cd ../..
python core/app.py
```

http://localhost:5000/api/modules で自分のモジュールが表示されることを確認

## ベストプラクティス

### 1. ロギング

```python
self.logger.info("処理開始")
self.logger.warning("警告メッセージ")
self.logger.error("エラー発生", exc_info=True)
```

### 2. エラーハンドリング

```python
def execute_action(self, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # 処理
        return {'success': True, 'data': result}
    except ValueError as e:
        return {'success': False, 'error': f'Invalid parameter: {e}'}
    except Exception as e:
        self.logger.error(f"Unexpected error: {e}", exc_info=True)
        return {'success': False, 'error': 'Internal error'}
```

### 3. 状態管理

```python
def __init__(self, config: Dict[str, Any] = None):
    super().__init__(config)
    self._busy = False
    self._last_result = None

def get_status(self) -> Dict[str, Any]:
    return {
        'ready': self._initialized and not self._busy,
        'busy': self._busy,
        'error': None,
        'details': {
            'last_result': self._last_result
        }
    }
```

### 4. パラメータ検証

```python
def validate_action(self, action_type: str, parameters: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    if action_type == 'action1':
        if 'required_param' not in parameters:
            return False, "Missing required parameter: required_param"
        if not isinstance(parameters['required_param'], str):
            return False, "Parameter 'required_param' must be a string"
    return True, None
```

## トラブルシューティング

### モジュールが読み込まれない

1. `module_config.json`が正しい形式か確認
2. `interface.py`に`ModuleInterface`を継承したクラスがあるか確認
3. `__init__.py`でクラスをエクスポートしているか確認

### 単体実行はできるが統合で動かない

1. `sys.path`の設定を確認
2. `core/`からの相対importを使用
3. ログを確認して初期化エラーをチェック

## 参考

- [core/module_interface.py](../core/module_interface.py) - インターフェース定義
- [modules/_template/](../modules/_template/) - テンプレート
- [modules/detection_3d/](../modules/detection_3d/) - 実装例
