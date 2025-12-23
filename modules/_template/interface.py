"""
Template Module Interface - 新しいモジュールのインターフェーステンプレート
"""
import sys
from pathlib import Path
from typing import Dict, Any, List

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.module_interface import ModuleInterface


class TemplateModule(ModuleInterface):
    """テンプレートモジュールの実装例"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        # モジュール固有の初期化
        self.internal_state = {}
    
    def initialize(self) -> bool:
        """
        モジュールの初期化
        ハードウェアの接続、リソースの確保など
        """
        try:
            self.logger.info("Initializing template module...")
            
            # ここに初期化処理を記述
            # 例: カメラの接続、設定ファイルの読み込みなど
            
            self._initialized = True
            self.logger.info("Template module initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize: {e}")
            return False
    
    def execute_action(self, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        アクションの実行
        
        Args:
            action_type: アクションの種類
            parameters: パラメータ
            
        Returns:
            実行結果
        """
        # パラメータ検証
        is_valid, error_msg = self.validate_action(action_type, parameters)
        if not is_valid:
            return {
                'success': False,
                'error': error_msg
            }
        
        # アクションの実行
        try:
            if action_type == 'example_action':
                return self._example_action(parameters)
            else:
                return {
                    'success': False,
                    'error': f'Unknown action: {action_type}'
                }
                
        except Exception as e:
            self.logger.error(f"Action execution failed: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    def _example_action(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """サンプルアクションの実装"""
        param1 = parameters.get('param1', '')
        param2 = parameters.get('param2', 0)
        
        self.logger.info(f"Executing example action: param1={param1}, param2={param2}")
        
        # ここに実際の処理を記述
        result_data = {
            'processed_param1': param1.upper(),
            'calculated_param2': param2 * 2
        }
        
        return {
            'success': True,
            'data': result_data,
            'message': 'Example action completed'
        }
    
    def get_status(self) -> Dict[str, Any]:
        """モジュールの状態取得"""
        return {
            'ready': self._initialized,
            'busy': False,
            'error': None,
            'details': self.internal_state
        }
    
    def cleanup(self) -> bool:
        """終了処理"""
        try:
            self.logger.info("Cleaning up template module...")
            
            # ここに終了処理を記述
            # 例: リソースの解放、接続の切断など
            
            self._initialized = False
            return True
            
        except Exception as e:
            self.logger.error(f"Cleanup failed: {e}")
            return False
    
    def get_capabilities(self) -> List[str]:
        """提供する機能のリスト"""
        return ['example_action']
