"""
Module Manager - モジュールの検出、読み込み、管理を行う
"""
import os
import json
import importlib
import sys
from pathlib import Path
from typing import Dict, List, Optional, Type, Any
import logging

from .module_interface import ModuleInterface, ModuleMetadata


class ModuleManager:
    """モジュールの管理クラス"""
    
    def __init__(self, modules_dir: Path):
        """
        Args:
            modules_dir: モジュールディレクトリのパス
        """
        self.modules_dir = Path(modules_dir)
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.DEBUG)
        
        # モジュール管理
        self.modules: Dict[str, ModuleInterface] = {}  # name -> instance
        self.metadata: Dict[str, ModuleMetadata] = {}  # name -> metadata
        
        # Pythonパスにモジュールディレクトリを追加
        if str(self.modules_dir) not in sys.path:
            sys.path.insert(0, str(self.modules_dir))
    
    def discover_modules(self) -> List[str]:
        """
        モジュールディレクトリを走査してモジュールを検出
        
        Returns:
            List[str]: 検出されたモジュール名のリスト
        """
        discovered = []
        
        if not self.modules_dir.exists():
            self.logger.warning(f"Modules directory not found: {self.modules_dir}")
            return discovered
        
        for item in self.modules_dir.iterdir():
            if item.is_dir() and not item.name.startswith('_'):
                # module_config.jsonの存在をチェック
                config_file = item / 'module_config.json'
                self.logger.debug("Inspecting candidate module directory: %s", item)
                if config_file.exists():
                    discovered.append(item.name)
                    self.logger.info(f"Discovered module: {item.name}")
                else:
                    self.logger.debug("Skipping %s (missing module_config.json)", item)
        
        return discovered
    
    def load_module_metadata(self, module_name: str) -> Optional[ModuleMetadata]:
        """
        モジュールのメタデータを読み込む
        
        Args:
            module_name: モジュール名
            
        Returns:
            ModuleMetadata: メタデータ、読み込み失敗時はNone
        """
        config_file = self.modules_dir / module_name / 'module_config.json'
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
            
            metadata = ModuleMetadata(
                name=config_data.get('name', module_name),
                display_name=config_data.get('display_name', module_name),
                version=config_data.get('version', '1.0.0'),
                author=config_data.get('author', 'Unknown'),
                description=config_data.get('description', ''),
                capabilities=config_data.get('capabilities', []),
                flow_nodes=config_data.get('flow_nodes', []),
                api_endpoints=config_data.get('api_endpoints', [])
            )
            
            return metadata
            
        except Exception as e:
            self.logger.error(f"Failed to load metadata for {module_name}: {e}")
            return None
    
    def load_module(self, module_name: str) -> bool:
        """
        モジュールを読み込んでインスタンス化
        
        Args:
            module_name: モジュール名
            
        Returns:
            bool: 読み込み成功時True
        """
        try:
            # メタデータを読み込み
            metadata = self.load_module_metadata(module_name)
            if not metadata:
                return False
            self.logger.debug("Loaded metadata for %s: %s", module_name, metadata.to_dict())
            
            # interfaceモジュールをインポート
            interface_module = importlib.import_module(f'{module_name}.interface')
            self.logger.debug("Imported interface module for %s: %s", module_name, interface_module)
            
            # ModuleInterfaceを継承したクラスを探す
            module_class = None
            for attr_name in dir(interface_module):
                attr = getattr(interface_module, attr_name)
                if (isinstance(attr, type) and 
                    issubclass(attr, ModuleInterface) and 
                    attr != ModuleInterface):
                    module_class = attr
                    break
            
            if not module_class:
                self.logger.error(f"No ModuleInterface implementation found in {module_name}.interface")
                return False
            
            # インスタンス化
            self.logger.debug("Instantiating module class %s.%s", module_class.__module__, module_class.__name__)
            module_instance = module_class()
            
            # 初期化
            if not module_instance.initialize():
                status = self._safe_get_status(module_instance)
                self.logger.error(f"Failed to initialize module: {module_name} (status={status})")
                return False
            self.logger.debug("Module %s.initialize() returned True", module_name)
            
            # 登録
            self.modules[module_name] = module_instance
            self.metadata[module_name] = metadata
            
            self.logger.info(f"Loaded module: {module_name} (v{metadata.version})")
            status = self._safe_get_status(module_instance)
            if status is not None:
                self.logger.info("Module %s status: %s", module_name, status) 
                self.logger.debug("Module %s status after load: %s", module_name, status)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to load module {module_name}: {e}", exc_info=True)
            return False
    
    def load_all_modules(self) -> Dict[str, bool]:
        """
        全てのモジュールを読み込む
        
        Returns:
            Dict[str, bool]: {モジュール名: 成功/失敗}
        """
        results = {}
        discovered = self.discover_modules()
        
        for module_name in discovered:
            success = self.load_module(module_name)
            results[module_name] = success
            self.logger.debug("Module %s load result: %s", module_name, success)
        self.logger.debug("Module load summary: %s", results)
        
        return results
    
    def get_module(self, module_name: str) -> Optional[ModuleInterface]:
        """
        モジュールインスタンスを取得
        
        Args:
            module_name: モジュール名
            
        Returns:
            ModuleInterface: モジュールインスタンス、存在しない場合はNone
        """
        return self.modules.get(module_name)
    
    def get_metadata(self, module_name: str) -> Optional[ModuleMetadata]:
        """
        モジュールのメタデータを取得
        
        Args:
            module_name: モジュール名
            
        Returns:
            ModuleMetadata: メタデータ、存在しない場合はNone
        """
        return self.metadata.get(module_name)
    
    def get_all_modules(self) -> Dict[str, ModuleInterface]:
        """全モジュールを取得"""
        return self.modules.copy()
    
    def get_all_metadata(self) -> Dict[str, ModuleMetadata]:
        """全モジュールのメタデータを取得"""
        return self.metadata.copy()
    
    def unload_module(self, module_name: str) -> bool:
        """
        モジュールをアンロード
        
        Args:
            module_name: モジュール名
            
        Returns:
            bool: アンロード成功時True
        """
        if module_name not in self.modules:
            return False
        
        try:
            # クリーンアップ
            self.modules[module_name].cleanup()
            
            # 削除
            del self.modules[module_name]
            del self.metadata[module_name]
            
            self.logger.info(f"Unloaded module: {module_name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to unload module {module_name}: {e}")
            return False
    
    def cleanup_all(self):
        """全モジュールのクリーンアップ"""
        for module_name in list(self.modules.keys()):
            self.unload_module(module_name)

    def _safe_get_status(self, module_instance: ModuleInterface) -> Optional[Dict[str, Any]]:
        try:
            return module_instance.get_status()
        except Exception as status_error:
            self.logger.debug(
                "Failed to retrieve status from module instance %s: %s",
                module_instance,
                status_error,
                exc_info=True
            )
            return None
