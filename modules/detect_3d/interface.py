"""
3D Detection Module Interface - 3D検知モジュールの統合インターフェース
"""
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import json
import os
import time

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.module_interface import ModuleInterface


class Detection3DModule(ModuleInterface):
    """3D検知モジュールの統合インターフェース実装"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.camera_manager = None
        self.origin_data_file = None
        self._busy = False
    
    def initialize(self) -> bool:
        """モジュールの初期化"""
        try:
            self.logger.info("Initializing 3D Detection module...")
            
            # camera_managerのインポートと初期化
            try:
                from .camera.camera_manager import camera_manager
                self.camera_manager = camera_manager
                self.logger.info("Camera manager initialized")
                print("Camera manager initialized")
            except ImportError as e:
                self.logger.warning(f"Camera manager import failed (may be OK in test environment): {e}")
                self.camera_manager = None
            
            # 原点データファイルのパス設定
            module_dir = Path(__file__).parent
            debug_dir = module_dir / 'debug'
            os.makedirs(debug_dir, exist_ok=True)
            self.origin_data_file = debug_dir / 'origin_data.json'
            
            self._initialized = True
            self.logger.info("3D Detection module initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize 3D Detection module: {e}", exc_info=True)
            return False
    
    def execute_action(self, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """アクションの実行"""
        # パラメータ検証
        is_valid, error_msg = self.validate_action(action_type, parameters)
        if not is_valid:
            return {'success': False, 'error': error_msg}
        
        try:
            self._busy = True
            
            if action_type == 'register_origin':
                return self._register_origin(parameters)
            elif action_type == 'detect_touch':
                return self._detect_touch(parameters)
            elif action_type == 'count_pixels':
                return self._count_pixels(parameters)
            elif action_type == 'get_origins':
                return self._get_origins(parameters)
            elif action_type == 'save_judge_data':
                return self._save_judge_data(parameters)
            elif action_type == 'capture_pixel_range':
                return self._capture_pixel_range(parameters)
            else:
                return {'success': False, 'error': f'Unknown action: {action_type}'}
                
        except Exception as e:
            self.logger.error(f"Action execution failed: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}
        finally:
            self._busy = False
    
    def _register_origin(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """原点を登録"""
        from .camera.depth_image import register_origin_logic
        
        origin_no = parameters.get('origin_no')
        points = parameters.get('points')
        comment = parameters.get('comment', '')
        
        # 既存データの読み込み
        if self.origin_data_file.exists():
            with open(self.origin_data_file, 'r', encoding='utf-8') as f:
                try:
                    existing_data = json.load(f)
                    print(f"Existing origin data loaded: {existing_data}")
                    if not isinstance(existing_data, list):
                        existing_data = []
                except json.JSONDecodeError:
                    existing_data = []
        else:
            existing_data = []
        
        # 編集時は同じNoを削除
        if origin_no is not None:
            existing_data = [d for d in existing_data if str(d.get('No')) != str(origin_no)]
        
        # 新しいNoを決定
        if not existing_data:
            new_no = 1
        else:
            existing_nos = sorted([d.get('No', 0) for d in existing_data])
            for i, no in enumerate(existing_nos):
                if no != i + 1:
                    return {'success': False, 'error': f"原点番号に歯抜けがあります。No.{i+1}が見つかりません。"}
            new_no = existing_nos[-1] + 1
        
        # 深度データ取得
        depth_result = register_origin_logic(points)
        if isinstance(depth_result, dict) and 'error' in depth_result:
            return {'success': False, 'error': depth_result['error']}
        
        # 原点データ作成
        origin_data = {
            "No": new_no,
            "points": points,
            "depth": depth_result,
            "comment": comment,
            "judge_settings": {
                "judge1": {"pixel_min": None, "pixel_max": None, "detect_time": 0.0, "comment": ""},
                "judge2": {"pixel_min": None, "pixel_max": None, "detect_time": 0.0, "comment": ""},
                "judge3": {"pixel_min": None, "pixel_max": None, "detect_time": 0.0, "comment": ""}
            }
        }
        existing_data.append(origin_data)
        
        # 保存
        with open(self.origin_data_file, 'w', encoding='utf-8') as f:
            json.dump(existing_data, f, ensure_ascii=False, indent=2)
        
        return {'success': True, 'data': origin_data, 'message': '原点登録成功'}
    
    def _detect_touch(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """タッチ検知（リアルタイム監視）"""
        from .camera.depth_image import detect_object_pixels_in_area
        
        # カメラマネージャーのチェック
        if not self.camera_manager:
            return {'success': False, 'error': 'カメラマネージャーが初期化されていません'}
        
        origin_no = parameters.get('origin_no')
        judge_no = parameters.get('judge_no')
        timeout = parameters.get('timeout')
        
        # 原点データ読み込み
        if not self.origin_data_file.exists():
            return {'success': False, 'error': '原点データが見つかりません'}
        
        with open(self.origin_data_file, 'r', encoding='utf-8') as f:
            origin_data_list = json.load(f)
        
        # 該当原点を検索
        origin_data = None
        for data in origin_data_list:
            if data.get('No') == origin_no:
                origin_data = data
                break
        
        if not origin_data:
            return {'success': False, 'error': f'原点No.{origin_no}が見つかりません'}
        
        # 判定設定取得
        judge_key = f"judge{judge_no}"
        judge_settings = origin_data.get('judge_settings', {}).get(judge_key)
        
        if not judge_settings or judge_settings.get('pixel_min') is None:
            return {'success': False, 'error': f'判定{judge_no}の設定が見つかりません'}
        
        pixel_min = judge_settings['pixel_min']
        pixel_max = judge_settings['pixel_max']
        detect_time = judge_settings.get('detect_time', 0.0)
        
        # 矩形範囲計算
        points = origin_data['points']
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        x1, x2 = min(x_coords), max(x_coords)
        y1, y2 = min(y_coords), max(y_coords)
        
        depth_info = origin_data.get('depth', {})
        depth_min = depth_info.get('depth_min', depth_info.get('min'))
        depth_max = depth_info.get('depth_max', depth_info.get('max'))
        if depth_min is None or depth_max is None:
            return {'success': False, 'error': '原点データの深度情報が不正です'}
        
        # タッチ検知ループ
        start_time = time.time()
        detected_start = None
        
        while time.time() - start_time < timeout:
            try:
                result = detect_object_pixels_in_area(x1, y1, x2, y2, depth_min, depth_max)
                
                if 'error' in result:
                    self.logger.warning(f"深度データ取得エラー: {result['error']}")
                    time.sleep(0.1)
                    continue
                
                pixel_count = result.get("pixel_count", 0)
                
                # 範囲内判定
                if pixel_min <= pixel_count <= pixel_max:
                    if detected_start is None:
                        detected_start = time.time()
                    elif time.time() - detected_start >= detect_time:
                        # 検知成功
                        return {
                            'success': True,
                            'detected': True,
                            'pixel_count': pixel_count,
                            'elapsed_time': time.time() - start_time,
                            'message': 'タッチ検知成功'
                        }
                else:
                    detected_start = None
                
                time.sleep(0.1)
                
            except Exception as e:
                self.logger.error(f"タッチ検知処理エラー: {e}", exc_info=True)
                time.sleep(0.1)
                continue
        
        # タイムアウト
        return {
            'success': False,
            'detected': False,
            'error': 'タイムアウト',
            'elapsed_time': timeout
        }
    
    def _count_pixels(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """ピクセル数をカウント"""
        from .camera.depth_image import detect_object_pixels_in_area
        
        points = parameters.get('points')
        depth_min = parameters.get('depth_min')
        depth_max = parameters.get('depth_max')
        
        # 矩形範囲計算
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        x1, x2 = min(x_coords), max(x_coords)
        y1, y2 = min(y_coords), max(y_coords)
        
        result = detect_object_pixels_in_area(x1, y1, x2, y2, depth_min, depth_max)
        
        if 'error' in result:
            return {'success': False, 'error': result['error']}
        
        return {
            'success': True,
            'pixel_count': result.get("pixel_count", 0),
            'message': 'ピクセルカウント成功'
        }
    
    def _get_origins(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """登録された原点データを取得"""
        if self.origin_data_file.exists():
            with open(self.origin_data_file, 'r', encoding='utf-8') as f:
                try:
                    origins = json.load(f)
                    return {'success': True, 'data': origins}
                except json.JSONDecodeError:
                    return {'success': True, 'data': []}
        else:
            return {'success': True, 'data': []}
    
    def _save_judge_data(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """判定データを保存"""
        origin_no = parameters.get('origin_no')
        judge_data = parameters.get('judge_data')
        
        if not self.origin_data_file.exists():
            return {'success': False, 'error': '原点データファイルが見つかりません'}
        
        with open(self.origin_data_file, 'r', encoding='utf-8') as f:
            origin_data = json.load(f)
        
        # 該当原点を更新
        updated = False
        for origin in origin_data:
            if origin.get('No') == origin_no:
                if 'judge_settings' not in origin:
                    origin['judge_settings'] = {}
                
                for judge_item in judge_data:
                    judge_no = judge_item.get('judge_no')
                    judge_key = f"judge{judge_no}"
                    origin['judge_settings'][judge_key] = {
                        "pixel_min": int(judge_item.get('pixel_min')) if judge_item.get('pixel_min') else None,
                        "pixel_max": int(judge_item.get('pixel_max')) if judge_item.get('pixel_max') else None,
                        "detect_time": float(judge_item.get('detect_time')) if judge_item.get('detect_time') else 0.0,
                        "comment": judge_item.get('comment', '')
                    }
                
                updated = True
                break
        
        if not updated:
            return {'success': False, 'error': f'原点No.{origin_no}が見つかりません'}
        
        # 保存
        with open(self.origin_data_file, 'w', encoding='utf-8') as f:
            json.dump(origin_data, f, ensure_ascii=False, indent=2)
        
        return {'success': True, 'message': '判定設定を保存しました'}
    
    def _capture_pixel_range(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """5フレーム計測してピクセル範囲を取得"""
        from .camera.depth_image import detect_object_pixels_in_area
        
        origin_no = parameters.get('origin_no')
        judge_no = parameters.get('judge_no')
        points = parameters.get('points')
        depth_min = parameters.get('depth_min')
        depth_max = parameters.get('depth_max')
        
        # 矩形範囲計算
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        x1, x2 = min(x_coords), max(x_coords)
        y1, y2 = min(y_coords), max(y_coords)
        
        # 5フレーム計測
        pixel_counts = []
        for frame in range(5):
            result = detect_object_pixels_in_area(x1, y1, x2, y2, depth_min, depth_max)
            if 'error' in result:
                continue
            pixel_counts.append(result.get("pixel_count", 0))
            time.sleep(0.1)
        
        if not pixel_counts:
            return {'success': False, 'error': '有効なフレームデータを取得できませんでした'}
        
        pixel_min = min(pixel_counts)
        pixel_max = max(pixel_counts)
        
        # JSONファイルを更新
        if self.origin_data_file.exists():
            with open(self.origin_data_file, 'r', encoding='utf-8') as f:
                origin_data = json.load(f)
            
            for origin in origin_data:
                if origin.get('No') == origin_no:
                    if 'judge_settings' not in origin:
                        origin['judge_settings'] = {}
                    
                    judge_key = f"judge{judge_no}"
                    if judge_key not in origin['judge_settings']:
                        origin['judge_settings'][judge_key] = {
                            "pixel_min": None, "pixel_max": None,
                            "detect_time": 0.0, "comment": ""
                        }
                    
                    origin['judge_settings'][judge_key]['pixel_min'] = pixel_min
                    origin['judge_settings'][judge_key]['pixel_max'] = pixel_max
                    break
            
            with open(self.origin_data_file, 'w', encoding='utf-8') as f:
                json.dump(origin_data, f, ensure_ascii=False, indent=2)
        
        return {
            'success': True,
            'pixel_min': pixel_min,
            'pixel_max': pixel_max,
            'frame_counts': pixel_counts,
            'message': '5フレーム計測完了'
        }
    
    def get_status(self) -> Dict[str, Any]:
        """モジュールの状態取得"""
        return {
            'ready': self._initialized and self.camera_manager is not None,
            'busy': self._busy,
            'error': None,
            'details': {
                'camera_available': self.camera_manager is not None,
                'origin_data_file': str(self.origin_data_file) if self.origin_data_file else None
            }
        }
    
    def cleanup(self) -> bool:
        """終了処理"""
        try:
            self.logger.info("Cleaning up 3D Detection module...")
            
            # camera_managerはシングルトンで他のページ（検知画面など）でも使用されるため
            # ここではクリーンアップしない。アプリケーション終了時にapp.pyのatexitで処理される
            # if self.camera_manager:
            #     self.camera_manager.cleanup()
            
            self._initialized = False
            return True
            
        except Exception as e:
            self.logger.error(f"Cleanup failed: {e}")
            return False
    
    def get_capabilities(self) -> List[str]:
        """提供する機能のリスト"""
        return [
            'register_origin',
            'detect_touch',
            'count_pixels',
            'get_origins',
            'save_judge_data',
            'capture_pixel_range'
        ]
