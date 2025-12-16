"""
Projection Mapping Module Interface - 投影マッピングモジュールの統合インターフェース
"""
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import sqlite3
import os
import uuid
from PIL import Image

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from core.module_interface import ModuleInterface


class ProjectionMappingModule(ModuleInterface):
    """プロジェクションマッピングモジュールの統合インターフェース実装"""
    
    def __init__(self, config: Dict[str, Any] = None):
        super().__init__(config)
        self.db_path = None
        self.upload_folder = None
        self.current_group_id = None
        self._busy = False
    
    def initialize(self) -> bool:
        """モジュールの初期化"""
        try:
            self.logger.info("Initializing Projection Mapping module...")
            
            # パス設定
            module_dir = Path(__file__).parent
            self.db_path = module_dir / 'mapping_figure.db'
            self.upload_folder = module_dir / 'assets' / 'images'
            os.makedirs(self.upload_folder, exist_ok=True)
            
            # データベース接続テスト
            conn = self._get_db_connection()
            if conn:
                conn.close()
                self.logger.info("Database connection successful")
            else:
                self.logger.warning("Database connection failed")
                return False
            
            self._initialized = True
            self.logger.info("Projection Mapping module initialized successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to initialize Projection Mapping module: {e}", exc_info=True)
            return False
    
    def _get_db_connection(self):
        """データベース接続を取得"""
        try:
            conn = sqlite3.connect(str(self.db_path))
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as e:
            self.logger.error(f"Database connection error: {e}")
            return None
    
    def execute_action(self, action_type: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """アクションの実行"""
        # パラメータ検証
        is_valid, error_msg = self.validate_action(action_type, parameters)
        if not is_valid:
            return {'success': False, 'error': error_msg}
        
        try:
            self._busy = True
            self.logger.info(
                "execute_action start | action=%s parameters=%s",
                action_type,
                parameters
            )
            
            if action_type == 'upload_image':
                return self._upload_image(parameters)
            elif action_type == 'create_group':
                return self._create_group(parameters)
            elif action_type == 'add_element_to_group':
                return self._add_element_to_group(parameters)
            elif action_type == 'update_element':
                return self._update_element(parameters)
            elif action_type == 'delete_element':
                return self._delete_element(parameters)
            elif action_type == 'show_group':
                return self._show_group(parameters)
            elif action_type == 'hide_group':
                return self._hide_group(parameters)
            elif action_type == 'open_preview':
                return self._open_preview(parameters)
            elif action_type == 'get_groups':
                return self._get_groups(parameters)
            elif action_type == 'get_group_elements':
                return self._get_group_elements(parameters)
            else:
                return {'success': False, 'error': f'Unknown action: {action_type}'}
                
        except Exception as e:
            self.logger.error(f"Action execution failed: {e}", exc_info=True)
            return {'success': False, 'error': str(e)}
        finally:
            self._busy = False
    
    def _upload_image(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """画像をアップロードして登録"""
        file_path = parameters.get('file_path')
        
        if not file_path or not os.path.exists(file_path):
            return {'success': False, 'error': 'ファイルが見つかりません'}
        
        try:
            # ファイルをコピー
            ext = os.path.splitext(file_path)[1].lower()
            unique_name = f"{uuid.uuid4().hex}{ext}"
            dest_path = self.upload_folder / unique_name
            
            # 画像をコピー
            import shutil
            shutil.copy(file_path, dest_path)
            
            # 画像サイズ取得
            with Image.open(dest_path) as img:
                width, height = img.size
            
            # DBに登録
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            relative_path = str(dest_path).replace('\\', '/')
            mime_type = f'image/{ext[1:]}'
            
            cursor.execute("""
                INSERT INTO image_assets (file_path, width, height, mime_type)
                VALUES (?, ?, ?, ?)
            """, (relative_path, width, height, mime_type))
            
            image_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return {
                'success': True,
                'data': {
                    'id': image_id,
                    'file_path': relative_path,
                    'width': width,
                    'height': height
                },
                'message': '画像アップロード成功'
            }
            
        except Exception as e:
            return {'success': False, 'error': f'画像アップロードエラー: {e}'}
    
    def _create_group(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """新しいグループを作成"""
        comment = parameters.get('comment', '')
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        # 最大のgroup_numberを取得
        cursor.execute("SELECT MAX(group_number) FROM groups WHERE project_id = 1")
        max_number = cursor.fetchone()[0] or 0
        new_number = max_number + 1
        
        cursor.execute("""
            INSERT INTO groups (project_id, group_number, comment)
            VALUES (?, ?, ?)
        """, (1, new_number, comment))
        
        group_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'data': {'id': group_id, 'group_number': new_number},
            'message': 'グループ作成成功'
        }
    
    def _add_element_to_group(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """グループに要素を追加"""
        group_id = parameters.get('group_id')
        image_asset_id = parameters.get('image_asset_id')
        x = parameters.get('x', 0)
        y = parameters.get('y', 0)
        scale = parameters.get('scale', 1.0)
        display_target = parameters.get('display_target', 'monitor')
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO group_elements (
                group_id, element_type, image_asset_id,
                display_target, x_position, y_position, scale
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (group_id, 'image', image_asset_id, display_target, x, y, scale))
        
        element_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {
            'success': True,
            'data': {'id': element_id, 'group_id': group_id},
            'message': '要素追加成功'
        }
    
    def _update_element(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """要素を更新"""
        element_id = parameters.get('element_id')
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        # 更新するフィールドを動的に構築
        update_fields = []
        values = []
        
        for field in ['x_position', 'y_position', 'scale', 'rotation', 'display_target']:
            if field in parameters or (field == 'x_position' and 'x' in parameters) or (field == 'y_position' and 'y' in parameters):
                update_fields.append(f'{field} = ?')
                if field == 'x_position':
                    values.append(parameters.get('x_position', parameters.get('x', 0)))
                elif field == 'y_position':
                    values.append(parameters.get('y_position', parameters.get('y', 0)))
                else:
                    values.append(parameters[field])
        
        if not update_fields:
            return {'success': False, 'error': '更新するフィールドがありません'}
        
        values.append(element_id)
        sql = f"UPDATE group_elements SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, values)
        
        conn.commit()
        conn.close()
        
        return {'success': True, 'message': '要素更新成功'}
    
    def _delete_element(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """要素を削除"""
        element_id = parameters.get('element_id')
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM group_elements WHERE id = ?", (element_id,))
        conn.commit()
        conn.close()
        
        return {'success': True, 'message': '要素削除成功'}
    
    def _show_group(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """グループを表示（フロー実行時に使用）"""
        group_id = parameters.get('group_id')
        display_target = parameters.get('display_target')
        state = parameters.get('state', 'on')
        
        self.current_group_id = group_id
        
        resolved_targets: List[str] = []

        if group_id:
            resolved_targets = self._get_group_display_targets(group_id)

        if display_target:
            display_target = str(display_target).strip()

        if not display_target and resolved_targets:
            display_target = resolved_targets[0]

        if not display_target:
            display_target = 'monitor'

        preview_element: Dict[str, Any] = {}
        try:
            elements_response = self._get_group_elements({'group_id': group_id})
            elements_data = []
            if isinstance(elements_response, dict):
                if elements_response.get('success', True):
                    elements_data = elements_response.get('data', []) or []
            elif isinstance(elements_response, list):
                elements_data = elements_response

            candidate = None
            if elements_data:
                if display_target:
                    for element in elements_data:
                        if str(element.get('display_target')) == str(display_target):
                            candidate = element
                            break
                if candidate:
                    width = candidate.get('width')
                    if width is None:
                        width = candidate.get('image_width')
                    if width is None:
                        width = candidate.get('original_width')
                    if width is None:
                        width = 200

                    height = candidate.get('height')
                    if height is None:
                        height = candidate.get('image_height')
                    if height is None:
                        height = candidate.get('original_height')
                    if height is None:
                        height = 200

                    x_pos = candidate.get('x_position')
                    if x_pos is None:
                        x_pos = candidate.get('x')
                    if x_pos is None:
                        x_pos = 0

                    y_pos = candidate.get('y_position')
                    if y_pos is None:
                        y_pos = candidate.get('y')
                    if y_pos is None:
                        y_pos = 0

                    scale = candidate.get('scale')
                    if scale is None:
                        scale = 1.0

                    rotation = candidate.get('rotation')
                    if rotation is None:
                        rotation = 0

                preview_element = {
                    'id': candidate.get('id'),
                    'group_id': group_id,
                    'file_path': candidate.get('file_path'),
                    'width': width,
                    'height': height,
                    'x': x_pos,
                    'y': y_pos,
                    'scale': scale,
                    'rotation': rotation,
                    'display_target': str(candidate.get('display_target') or display_target or 'monitor'),
                    'isPreview': True,
                    'previewSource': 'flow-execution'
                }
        except Exception as preview_error:
            self.logger.warning(
                "Failed to build preview element for group %s: %s",
                group_id,
                preview_error,
                exc_info=True
            )
            preview_element = {}
        
        self.logger.info(
            "show_group resolved | group=%s target=%s state=%s preview_available=%s",
            group_id,
            display_target,
            state,
            bool(preview_element)
        )

        return {
            'success': True,
            'data': {
                'group_id': group_id,
                'display_target': display_target,
                'resolved_display_targets': resolved_targets,
                'state': state,
                'preview': preview_element or None
            },
            'message': f'グループ{group_id}を表示'
        }
    
    def _hide_group(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """グループを非表示"""
        self.current_group_id = None
        
        return {'success': True, 'message': 'グループを非表示'}
    
    def _open_preview(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """プレビューウィンドウを開く"""
        display_target = parameters.get('display_target', 'monitor')
        
        preview_url = f'/preview/{display_target}'
        
        return {
            'success': True,
            'data': {'url': preview_url, 'display_target': display_target},
            'message': 'プレビュー準備完了'
        }
    
    def _get_groups(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """グループ一覧を取得"""
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM groups 
            WHERE project_id = 1
            ORDER BY group_number
        """)
        
        rows = cursor.fetchall()
        groups = [dict(row) for row in rows]
        conn.close()
        
        return {'success': True, 'data': groups}
    
    def _get_group_elements(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """グループの要素一覧を取得"""
        group_id = parameters.get('group_id')
        state = parameters.get('state', 'on')
        
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                ge.*,
                ia.file_path,
                ia.width as image_width,
                ia.height as image_height
            FROM group_elements ge
            LEFT JOIN image_assets ia ON ge.image_asset_id = ia.id
            WHERE ge.group_id = ?
            ORDER BY ge.id
        """, (group_id,))
        
        rows = cursor.fetchall()
        elements = [dict(row) for row in rows]
        conn.close()
        
        return {'success': True, 'data': elements}

    def _get_group_display_targets(self, group_id: Any) -> List[str]:
        """対象グループで使用されているdisplay_targetを取得"""
        if not group_id:
            return []

        conn = self._get_db_connection()
        if not conn:
            return []

        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                    SELECT DISTINCT display_target
                    FROM group_elements
                    WHERE group_id = ?
                    ORDER BY display_target
                """,
                (group_id,)
            )
            rows = cursor.fetchall()
            targets: List[str] = []
            for row in rows:
                target = None
                if isinstance(row, dict):
                    target = row.get('display_target')
                else:
                    # sqlite3.Row は dict としてもタプルとしてもアクセス可能
                    target = row[0]
                if target:
                    targets.append(str(target))
            return targets
        except Exception as exc:
            self.logger.error(
                "Failed to resolve display_target for group %s: %s",
                group_id,
                exc,
                exc_info=True
            )
            return []
        finally:
            conn.close()
    
    def get_status(self) -> Dict[str, Any]:
        """モジュールの状態取得"""
        return {
            'ready': self._initialized and self.db_path.exists(),
            'busy': self._busy,
            'error': None,
            'details': {
                'db_path': str(self.db_path),
                'upload_folder': str(self.upload_folder),
                'current_group_id': self.current_group_id
            }
        }
    
    def cleanup(self) -> bool:
        """終了処理"""
        try:
            self.logger.info("Cleaning up Projection Mapping module...")
            self._initialized = False
            return True
            
        except Exception as e:
            self.logger.error(f"Cleanup failed: {e}")
            return False
    
    def get_capabilities(self) -> List[str]:
        """提供する機能のリスト"""
        return [
            'upload_image',
            'create_group',
            'add_element_to_group',
            'update_element',
            'delete_element',
            'show_group',
            'hide_group',
            'open_preview',
            'get_groups',
            'get_group_elements'
        ]
