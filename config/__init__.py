"""
Configuration package
"""
from .base import BaseConfig
from .development import DevelopmentConfig
from .production import ProductionConfig

config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config(env='default'):
    """環境に応じた設定を取得"""
    return config_map.get(env, DevelopmentConfig)
