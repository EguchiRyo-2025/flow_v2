"""
Flow Designer Module Interface
"""
import sys
from pathlib import Path
from typing import Dict, Any, List
import json

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.module_interface import ModuleInterface


class FlowDesignerModule(ModuleInterface):
    """フロー設計モジュールのインターフェース"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.name = "flow_designer"
        self.display_name = "フロー設計"
    
    def initialize(self) -> bool:
        """モジュールの初期化"""
        try:
            self.logger.info("Initializing Flow Designer module...")
            self._initialized = True
            self.logger.info("Flow Designer module initialized successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize Flow Designer module: {e}", exc_info=True)
            return False
    
    def execute_action(self, action: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        アクションを実行
        
        Args:
            action: 実行するアクション名
            parameters: パラメータ
            
        Returns:
            実行結果
        """
        if action == "create_flow":
            return self._create_flow(parameters)
        elif action == "execute_flow":
            return self._execute_flow(parameters)
        else:
            return {"success": False, "error": f"Unknown action: {action}"}
    
    def get_status(self) -> Dict[str, Any]:
        """モジュールのステータスを取得"""
        return {
            "ready": self._initialized,
            "busy": False,
            "error": None,
            "details": {
                "name": self.name,
                "display_name": self.display_name
            }
        }
    
    def cleanup(self) -> bool:
        """モジュールの終了処理"""
        try:
            self.logger.info("Cleaning up Flow Designer module...")
            self._initialized = False
            return True
        except Exception as e:
            self.logger.error(f"Failed to cleanup Flow Designer module: {e}", exc_info=True)
            return False
    
    def get_capabilities(self) -> List[str]:
        """提供する機能のリスト"""
        return [
            "create_flow",
            "edit_flow",
            "delete_flow",
            "execute_flow",
            "list_flows",
            "get_flow_status"
        ]
    
    def _create_flow(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """フローを作成"""
        return {
            "success": True,
            "message": "Flow created"
        }
    
    def _execute_flow(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """フローを実行"""
        return {
            "success": True,
            "message": "Flow execution started"
        }
