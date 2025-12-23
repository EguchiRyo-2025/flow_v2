"""
Base configuration
"""
import os
from pathlib import Path

# プロジェクトルートディレクトリ
BASE_DIR = Path(__file__).parent.parent


class BaseConfig:
    """基本設定"""
    
    # Flask基本設定
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = False
    TESTING = False
    
    # データベース設定
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # モジュール設定
    MODULES_DIR = BASE_DIR / 'modules'
    MODULE_AUTO_DISCOVER = True  # モジュールの自動検出
    
    # フロー設定
    FLOWS_DIR = BASE_DIR / 'data' / 'flows'  # フロー定義の保存先
    FLOW_EXECUTION_TIMEOUT = 3600  # フロー実行タイムアウト（秒）
    
    # ログ設定
    LOG_LEVEL = 'INFO'
    LOG_DIR = BASE_DIR / 'logs'
    
    # フロントエンド設定
    TEMPLATE_FOLDER = BASE_DIR / 'frontend' / 'templates'
    STATIC_FOLDER = BASE_DIR / 'frontend' / 'static'
    
    # ディスプレイマッピング設定（デフォルト値、実行時に上書き可能）
    DISPLAY_MAPPING = {}
    
    @staticmethod
    def init_app(app):
        """アプリケーション初期化時の処理"""
        # 必要なディレクトリを作成
        os.makedirs(BaseConfig.FLOWS_DIR, exist_ok=True)
        os.makedirs(BaseConfig.LOG_DIR, exist_ok=True)
        
        # ディスプレイマッピングを初期化
        try:
            from screeninfo import get_monitors
            monitors = get_monitors()
            
            # デフォルトのマッピング（モニター番号で指定）
            # monitor: メインモニター（通常0番）
            # parts: 部品棚用ディスプレイ（1番目の追加モニター）
            # workbench: 作業台用ディスプレイ（2番目の追加モニター）
            
            if len(monitors) > 0:
                app.config['DISPLAY_MAPPING']['monitor'] = monitors[0]
            if len(monitors) > 1:
                app.config['DISPLAY_MAPPING']['parts'] = monitors[1]
            if len(monitors) > 2:
                app.config['DISPLAY_MAPPING']['workbench'] = monitors[2]
                
            app.logger.info(f"Detected {len(monitors)} monitors")
            for i, mon in enumerate(monitors):
                app.logger.info(f"  Monitor {i}: {mon.width}x{mon.height} at ({mon.x}, {mon.y})")
                
        except Exception as e:
            app.logger.warning(f"Failed to initialize display mapping: {e}")
            # フォールバック: すべて同じディスプレイを使用
            from collections import namedtuple
            Monitor = namedtuple('Monitor', ['x', 'y', 'width', 'height'])
            default_monitor = Monitor(0, 0, 1920, 1080)
            app.config['DISPLAY_MAPPING']['monitor'] = default_monitor
            app.config['DISPLAY_MAPPING']['parts'] = default_monitor
            app.config['DISPLAY_MAPPING']['workbench'] = default_monitor
