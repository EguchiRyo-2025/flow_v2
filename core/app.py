"""
Main Application - フロー設計・実行システムのメインアプリケーション
"""
import os
import sys
import importlib
import webbrowser
import threading
import time
from pathlib import Path
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
import logging
from asyncio import run

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import get_config
from core.module_manager import ModuleManager
from core.flow_engine import FlowEngine
# camera_managerを最初にインポートして、シングルトンインスタンスを確実に作成
# これにより、すべてのBlueprintで同じインスタンスが使われる
# 注意: ここでインポートすることで、アプリケーション起動時に1回だけ初期化される
print(f"[core/app.py] camera_managerをインポート開始")
from modules.detect_3d.camera.camera_manager import camera_manager
print(f"[core/app.py] camera_managerインポート完了: インスタンスID={id(camera_manager)}")


def create_app(config_name='development'):
    """
    Flaskアプリケーションのファクトリ関数
    
    Args:
        config_name: 設定名（'development' or 'production'）
        
    Returns:
        Flask: Flaskアプリケーションインスタンス
    """
    # プロジェクトルート
    project_root = Path(__file__).parent.parent
    
    # Flaskアプリケーション作成（複数のテンプレートフォルダを使用）
    from jinja2 import ChoiceLoader, FileSystemLoader
    
    app = Flask(__name__,
                static_folder=str(project_root / 'frontend' / 'static'))
    
    # 複数のテンプレートフォルダを設定
    app.jinja_loader = ChoiceLoader([
        FileSystemLoader(str(project_root / 'frontend' / 'templates')),
        FileSystemLoader(str(project_root / 'modules' / 'detect_3d' / 'templates')),
        FileSystemLoader(str(project_root / 'modules' / 'mapping' / 'templates')),
        FileSystemLoader(str(project_root / 'modules' / 'flow_designer' / 'templates'))
    ])
    
    # 設定読み込み
    config = get_config(config_name)
    app.config.from_object(config)
    config.init_app(app)
    
    # CORS有効化
    CORS(app)
    
    # ログ設定
    # werkzeugのINFOログを抑制（静的ファイルのリクエストなどは不要）
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    
    logging.basicConfig(
        level=getattr(logging, app.config['LOG_LEVEL']),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # モジュールマネージャー初期化
    module_manager = ModuleManager(app.config['MODULES_DIR'])
    app.module_manager = module_manager
    
    # フローエンジン初期化
    flow_engine = FlowEngine(module_manager)
    app.flow_engine = flow_engine
    
    # core/app.py で既に作成されたシングルトン camera_manager を app にアタッチ
    # （すべてのBlueprintで同じインスタンスを参照するため）
    app.camera_manager = camera_manager
    app.logger.info(f"[core/app.py] camera_manager attached to Flask app: instance_id={id(camera_manager)}")
    
    # モジュール自動検出・読み込み
    if app.config.get('MODULE_AUTO_DISCOVER', True):
        results = module_manager.load_all_modules()
        app.logger.info(f"Module loading results: {results}")
    
    # モジュールのBlueprint登録（統一された構造）
    # 注意: camera_managerは既にインポート時に初期化されているため、
    # ここで再度初期化する必要はない（シングルトンパターンにより同じインスタンスが返される）
    MODULES = [
        ('modules.detect_3d.app', 'detection_bp', '/detection'),
        ('modules.mapping.app', 'mapping_bp', '/mapping'),
        ('modules.flow_designer.app', 'flow_designer_bp', '/flow'),
    ]
    
    for module_path, bp_name, url_prefix in MODULES:
        try:
            module = importlib.import_module(module_path)
            bp = getattr(module, bp_name)
            app.register_blueprint(bp, url_prefix=url_prefix)
            app.logger.info(f"[OK] Registered blueprint: {bp_name} at {url_prefix}")
            
            # detection_bp登録時に、カメラを常駐開始（アプリ起動時に1回だけ）
            # 注意: UIイベントと一切同期させない。常に動き続ける。
            # Flaskのリロード機能を考慮して、子プロセス（WERKZEUG_RUN_MAIN='true'）でのみ実行
            if 'detect_3d' in module_path:
                # Werkzeug自動リロードの場合、実際のWeb serverは子プロセス（WERKZEUG_RUN_MAIN='true'）で動く
                # 親プロセスではカメラを起動しない（キャプチャスレッドが子プロセスから見えないため）
                is_werkzeug_parent = app.config.get('DEBUG') and os.environ.get('WERKZEUG_RUN_MAIN') != 'true'
                should_start_camera = not app.config.get('TESTING') and not is_werkzeug_parent
                
                if should_start_camera:
                    try:
                        app.logger.info("[カメラ] アプリ起動時にカメラを常駐開始します")
                        camera_manager.start()  # 非同期で初期化して常駐開始（重複呼び出しは自動的にスキップされる）
                        app.logger.info("[カメラ] カメラ常駐開始完了（常に動き続けます）")
                    except Exception as e:
                        import traceback
                        app.logger.warning(f"[カメラ] 常駐開始に失敗しました（後で自動的に再試行されます）: {e}")
                        app.logger.warning(traceback.format_exc())
                else:
                    app.logger.info("[カメラ] リロード親プロセスのため、カメラ常駐開始をスキップします")
        except Exception as e:
            import traceback
            app.logger.error(f"[ERROR] Failed to register {bp_name}: {e}")
            app.logger.error(traceback.format_exc())
    
    # 全ルートをデバッグ表示
    app.logger.info("=" * 50)
    app.logger.info("Registered routes:")
    for rule in app.url_map.iter_rules():
        app.logger.info(f"  {rule.rule} -> {rule.endpoint}")

    # ルート登録
    register_routes(app)
    
    # デバッグ: 登録されたルート一覧を表示
    if app.config['DEBUG']:
        app.logger.info("=== Registered Routes ===")
        for rule in app.url_map.iter_rules():
            methods = ','.join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
            app.logger.info(f"  {methods:7s} {rule.rule}")
        app.logger.info("=" * 50)
    
    # --- デバッグ: モジュール登録状況を明示的に出力 ---
    app.logger.info(f"[DEBUG] Registered modules at startup: {list(module_manager.get_all_modules().keys())}")
    
    return app


def register_routes(app: Flask):
    """ルートの登録"""
    
    # プロジェクトルート参照用
    project_root = Path(__file__).parent.parent
    
    @app.route('/')
    def index():
        """トップページ - 描画・音画面へリダイレクト"""
        from flask import redirect
        return redirect('/mapping/register')
    
    # === ディスプレイウィンドウへのルート ===",
    
    # モジュールのstaticファイルへのアクセス
    @app.route('/modules/<module_name>/static/<path:filename>')
    def module_static(module_name, filename):
        """モジュールのstaticファイルを提供"""
        module_static_dir = project_root / 'modules' / module_name / 'static'
        return send_from_directory(str(module_static_dir), filename)
    
    # モジュールのテンプレート（コンポーネント）へのアクセス
    @app.route('/modules/<module_name>/templates/<path:filename>')
    def module_template(module_name, filename):
        """モジュールのテンプレートファイルを提供"""
        module_template_dir = project_root / 'modules' / module_name / 'templates'
        return send_from_directory(str(module_template_dir), filename)
    
    # === API: モジュール管理 ===
    
    @app.route('/api/modules', methods=['GET'])
    def get_modules():
        """全モジュールのリストと情報を取得"""
        modules = app.module_manager.get_all_metadata()
        return jsonify({
            'success': True,
            'modules': {name: meta.to_dict() for name, meta in modules.items()}
        })
    
    @app.route('/api/modules/<module_name>', methods=['GET'])
    def get_module_info(module_name):
        """特定モジュールの詳細情報を取得"""
        metadata = app.module_manager.get_metadata(module_name)
        if not metadata:
            return jsonify({'success': False, 'error': 'Module not found'}), 404
        
        module = app.module_manager.get_module(module_name)
        status = module.get_status() if module else {'ready': False}
        
        return jsonify({
            'success': True,
            'metadata': metadata.to_dict(),
            'status': status
        })
    
    @app.route('/api/modules/<module_name>/status', methods=['GET'])
    def get_module_status(module_name):
        """モジュールの状態を取得"""
        module = app.module_manager.get_module(module_name)
        if not module:
            return jsonify({'success': False, 'error': 'Module not found'}), 404
        
        return jsonify({
            'success': True,
            'status': module.get_status()
        })
    
    # === API: フロー管理 ===
    # フローAPIは flow_designer_bp で処理されるため、ここでは実行関連のみ
    
    # === API: フロー実行 ===
    
    @app.route('/api/execution/start', methods=['POST'])
    def start_execution():
        """フローの実行を開始"""
        data = request.get_json()
        
        if 'flow' in data:
            # フロー定義を直接受け取る
            if not app.flow_engine.load_flow_from_dict(data['flow']):
                return jsonify({'success': False, 'error': 'Invalid flow definition'}), 400
        elif 'filename' in data:
            # ファイルから読み込む
            flow_path = Path(app.config['FLOWS_DIR']) / data['filename']
            if not app.flow_engine.load_flow(flow_path):
                return jsonify({'success': False, 'error': 'Failed to load flow'}), 400
        else:
            return jsonify({'success': False, 'error': 'No flow specified'}), 400
        
        # フロー実行
        result = app.flow_engine.execute_flow()
        return jsonify(result)
    
    @app.route('/api/execution/status', methods=['GET'])
    def get_execution_status():
        """実行状態を取得"""
        status = app.flow_engine.get_execution_status()
        return jsonify({'success': True, 'status': status})
    
    # === API: カメラ管理 ===
    
    @app.route('/api/camera/status', methods=['GET'])
    def get_camera_status():
        """カメラの状態を取得"""
        try:
            status = run(camera_manager.get_status())  # 非同期で状態を取得
            return jsonify({'success': True, 'status': status})
        except Exception as e:
            app.logger.error(f"カメラ状態取得エラー: {e}")
            return jsonify({'success': False, 'error': 'Failed to get camera status'}), 500

    @app.route('/api/camera/initialize', methods=['POST'])
    async def initialize_camera():
        """カメラを初期化"""
        try:
            success = await camera_manager.initialize_camera()
            if success:
                return jsonify({'success': True, 'message': 'Camera initialized successfully'})
            else:
                return jsonify({'success': False, 'error': 'Camera initialization failed'}), 400
        except Exception as e:
            app.logger.error(f"カメラ初期化エラー: {e}")
            return jsonify({'success': False, 'error': 'Failed to initialize camera'}), 500

    @app.route('/api/camera/cleanup', methods=['POST'])
    async def cleanup_camera():
        """カメラリソースをクリーンアップ"""
        try:
            await camera_manager.cleanup()
            return jsonify({'success': True, 'message': 'Camera cleaned up successfully'})
        except Exception as e:
            app.logger.error(f"カメラクリーンアップエラー: {e}")
            return jsonify({'success': False, 'error': 'Failed to clean up camera'}), 500
    
    # === エラーハンドラ ===
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'success': False, 'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Internal error: {error}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


def open_display_windows(port, delay=3):
    """
    サーバー起動後にディスプレイウィンドウを自動的に開く
    各ディスプレイに最大化されたウィンドウを配置
    
    Args:
        port: サーバーのポート番号
        delay: サーバー起動を待つ秒数
    """
    time.sleep(delay)  # サーバーの起動を待つ
    
    base_url = f"http://localhost:{port}"
    
    try:
        from screeninfo import get_monitors
        monitors = get_monitors()
        monitor_count = len(monitors)
        print(f"Detected {monitor_count} monitor(s).")
        for i, m in enumerate(monitors):
            print(f"  Monitor {i}: {m.width}x{m.height} at ({m.x}, {m.y})")
    except Exception as e:
        monitor_count = 1
        monitors = []
        print(f"Failed to inspect monitors ({e}). Using fallback.")
    
    def launch_with_positioning(label, path, monitor_index=0):
        """
        特定のモニターにウィンドウを配置して開く
        """
        url = f"{base_url}{path}"
        print(f"Opening {label} window: {url}")
        webbrowser.open_new(url)
        time.sleep(0.5)
    
    try:
        # メインウィンドウ（モニター0）
        launch_with_positioning('main', '/mapping/register', 0)
        
        # 部品棚ウィンドウ（モニター1、なければモニター0）
        if monitor_count >= 2:
            launch_with_positioning('parts', '/mapping/display/parts', 1)
        else:
            launch_with_positioning('parts', '/mapping/display/parts', 0)
        
        # 作業台ウィンドウ（モニター2、なければモニター0）
        if monitor_count >= 3:
            launch_with_positioning('workbench', '/mapping/display/workbench', 2)
        else:
            launch_with_positioning('workbench', '/mapping/display/workbench', 0)
            
    except Exception as e:
        print(f"Failed to open display windows: {e}")


def main():
    """メインエントリポイント"""
    # 環境変数から設定を取得
    config_name = os.environ.get('FLASK_ENV', 'development')
    port = int(os.environ.get('PORT', 5000))
    # アプリケーション終了時にカメラをクリーンアップ
    import atexit
    def cleanup_camera():
        try:
            print("[アプリ終了] カメラをクリーンアップします")
            camera_manager.cleanup()
        except Exception as e:
            print(f"[アプリ終了] カメラクリーンアップエラー: {e}")
    atexit.register(cleanup_camera)
    
    # # --- Crash logging: enable faulthandler and file logging early ---
    # try:
    #     import faulthandler
    #     log_dir = Path(__file__).parent.parent / 'logs'
    #     log_dir.mkdir(parents=True, exist_ok=True)
    #     crash_log = log_dir / 'crash.log'
    #     fh = open(crash_log, 'a')
    #     faulthandler.enable(file=fh)
    #     # redirect stdout/stderr to file as well for native crashes
    #     sys.stdout = fh
    #     sys.stderr = fh
    #     # also add a python logging FileHandler
    #     root_logger = logging.getLogger()
    #     file_handler = logging.FileHandler(str(log_dir / 'app.log'))
    #     file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    #     root_logger.addHandler(file_handler)
    #     root_logger.info('Crash logging enabled (faulthandler -> logs/crash.log)')
    # except Exception as e:
    #     print(f'Failed to enable crash logging: {e}')
    
    # アプリケーション作成
    app = create_app(config_name)
    
    # ディスプレイウィンドウの自動起動を無効化
    # ユーザーが手動でブラウザを開いて使用する
    if not app.config['TESTING']:
        # デバッグモードの場合は子プロセスでのみ実行、本番モードでは常に実行
        if not app.config['DEBUG'] or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            display_thread = threading.Thread(
                target=open_display_windows,
                args=(port,),
                daemon=True
            )
            display_thread.start()
            print("Display windows will open in 3 seconds...")
        else:
            print("Skipping window launch in reloader parent process.")
    
    # サーバー起動
    app.logger.info(f"Starting Flow Designer on port {port}")
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])


if __name__ == '__main__':
    main()
