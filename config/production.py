"""
Production configuration
"""
import os
from .base import BaseConfig


class ProductionConfig(BaseConfig):
    """本番環境設定"""
    
    DEBUG = False
    
    # PostgreSQL（本番用）
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'postgresql://user:password@localhost/flow_db'
    
    # ログレベル
    LOG_LEVEL = 'WARNING'
    
    # セキュリティ
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    
    @staticmethod
    def init_app(app):
        """本番環境用の初期化処理"""
        BaseConfig.init_app(app)
        
        # 本番環境用のログ設定など
        import logging
        from logging.handlers import RotatingFileHandler
        
        file_handler = RotatingFileHandler(
            BaseConfig.LOG_DIR / 'flow.log',
            maxBytes=10240000,
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.WARNING)
        app.logger.addHandler(file_handler)
