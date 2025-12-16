"""
Module interface - モジュール統合の基底クラス
各機能モジュールはこのインターフェースを実装する
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Tuple
import logging


class ModuleInterface(ABC):
    """
    モジュール統合用の基底インターフェース
    
    全ての機能モジュール（3D検知、投影など）はこのクラスを継承し、
    必要なメソッドを実装する必要があります。
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Args:
            config: モジュール固有の設定
        """
        self.config = config or {}
        self.logger = logging.getLogger(self.__class__.__name__)
        self._initialized = False
    
    @abstractmethod
    def initialize(self) -> bool:
        """
        モジュールの初期化
        
        Returns:
            bool: 初期化成功時True
        """
        pass
    
    @abstractmethod
    def execute_action(self, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        フローから指定されたアクションを実行
        
        Args:
            action_type: アクションの種類（例: "wait_for_touch", "show_image"）
            parameters: アクション実行に必要なパラメータ
            
        Returns:
            Dict[str, Any]: 実行結果
                - success: bool - 成功/失敗
                - data: Any - 結果データ
                - message: str - メッセージ
                - error: str - エラー情報（失敗時）
        """
        pass
    
    @abstractmethod
    def get_status(self) -> Dict[str, Any]:
        """
        モジュールの現在の状態を取得
        
        Returns:
            Dict[str, Any]: 状態情報
                - ready: bool - 実行準備完了
                - busy: bool - 実行中
                - error: Optional[str] - エラー情報
                - details: Any - その他詳細情報
        """
        pass
    
    @abstractmethod
    def cleanup(self) -> bool:
        """
        モジュールの終了処理
        
        Returns:
            bool: 終了処理成功時True
        """
        pass
    
    @abstractmethod
    def get_capabilities(self) -> List[str]:
        """
        モジュールが提供する機能のリストを取得
        
        Returns:
            List[str]: 機能名のリスト（例: ["detect_touch", "measure_distance"]）
        """
        pass
    
    def validate_action(self, action_type: str, parameters: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        アクション実行前のパラメータ検証
        
        Args:
            action_type: アクションの種類
            parameters: パラメータ
            
        Returns:
            Tuple[bool, Optional[str]]: (検証成功, エラーメッセージ)
        """
        # デフォルト実装：サブクラスでオーバーライド可能
        if action_type not in self.get_capabilities():
            return False, f"Unknown action type: {action_type}"
        return True, None
    
    def is_ready(self) -> bool:
        """
        モジュールが実行可能な状態かチェック
        
        Returns:
            bool: 実行可能ならTrue
        """
        status = self.get_status()
        return status.get('ready', False) and not status.get('busy', False)


class ModuleMetadata:
    """モジュールのメタデータ"""
    
    def __init__(self, 
                 name: str,
                 display_name: str,
                 version: str,
                 author: str,
                 description: str,
                 capabilities: List[str],
                 flow_nodes: List[Dict[str, Any]],
                 api_endpoints: List[str]):
        self.name = name
        self.display_name = display_name
        self.version = version
        self.author = author
        self.description = description
        self.capabilities = capabilities
        self.flow_nodes = flow_nodes
        self.api_endpoints = api_endpoints
    
    def to_dict(self) -> Dict[str, Any]:
        """辞書形式に変換"""
        return {
            'name': self.name,
            'display_name': self.display_name,
            'version': self.version,
            'author': self.author,
            'description': self.description,
            'capabilities': self.capabilities,
            'flow_nodes': self.flow_nodes,
            'api_endpoints': self.api_endpoints
        }
