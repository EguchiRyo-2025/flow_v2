// Blockly初期化スクリプト
const Blockly = window.Blockly;
const javascriptGenerator = window.Blockly.JavaScript;

// Blocklyワークスペースの初期化
function initBlockly() {
  const workspace = Blockly.inject('blocklyDiv', {
    toolbox: document.getElementById('toolbox'),
    grid: {
      spacing: 20,
      length: 3,
      colour: '#ccc',
      snap: true
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 1.0,
      maxScale: 3,
      minScale: 0.3,
      scaleSpeed: 1.2
    },
    trashcan: true
  });

  // ウィンドウリサイズ時の対応
  window.addEventListener('resize', function() {
    Blockly.svgResize(workspace);
  });

  return workspace;
}

// ボタンのイベントリスナー設定
function setupEventListeners() {
  const settingsBtn = document.getElementById('settingsBtn');
  const flowBtn = document.getElementById('flowBtn');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', function() {
      alert('設定画面');
    });
  }

  if (flowBtn) {
    flowBtn.addEventListener('click', function() {
      alert('フロー画面');
    });
  }
}

// DOMContentLoaded後に実行
document.addEventListener('DOMContentLoaded', function() {
  const workspace = initBlockly();
  setupEventListeners();
  
  // グローバルスコープに公開（必要に応じて）
  window.blocklyWorkspace = workspace;
  window.Blockly = Blockly;
  window.javascriptGenerator = javascriptGenerator;
  
  // コード生成ボタンの追加
  addCodeGenerationButton(workspace);
});

// コード生成機能
function addCodeGenerationButton(workspace) {
  const generateBtn = document.createElement('button');
  generateBtn.textContent = 'コード生成';
  generateBtn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; z-index: 1000;';
  
  generateBtn.addEventListener('click', function() {
    const code = javascriptGenerator.workspaceToCode(workspace);
    console.log('生成されたコード:');
    console.log(code);
    alert('コードをコンソールに出力しました（F12で確認）');
  });
  
  document.body.appendChild(generateBtn);
}
