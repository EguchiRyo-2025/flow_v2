"""
Development configuration
"""
from .base import BaseConfig, BASE_DIR


class DevelopmentConfig(BaseConfig):
    """開発環境設定"""
    
    DEBUG = True
    
    # SQLite（開発用）
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{BASE_DIR / "data" / "flow_dev.db"}'
    
    # ログレベル
    LOG_LEVEL = 'DEBUG'
    
    # 開発用：モジュールのホットリロード
    MODULE_HOT_RELOAD = True
