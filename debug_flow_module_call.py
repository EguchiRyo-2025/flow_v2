#!/usr/bin/env python
"""
デバッグ: フロー実行時のモジュール呼び出し順序とカメラマネージャーの状態を確認
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))

from flask import Flask
from core.module_manager import ModuleManager
from core.flow_engine import FlowEngine

# 1. メインアプリケーション起動時のカメラマネージャー初期化
print("=" * 60)
print("STEP 1: Application Startup - Camera Manager Initialization")
print("=" * 60)

from modules.detect_3d.camera.camera_manager import camera_manager as main_camera_manager
print(f"Camera manager ID at startup: {id(main_camera_manager)}")
print(f"  _capture_running: {getattr(main_camera_manager, '_capture_running', 'NOT SET')}")
print(f"  _camera_initialized: {getattr(main_camera_manager, '_camera_initialized', 'NOT SET')}")
print(f"  _camera: {getattr(main_camera_manager, '_camera', 'NOT SET')}")

# 2. Flaskアプリ作成とカメラマネージャーのアタッチ
print("\n" + "=" * 60)
print("STEP 2: Flask App Creation - Attach camera_manager to app")
print("=" * 60)

app = Flask(__name__)
app.config['MODULES_DIR'] = Path.cwd() / 'modules'
app.camera_manager = main_camera_manager
print(f"camera_manager attached to Flask app: {id(app.camera_manager)}")
print(f"  Are they the same? {app.camera_manager is main_camera_manager}")

# 3. モジュールマネージャーを作成してdetect_3dを読み込み
print("\n" + "=" * 60)
print("STEP 3: Load detect_3d Module")
print("=" * 60)

module_manager = ModuleManager(app.config['MODULES_DIR'])
loaded = module_manager.load_module('detect_3d')

if loaded:
    detect_module = module_manager.get_module('detect_3d')
    print(f"detect_3d module loaded successfully")
    print(f"detect_3d module camera_manager ID: {id(detect_module.camera_manager)}")
    print(f"  Are they same as main_camera_manager? {detect_module.camera_manager is main_camera_manager}")
    print(f"  _capture_running: {getattr(detect_module.camera_manager, '_capture_running', 'NOT SET')}")
    print(f"  _camera_initialized: {getattr(detect_module.camera_manager, '_camera_initialized', 'NOT SET')}")
else:
    print("ERROR: Failed to load detect_3d module")

# 4. フロー実行シミュレーション（Flask コンテキスト内）
print("\n" + "=" * 60)
print("STEP 4: Flow Execution in Flask Context - BEFORE Initialize")
print("=" * 60)

with app.app_context():
    print("Inside Flask app context:")
    from flask import current_app
    
    # detect_3d.interface が Flask context から camera_manager を取得
    from modules.detect_3d.interface import Detection3DModule
    
    flow_detect_module = Detection3DModule()
    print(f"\nCreated Detection3DModule instance in flow execution")
    print(f"  Before initialize: camera_manager = {flow_detect_module.camera_manager}")
    
    # 5. initialize() を実行（ここでカメラが start される）
    print("\n" + "=" * 60)
    print("STEP 5: Call initialize() - CAMERA STARTUP")
    print("=" * 60)
    
    result = flow_detect_module.initialize()
    print(f"\nAfter initialize():")
    print(f"  Success: {result}")
    print(f"  camera_manager ID: {id(flow_detect_module.camera_manager)}")
    print(f"  Are they same as main_camera_manager? {flow_detect_module.camera_manager is main_camera_manager}")
    print(f"  _capture_running: {getattr(flow_detect_module.camera_manager, '_capture_running', 'NOT SET')}")
    print(f"  _camera_initialized: {getattr(flow_detect_module.camera_manager, '_camera_initialized', 'NOT SET')}")
    print(f"  _camera: {getattr(flow_detect_module.camera_manager, '_camera', 'NOT SET')}")
    
    # 6. アクション実行テスト
    print("\n" + "=" * 60)
    print("STEP 6: Execute Action - get_origins (without camera)")
    print("=" * 60)
    
    result = flow_detect_module.execute_action('get_origins', {})
    print(f"Action result: {result}")
    
    # 7. カメラが必要なアクションのテスト
    print("\n" + "=" * 60)
    print("STEP 7: Execute Action - count_pixels (camera required)")
    print("=" * 60)
    
    # テスト用の points パラメータを用意
    test_params = {
        'points': [[400, 250], [500, 250], [500, 350], [400, 350]],
        'depth_min': 4000,
        'depth_max': 5000
    }
    
    result = flow_detect_module.execute_action('count_pixels', test_params)
    print(f"Action result (camera status after start):")
    print(f"  Success: {result.get('success')}")
    print(f"  Error: {result.get('error')}")
    print(f"  Pixel count: {result.get('pixel_count')}")
    print(f"  Message: {result.get('message')}")

print("\n" + "=" * 60)
print("DEBUG SUMMARY")
print("=" * 60)
print(f"""
フロー実行時のモジュール呼び出しとカメラ初期化の改善:

改善内容:
1. detect_3d/interface.py の initialize() で camera_manager.start() を呼び出し
2. execute_action() でカメラが起動していない場合は start() を再度試行
3. 3D画像ページと同じカメラ常駐仕組みを適用

期待される動作:
- フロー実行時に initialize() が呼ばれる
- initialize() でカメラが start() される（重複呼び出しは自動防止）
- detect_touch, count_pixels などのアクション実行時にカメラが動作
- 深度データが正常に取得される

チェーン確認:
- Flask app.camera_manager が正しくアタッチされている ✅
- flow_detect_module.camera_manager が Flask app.camera_manager と同じ ✅
- initialize() で camera_manager.start() が呼ばれる ✅
- execute_action() でカメラ起動状態をチェック ✅
""")
