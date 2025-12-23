"""
Flow Engine - フロー定義に基づいてアクションを実行するエンジン
"""
import json
import logging
from typing import Dict, Any, List, Optional, Callable
from pathlib import Path
from enum import Enum

from .module_manager import ModuleManager


class FlowStepType(Enum):
    """フローステップの種類"""
    ACTION = "action"           # モジュールアクション実行
    CONDITION = "condition"     # 条件分岐
    LOOP = "loop"              # ループ
    WAIT = "wait"              # 待機
    PARALLEL = "parallel"      # 並列実行


class FlowStepStatus(Enum):
    """フローステップの実行状態"""
    PENDING = "pending"        # 未実行
    RUNNING = "running"        # 実行中
    COMPLETED = "completed"    # 完了
    FAILED = "failed"          # 失敗
    SKIPPED = "skipped"        # スキップ


class FlowEngine:
    """フロー実行エンジン"""
    
    def __init__(self, module_manager: ModuleManager):
        """
        Args:
            module_manager: モジュールマネージャー
        """
        self.module_manager = module_manager
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.setLevel(logging.DEBUG)
        
        # 実行状態
        self.current_flow: Optional[Dict[str, Any]] = None
        self.execution_context: Dict[str, Any] = {}
        self.step_results: List[Dict[str, Any]] = []
        
        # コールバック
        self.on_step_start: Optional[Callable] = None
        self.on_step_complete: Optional[Callable] = None
        self.on_flow_complete: Optional[Callable] = None
    
    def load_flow(self, flow_path: Path) -> bool:
        """
        フロー定義ファイルを読み込む
        
        Args:
            flow_path: フロー定義ファイルのパス
            
        Returns:
            bool: 読み込み成功時True
        """
        try:
            with open(flow_path, 'r', encoding='utf-8') as f:
                self.current_flow = json.load(f)
            self._log_flow_debug("file", str(flow_path), self.current_flow)
            
            # フロー定義の基本検証
            if not self._validate_flow(self.current_flow):
                self.logger.error("Invalid flow definition")
                return False
            
            self.logger.info(f"Loaded flow: {self.current_flow.get('name', 'Unnamed')}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to load flow: {e}")
            return False
    
    def load_flow_from_dict(self, flow_dict: Dict[str, Any]) -> bool:
        """
        辞書形式のフロー定義を読み込む
        
        Args:
            flow_dict: フロー定義
            
        Returns:
            bool: 読み込み成功時True
        """
        if not self._validate_flow(flow_dict):
            self.logger.error("Invalid flow definition")
            return False
        
        self.current_flow = flow_dict
        self.logger.info(f"Loaded flow: {flow_dict.get('name', 'Unnamed')}")
        self._log_flow_debug("dict", flow_dict.get('name', 'Unnamed'), flow_dict)
        return True
    
    def _validate_flow(self, flow: Dict[str, Any]) -> bool:
        """フロー定義の検証"""
        if not isinstance(flow, dict):
            return False
        
        # 必須フィールドのチェック
        if 'steps' not in flow or not isinstance(flow['steps'], list):
            return False
        
        return True
    
    def execute_flow(self, flow_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        フローを実行（辞書を直接渡すか、現在のフローを実行）
        
        Args:
            flow_data: フロー定義（Noneの場合は現在のフローを実行）
        
        Returns:
            Dict[str, Any]: 実行結果
                - success: bool
                - completed_steps: int
                - failed_steps: int
                - results: List[Dict]
                - error: Optional[str]
        """
        # 辞書が渡された場合はロード
        if flow_data is not None:
            if not self.load_flow_from_dict(flow_data):
                return {
                    'success': False,
                    'error': 'Failed to load flow'
                }
        
        if not self.current_flow:
            return {
                'success': False,
                'error': 'No flow loaded'
            }
        
        self.execution_context = {}
        self.step_results = []
        
        steps = self.current_flow.get('steps', [])
        completed = 0
        failed = 0
        
        self.logger.info(f"Starting flow execution: {len(steps)} steps")
        
        for i, step in enumerate(steps):
            step_id = step.get('id', f'step_{i}')
            self._log_step_debug(i, step)
            
            try:
                # ステップ開始コールバック
                if self.on_step_start:
                    self.on_step_start(step_id, step)
                
                # ステップ実行
                result = self.execute_step(step)
                
                # 結果を記録
                self.step_results.append({
                    'step_id': step_id,
                    'status': FlowStepStatus.COMPLETED.value if result['success'] else FlowStepStatus.FAILED.value,
                    'result': result
                })
                
                if result['success']:
                    completed += 1
                    self.logger.info(f"Step {step_id} completed")
                else:
                    failed += 1
                    self.logger.error(f"Step {step_id} failed: {result.get('error')}")
                    
                    # エラー時の動作
                    if step.get('on_error') == 'stop':
                        break
                
                # ステップ完了コールバック
                if self.on_step_complete:
                    self.on_step_complete(step_id, result)
                
            except Exception as e:
                self.logger.error(f"Exception in step {step_id}: {e}", exc_info=True)
                failed += 1
                self.step_results.append({
                    'step_id': step_id,
                    'status': FlowStepStatus.FAILED.value,
                    'result': {'success': False, 'error': str(e)}
                })
                
                if step.get('on_error') == 'stop':
                    break
        
        # フロー完了
        result = {
            'success': failed == 0,
            'completed_steps': completed,
            'failed_steps': failed,
            'total_steps': len(steps),
            'results': self.step_results
        }
        
        if self.on_flow_complete:
            self.on_flow_complete(result)
        
        self.logger.info(f"Flow execution finished: {completed}/{len(steps)} completed, {failed} failed")
        return result
    
    def execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """
        個別ステップの実行（外部からも呼び出し可能）
        
        Args:
            step: ステップ定義
            
        Returns:
            Dict[str, Any]: 実行結果
        """
        step_type = step.get('type', FlowStepType.ACTION.value)
        
        if step_type == FlowStepType.ACTION.value:
            return self._execute_action_step(step)
        elif step_type == FlowStepType.WAIT.value:
            return self._execute_wait_step(step)
        elif step_type == FlowStepType.CONDITION.value:
            return self._execute_condition_step(step)
        else:
            return {
                'success': False,
                'error': f'Unsupported step type: {step_type}'
            }
    
    def _execute_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """内部用ステップ実行（後方互換性のため残す）"""
        return self.execute_step(step)
    
    def _execute_action_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """アクションステップの実行"""
        module_name = step.get('module')
        action_type = step.get('action')
        parameters = step.get('parameters', {})
        self.logger.info(
            "Executing action step: module=%s action=%s parameters=%s",
            module_name,
            action_type,
            self._format_debug_value(parameters)
        )
        
        # モジュール取得
        module = self.module_manager.get_module(module_name)
        if not module:
            self.logger.error("Module not found for action step: module=%s", module_name)
            return {
                'success': False,
                'error': f'Module not found: {module_name}'
            }
        
        # モジュールの準備チェック
        if not module.is_ready():
            module_status = {}
            try:
                module_status = module.get_status()
            except Exception as status_error:
                self.logger.error(
                    "Failed to retrieve status from module %s: %s",
                    module_name,
                    status_error,
                    exc_info=True
                )
                module_status = {'error': str(status_error)}
            self.logger.error(
                "Module not ready: module=%s status=%s",
                module_name,
                module_status
            )
            
            return {
                'success': False,
                'error': f'Module not ready: {module_name}'
            }
        
        # アクション実行
        try:
            result = module.execute_action(action_type, parameters)
            self.logger.info(
                "Action result: module=%s action=%s result=%s",
                module_name,
                action_type,
                self._format_debug_value(result)
            )
            if not isinstance(result, dict):
                self.logger.error(
                    "Invalid action result type: module=%s action=%s type=%s",
                    module_name,
                    action_type,
                    type(result)
                )
                return {
                    'success': False,
                    'error': f'Invalid action result type: {type(result).__name__}'
                }

            if 'success' not in result:
                self.logger.error(
                    "Action result missing success flag: module=%s action=%s result=%s",
                    module_name,
                    action_type,
                    self._format_debug_value(result)
                )
                return {
                    'success': False,
                    'error': 'Action result missing success flag'
                }

            if not result.get('success', False):
                self.logger.warning(
                    "Action reported failure: module=%s action=%s error=%s",
                    module_name,
                    action_type,
                    result.get('error')
                )
            return result
        except Exception as e:
            self.logger.error(
                "Action execution failed: module=%s action=%s error=%s",
                module_name,
                action_type,
                e,
                exc_info=True
            )
            return {
                'success': False,
                'error': f'Action execution failed: {e}'
            }

    def _execute_wait_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """待機ステップの実行"""
        import time
        duration = step.get('duration', 0)
        
        try:
            time.sleep(duration)
            return {'success': True, 'message': f'Waited for {duration}s'}
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def _execute_condition_step(self, step: Dict[str, Any]) -> Dict[str, Any]:
        """条件分岐ステップの実行（将来実装）"""
        return {
            'success': False,
            'error': 'Condition steps not yet implemented'
        }
    
    def get_execution_status(self) -> Dict[str, Any]:
        """実行状態を取得"""
        return {
            'flow': self.current_flow.get('name') if self.current_flow else None,
            'total_steps': len(self.current_flow.get('steps', [])) if self.current_flow else 0,
            'completed_steps': len([r for r in self.step_results if r['status'] == FlowStepStatus.COMPLETED.value]),
            'failed_steps': len([r for r in self.step_results if r['status'] == FlowStepStatus.FAILED.value]),
            'step_results': self.step_results
        }

    def _log_flow_debug(self, source_type: str, source_identifier: str, flow: Dict[str, Any]) -> None:
        if not self.logger.isEnabledFor(logging.DEBUG):
            return
        steps = flow.get('steps', []) if isinstance(flow, dict) else []
        summaries: List[str] = []
        for idx, step in enumerate(steps[:10]):
            module = step.get('module') or step.get('type', 'unknown')
            action = step.get('action') or step.get('type', '-')
            summaries.append(f"{idx}:{module}:{action}")
        self.logger.debug(
            "Flow loaded (%s=%s) name=%s total_steps=%s sample_steps=%s",
            source_type,
            source_identifier,
            flow.get('name') if isinstance(flow, dict) else None,
            len(steps),
            summaries
        )

    def _log_step_debug(self, index: int, step: Dict[str, Any]) -> None:
        if not self.logger.isEnabledFor(logging.DEBUG):
            return
        step_id = step.get('id', f'step_{index}')
        step_type = step.get('type', FlowStepType.ACTION.value)
        module = step.get('module')
        action = step.get('action')
        self.logger.debug(
            "Preparing step[%s] id=%s type=%s module=%s action=%s parameters=%s",
            index,
            step_id,
            step_type,
            module,
            action,
            self._format_debug_value(step.get('parameters', {}))
        )

    def _format_debug_value(self, value: Any, max_length: int = 300) -> str:
        try:
            serialized = json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError):
            serialized = str(value)
        if len(serialized) > max_length:
            return serialized[:max_length] + '...'
        return serialized
