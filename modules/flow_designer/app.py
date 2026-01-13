"""
Flow Designer Module - フロー設計・実行モジュール
"""
from flask import Blueprint, render_template, jsonify, request
from datetime import datetime
from pathlib import Path
import json
import uuid
import threading

MODULE_DIR = Path(__file__).parent
TEMPLATES_DIR = MODULE_DIR / 'templates'
STATIC_DIR = MODULE_DIR / 'static'
DATA_DIR = MODULE_DIR.parent.parent / 'data' / 'flows'

# データディレクトリを作成
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 実行状態を保持する辞書
execution_states = {}
execution_locks = {}

# url_prefix='/flow' で登録されるため、ルートは相対パスで定義
# Blueprint作成
flow_designer_bp = Blueprint(
    'flow_designer_bp',
    __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/static/flow_designer'
)


# 実際のURL: /flow/list（リダイレクト）
@flow_designer_bp.route('/list')
def flow_list():
    """フロー一覧画面（リダイレクト）"""
    from flask import redirect
    return redirect('/flow/designer')


# 実際のURL: /flow/designer
@flow_designer_bp.route('/designer')
@flow_designer_bp.route('/')
def flow_designer():
    """フロー設計画面
    
    注意：フロー実行時にdetect_3dモジュールを使用する可能性があるため、
    ページ進入時にカメラを事前初期化する。
    """
    # フロー実行ページ進入時にカメラを初期化（非同期）
    try:
        from modules.detect_3d.camera.camera_manager import camera_manager
        if camera_manager and hasattr(camera_manager, 'start'):
            # start()は重複呼び出しで自動的にスキップされるため安全
            camera_manager.start()
    except Exception as e:
        # カメラ初期化失敗は無視（カメラなしのシステムの可能性もある）
        pass
    
    return render_template('flow_designer.html')


@flow_designer_bp.route('/api/flows', methods=['GET'])
def get_flows():
    """フロー一覧を取得"""
    try:
        flows = []
        for flow_file in DATA_DIR.glob('*.json'):
            with open(flow_file, 'r', encoding='utf-8') as f:
                flow_data = json.load(f)
                flows.append({
                    'id': flow_file.stem,
                    'name': flow_data.get('name', ''),
                    'description': flow_data.get('description', ''),
                    'step_count': len(flow_data.get('steps', []))
                })
        
        return jsonify({'success': True, 'flows': flows})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows/<flow_id>', methods=['GET'])
def get_flow(flow_id):
    """特定のフローを取得"""
    try:
        flow_file = DATA_DIR / f'{flow_id}.json'
        
        if not flow_file.exists():
            # defaultフローが存在しない場合は空のフローを返す
            if flow_id == 'default':
                default_flow = {
                    'id': 'default',
                    'name': 'メインフロー',
                    'description': '',
                    'steps': []
                }
                return jsonify({'success': True, 'flow': default_flow})
            
            return jsonify({'success': False, 'error': 'Flow not found'}), 404
        
        with open(flow_file, 'r', encoding='utf-8') as f:
            flow_data = json.load(f)
        
        return jsonify({'success': True, 'flow': flow_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows', methods=['POST'])
def save_flow():
    """フローを保存"""
    try:
        flow_data = request.json
        
        # IDがない場合は新規作成
        if 'id' not in flow_data:
            flow_data['id'] = str(uuid.uuid4())
        
        flow_id = flow_data['id']
        flow_file = DATA_DIR / f'{flow_id}.json'
        
        with open(flow_file, 'w', encoding='utf-8') as f:
            json.dump(flow_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'id': flow_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows/<flow_id>', methods=['PUT'])
def update_flow(flow_id):
    """フローを更新（上書き保存）"""
    try:
        flow_data = request.json
        flow_data['id'] = flow_id
        
        flow_file = DATA_DIR / f'{flow_id}.json'
        
        with open(flow_file, 'w', encoding='utf-8') as f:
            json.dump(flow_data, f, ensure_ascii=False, indent=2)
        
        return jsonify({'success': True, 'id': flow_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows/<flow_id>', methods=['DELETE'])
def delete_flow(flow_id):
    """フローを削除"""
    try:
        flow_file = DATA_DIR / f'{flow_id}.json'
        
        if not flow_file.exists():
            return jsonify({'success': False, 'error': 'Flow not found'}), 404
        
        flow_file.unlink()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows/<flow_id>/execute', methods=['POST'])
def execute_flow(flow_id):
    """フローを実行"""
    try:
        from flask import current_app
        import logging
        logger = logging.getLogger(__name__)
        
        # 既に実行中かチェック
        if flow_id in execution_states and execution_states[flow_id].get('is_running'):
            return jsonify({'success': False, 'error': 'フローは既に実行中です'}), 400
        
        # リクエストボディにフローデータがある場合はそれを使用（テスト実行用）
        flow_data = request.get_json(silent=True)
        logger.info(f"Execute flow request: {flow_data}")
        
        if not flow_data or 'steps' not in flow_data:
            # リクエストボディがない場合はファイルから読み込む
            flow_file = DATA_DIR / f'{flow_id}.json'
            
            if not flow_file.exists():
                return jsonify({'success': False, 'error': 'Flow not found'}), 404
            
            with open(flow_file, 'r', encoding='utf-8') as f:
                flow_data = json.load(f)
        
        # 実行状態を初期化
        execution_states[flow_id] = {
            'is_running': True,
            'current_step': 0,
            'total_steps': len(flow_data.get('steps', [])),
            'log': 'フロー実行を開始しました',
            'error': None,
            'current_step_data': None,
            'projection_state': None
        }
        
        if flow_id not in execution_locks:
            execution_locks[flow_id] = threading.Lock()
        
        # フローエンジンとアプリケーションコンテキストを確保
        app = current_app._get_current_object()
        flow_engine = app.flow_engine
        
        def run_flow(app_context):
            with app_context():
                try:
                    steps = flow_data.get('steps', [])
                    for i, step in enumerate(steps):
                        with execution_locks[flow_id]:
                            if not execution_states.get(flow_id, {}).get('is_running'):
                                break
                            
                            execution_states[flow_id]['current_step'] = i
                            execution_states[flow_id]['log'] = f"ステップ {i + 1}/{len(steps)} を実行中: {step.get('description', step.get('action', ''))}"
                            execution_states[flow_id]['current_step_data'] = {
                                'index': i,
                                'step': step
                            }
                        
                        # ステップを実行
                        result = flow_engine.execute_step(step)
                        with execution_locks[flow_id]:
                            state = execution_states.get(flow_id)
                            if state is not None:
                                state['current_step_data'] = {
                                    'index': i,
                                    'step': step,
                                    'result': result
                                }
                                try:
                                    module_name = step.get('module')
                                    action_name = step.get('action')
                                    if module_name == 'mapping':
                                        if action_name == 'show_group' and result.get('success'):
                                            result_data = result.get('data') or {}
                                            projection_state = {
                                                'group_id': result_data.get('group_id') or step.get('parameters', {}).get('group_id'),
                                                'display_target': result_data.get('display_target') or step.get('parameters', {}).get('display_target'),
                                                'preview': result_data.get('preview'),
                                                'timestamp': datetime.utcnow().isoformat() + 'Z'
                                            }
                                            state['projection_state'] = projection_state
                                            app.logger.info(
                                                '[FlowExecution] show_group succeeded | state=%s',
                                                projection_state
                                            )
                                        elif action_name == 'hide_group':
                                            state['projection_state'] = None
                                            app.logger.info(
                                                '[FlowExecution] hide_group executed'
                                            )
                                except Exception as projection_error:
                                    app.logger.warning(
                                        'Failed to update projection state for flow %s: %s',
                                        flow_id,
                                        projection_error,
                                        exc_info=True
                                    )
                        
                        if not result.get('success'):
                            with execution_locks[flow_id]:
                                execution_states[flow_id]['is_running'] = False
                                execution_states[flow_id]['error'] = f"ステップ {i + 1} でエラー: {result.get('error', '不明なエラー')}"
                                execution_states[flow_id]['current_step_data'] = {
                                    'index': i,
                                    'step': step,
                                    'result': result
                                }
                            return
                    
                    # 完了
                    with execution_locks[flow_id]:
                        execution_states[flow_id]['is_running'] = False
                        execution_states[flow_id]['log'] = 'フロー実行が完了しました'
                        execution_states[flow_id]['current_step'] = len(steps)
                except Exception as e:
                    app.logger.error(f"Flow execution error: {e}", exc_info=True)
                    with execution_locks[flow_id]:
                        execution_states[flow_id]['is_running'] = False
                        execution_states[flow_id]['error'] = str(e)

        thread = threading.Thread(target=run_flow, args=(app.app_context,), daemon=True)
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Flow execution started'
        })
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Execute flow error: {e}", exc_info=True)
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows/<flow_id>/status', methods=['GET'])
def get_execution_status(flow_id):
    """フロー実行状態を取得"""
    try:
        if flow_id not in execution_states:
            return jsonify({
                'success': True,
                'status': {
                    'is_running': False,
                    'current_step': 0,
                    'total_steps': 0,
                    'log': '',
                    'error': None
                }
            })
        
        with execution_locks.get(flow_id, threading.Lock()):
            state = execution_states[flow_id].copy()
        
        return jsonify({
            'success': True,
            'status': state
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows/<flow_id>/stop', methods=['POST'])
def stop_flow(flow_id):
    """フロー実行を停止"""
    try:
        if flow_id not in execution_states:
            return jsonify({'success': False, 'error': 'フローは実行されていません'}), 400
        
        with execution_locks.get(flow_id, threading.Lock()):
            if not execution_states[flow_id].get('is_running'):
                return jsonify({'success': False, 'error': 'フローは既に停止しています'}), 400
            
            execution_states[flow_id]['is_running'] = False
            execution_states[flow_id]['log'] = 'フロー実行を停止しました'
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@flow_designer_bp.route('/api/flows/test', methods=['POST'])
def test_execute_flow():
    """フローをテスト実行（保存せずに実行）"""
    try:
        from flask import current_app
        
        flow_data = request.json
        
        if not flow_data or 'steps' not in flow_data:
            return jsonify({'success': False, 'error': 'Invalid flow data'}), 400
        
        # フローエンジンで実行
        flow_engine = current_app.flow_engine
        
        # 非同期実行を開始
        execution_id = str(uuid.uuid4())
        
        def run_flow():
            try:
                flow_engine.execute_flow(flow_data)
            except Exception as e:
                current_app.logger.error(f"Flow test execution error: {e}", exc_info=True)
        
        thread = threading.Thread(target=run_flow, daemon=True)
        thread.start()
        
        return jsonify({
            'success': True,
            'execution_id': execution_id,
            'message': 'テスト実行を開始しました'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def create_app():
    """Standalone application factory for the flow designer module."""
    from flask import Flask

    app = Flask(
        __name__,
        template_folder=str(TEMPLATES_DIR),
        static_folder=str(STATIC_DIR)
    )
    app.register_blueprint(flow_designer_bp)
    return app


if __name__ == '__main__':
    create_app().run(debug=True, port=5003)
