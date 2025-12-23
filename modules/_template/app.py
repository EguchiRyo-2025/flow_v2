"""
Template Module - 単体実行用アプリケーション
"""
from flask import Flask, render_template, jsonify, request
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from interface import TemplateModule

app = Flask(__name__)

# モジュールインスタンス
module = TemplateModule()
module.initialize()


@app.route('/')
def index():
    """デバッグ用UI"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Template Module - Debug</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            button { padding: 10px 20px; margin: 5px; }
            .result { margin-top: 20px; padding: 10px; background: #f0f0f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Template Module Debug Interface</h1>
            
            <div>
                <h2>Status</h2>
                <button onclick="getStatus()">Get Status</button>
                <div id="status" class="result"></div>
            </div>
            
            <div>
                <h2>Example Action</h2>
                <input type="text" id="param1" placeholder="Parameter 1" value="test">
                <input type="number" id="param2" placeholder="Parameter 2" value="10">
                <button onclick="executeAction()">Execute</button>
                <div id="action-result" class="result"></div>
            </div>
        </div>
        
        <script>
            async function getStatus() {
                const response = await fetch('/api/status');
                const data = await response.json();
                document.getElementById('status').textContent = JSON.stringify(data, null, 2);
            }
            
            async function executeAction() {
                const param1 = document.getElementById('param1').value;
                const param2 = document.getElementById('param2').value;
                
                const response = await fetch('/api/action', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        action: 'example_action',
                        parameters: {param1, param2: parseInt(param2)}
                    })
                });
                
                const data = await response.json();
                document.getElementById('action-result').textContent = JSON.stringify(data, null, 2);
            }
        </script>
    </body>
    </html>
    """


@app.route('/api/status')
def get_status():
    """モジュールの状態を取得"""
    return jsonify(module.get_status())


@app.route('/api/action', methods=['POST'])
def execute_action():
    """アクションを実行"""
    data = request.get_json()
    action = data.get('action')
    parameters = data.get('parameters', {})
    
    result = module.execute_action(action, parameters)
    return jsonify(result)


if __name__ == '__main__':
    print("Starting Template Module in standalone mode...")
    print("Access: http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)
