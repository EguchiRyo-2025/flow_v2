'use strict';

let flowSteps = [];
let selectedStepIndex = null;
let availableModules = {};
let blocklySteps = [];
let blocklySkippedSteps = [];

const FLOW_DESIGNER_ACTIVE_KEY = 'flowDesignerActive';
const MAPPING_SYNC_KEY = 'mappingLastUpdate';
const MAPPING_UPDATE_CHANNEL_NAME = 'mapping-updates';

// 実行状態管理
let executionState = {
  isRunning: false,
  currentStepIndex: -1,
  totalSteps: 0,
  logs: []
};

let executionCheckInterval = null;
let lastCurrentStepSignature = null;
let mappingUpdateChannel = null;
const mappingUpdateChannelSource = 'flow-designer';

function emitMappingUpdate(event) {
  if (!event || typeof event !== 'object') {
    return;
  }

  const payload = {
    source: mappingUpdateChannelSource,
    timestamp: Date.now(),
    ...event
  };

  try {
    localStorage.setItem(MAPPING_SYNC_KEY, payload.timestamp.toString());
  } catch (error) {
    console.warn('Failed to update mapping sync key:', error);
  }

  if (mappingUpdateChannel) {
    try {
      mappingUpdateChannel.postMessage(payload);
    } catch (error) {
      console.warn('Failed to broadcast mapping update:', error);
    }
  }
}

window.emitMappingUpdate = emitMappingUpdate;

function clearFlowDesignerFlags() {
  try {
    localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'false');
    if (localStorage.getItem('blocklyPreviewGroup')) {
      localStorage.removeItem('blocklyPreviewGroup');
      emitMappingUpdate({ action: 'hide-preview', reason: 'designer-unload' });
    }
  } catch (error) {
    console.warn('Failed to reset flow designer flags:', error);
  }
}

function clearFlowExecutionGroup() {
  try {
    if (localStorage.getItem('flowExecutionGroup')) {
      triggerMappingDisplay({ action: 'hide' });
    }
  } catch (error) {
    console.warn('Failed to clear flow execution group flag:', error);
  }
}

function triggerMappingDisplay(options = {}) {
  const { groupId, action, previewElement } = options;
  const resolvedAction = action || (groupId ? 'show' : 'refresh');

  try {
    console.log('[FlowDesigner] triggerMappingDisplay called', { groupId, action: resolvedAction, previewElement });
    if (resolvedAction === 'show') {
      if (!groupId) {
        console.warn('triggerMappingDisplay: show action requested without groupId');
        return;
      }
      localStorage.setItem('flowExecutionGroup', groupId);
      if (previewElement) {
        localStorage.setItem('previewElement', JSON.stringify(previewElement));
      } else {
        const existingPreview = localStorage.getItem('previewElement');
        if (existingPreview) {
          try {
            const parsed = JSON.parse(existingPreview);
            if (parsed && parsed.group_id && String(parsed.group_id) !== String(groupId)) {
              localStorage.removeItem('previewElement');
            }
          } catch (error) {
            console.warn('Failed to parse existing previewElement for cleanup:', error);
            localStorage.removeItem('previewElement');
          }
        }
      }
    } else if (resolvedAction === 'hide' || resolvedAction === 'clear') {
      localStorage.removeItem('flowExecutionGroup');
      localStorage.removeItem('previewElement');
    } else if (resolvedAction === 'refresh') {
      if (previewElement) {
        localStorage.setItem('previewElement', JSON.stringify(previewElement));
      }
    }

    emitMappingUpdate({
      action: resolvedAction,
      groupId: resolvedAction === 'show' ? groupId : null,
      previewElement: previewElement || null
    });
  } catch (error) {
    console.warn('Failed to trigger mapping display:', error);
  }
}

window.triggerMappingDisplay = triggerMappingDisplay;

window.addEventListener('beforeunload', clearFlowDesignerFlags);
window.addEventListener('pagehide', clearFlowDesignerFlags);

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof BroadcastChannel === 'function') {
    try {
      mappingUpdateChannel = new BroadcastChannel(MAPPING_UPDATE_CHANNEL_NAME);
    } catch (error) {
      console.warn('Failed to initialize mapping update channel:', error);
    }
  }

  try {
    localStorage.setItem('mappingPageActive', 'false');
    localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'true');
    // 実行中フローの投影状態を保持するため、初期化時にはflowExecutionGroupを消さない
    if (localStorage.getItem('blocklyPreviewGroup')) {
      localStorage.removeItem('blocklyPreviewGroup');
      emitMappingUpdate({ action: 'hide-preview', reason: 'designer-init' });
    }
  } catch (error) {
    console.warn('Failed to update mappingPageActive flag on flow designer:', error);
  }

  await loadModules();

  // デフォルトのフローを自動ロード
  await loadFlow('default');

  document.getElementById('save-flow').addEventListener('click', saveFlow);
  document.getElementById('delete-flow').addEventListener('click', deleteFlow);
  document.getElementById('test-execution').addEventListener('click', testExecution);
  document.getElementById('start-execution').addEventListener('click', startExecution);
  document.getElementById('stop-execution').addEventListener('click', stopExecution);

  window.addEventListener('flow-blockly-updated', (event) => {
    if (!event.detail || !Array.isArray(event.detail.steps)) {
      return;
    }
    blocklySteps = event.detail.steps;
    blocklySkippedSteps = event.detail.skippedSteps || [];
    selectedStepIndex = null;
    renderSteps();
    const statusEl = document.getElementById('blockly-status');
    if (statusEl) {
      const count = blocklySteps.length;
      const skipped = event.detail.skipped || 0;
      if (!count) {
        statusEl.textContent = 'ブロックを配置してフローを設計してください。';
      } else if (skipped > 0) {
        statusEl.textContent = `Blocklyで定義されたステップ数: ${count} (未対応のステップ ${skipped} 件は「Blockly未対応」と表示されます)`;
      } else {
        statusEl.textContent = `Blocklyで定義されたステップ数: ${count}`;
      }
    }
  });

  if (window.FlowBlockly && typeof window.FlowBlockly.emitUpdate === 'function') {
    window.FlowBlockly.emitUpdate();
  }

  // ステータス監視を自動開始（外部から実行されたフローも検知）
  startExecutionMonitoring();
});

async function loadModules() {
  try {
    const response = await fetch('/api/modules');
    const data = await response.json();
    if (data.success) {
      availableModules = data.modules;
    }
  } catch (error) {
    console.error('Failed to load modules:', error);
  }
}

async function loadFlow(flowId) {
  try {
    const response = await fetch(`/flow/api/flows/${flowId}`);
    const data = await response.json();

    if (data.success) {
      document.getElementById('flow-name').value = data.flow.name || 'メインフロー';
      flowSteps = data.flow.steps || [];
      renderSteps();
      const syncToBlockly = () => {
        if (window.FlowBlockly && typeof window.FlowBlockly.importSteps === 'function') {
          window.FlowBlockly.importSteps(flowSteps);
        }
      };
      if (window.FlowBlockly && window.FlowBlockly.workspace) {
        syncToBlockly();
      } else {
        const readyHandler = () => {
          syncToBlockly();
          window.removeEventListener('flow-blockly-ready', readyHandler);
        };
        window.addEventListener('flow-blockly-ready', readyHandler);
      }
    }
  } catch (error) {
    console.error('Failed to load flow:', error);
    // フローが存在しない場合はエラーを表示しない（新規作成）
  }
}

function renderSteps() {
  const tbody = document.getElementById('step-list');
  tbody.innerHTML = '';

  const usingBlockly = blocklySteps.length > 0;
  let stepsForDisplay = [];

  if (usingBlockly && flowSteps.length > 0) {
    const skippedIndexSet = new Set(blocklySkippedSteps.map((item) => item.index));
    let blocklyCursor = 0;
    stepsForDisplay = flowSteps.map((originalStep, index) => {
      if (skippedIndexSet.has(index)) {
        return { ...originalStep, __source: 'skipped' };
      }
      const mappedStep = blocklySteps[blocklyCursor] || originalStep;
      blocklyCursor += 1;
      return { ...mappedStep, __source: 'blockly' };
    });
    while (blocklyCursor < blocklySteps.length) {
      stepsForDisplay.push({ ...blocklySteps[blocklyCursor], __source: 'blockly' });
      blocklyCursor += 1;
    }
  } else if (usingBlockly) {
    stepsForDisplay = blocklySteps.map((step) => ({ ...step, __source: 'blockly' }));
  } else {
    stepsForDisplay = flowSteps.map((step) => ({ ...step, __source: 'manual' }));
  }

  if (stepsForDisplay.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="table-placeholder">ブロックを配置してフローを設計してください</td></tr>';
    return;
  }

  stepsForDisplay.forEach((step, index) => {
    const description = step.description || '-';
    const suffix = step.__source === 'skipped' ? ' (Blockly未対応)' : '';
    const actionCell = step.action || (step.type === 'wait' ? 'wait' : '-');
    const row = document.createElement('tr');
    row.innerHTML = `
            <td>${index + 1}</td>
            <td>${step.module || (step.type === 'wait' ? 'flow' : '-')}</td>
            <td>${actionCell}</td>
            <td>${description}${suffix}</td>
        `;
    row.classList.add('step-row');
    row.dataset.stepIndex = index;
    
    // 実行中の現在ステップをハイライト
    if (executionState.isRunning && index === executionState.currentStepIndex) {
      row.classList.add('current-step-highlight');
    }
    
    tbody.appendChild(row);
  });
}

async function saveFlow() {
  const flowName = document.getElementById('flow-name').value.trim();
  if (window.FlowBlockly && typeof window.FlowBlockly.emitUpdate === 'function') {
    window.FlowBlockly.emitUpdate();
  }

  if (!flowName) {
    alert('フロー名を入力してください');
    return;
  }

  let stepsToSave = [];
  if (blocklySteps.length > 0) {
    if (flowSteps.length > 0) {
      const skippedIndexSet = new Set(blocklySkippedSteps.map((item) => item.index));
      let blocklyCursor = 0;
      stepsToSave = flowSteps.map((originalStep, index) => {
        if (skippedIndexSet.has(index)) {
          return originalStep;
        }
        const mappedStep = blocklySteps[blocklyCursor] || originalStep;
        blocklyCursor += 1;
        return mappedStep;
      });
      while (blocklyCursor < blocklySteps.length) {
        stepsToSave.push(blocklySteps[blocklyCursor]);
        blocklyCursor += 1;
      }
    } else {
      stepsToSave = blocklySteps.slice();
    }
  } else {
    stepsToSave = flowSteps.slice();
  }

  if (stepsToSave.length === 0) {
    alert('少なくとも1つのステップを追加してください');
    return;
  }

  for (let i = 0; i < stepsToSave.length; i += 1) {
    const step = stepsToSave[i];
    if (step.type === 'wait') {
      if (typeof step.duration !== 'number') {
        alert(`ステップ ${i + 1} の待機時間を設定してください`);
        return;
      }
      continue;
    }
    if (!step.module || !step.action) {
      alert(`ステップ ${i + 1} のモジュールとアクションを設定してください`);
      return;
    }
    if (step.module === 'mapping' && (!step.parameters || !step.parameters.group_id)) {
      alert(`ステップ ${i + 1} のプロジェクショングループを選択してください`);
      return;
    }
    if (step.module === '3d_detect' && step.action === 'detect_touch') {
      if (!step.parameters || step.parameters.origin_no === undefined || step.parameters.origin_no === '') {
        alert(`ステップ ${i + 1} の原点を選択してください`);
        return;
      }
      if (!step.parameters || step.parameters.judge_no === undefined || step.parameters.judge_no === '') {
        alert(`ステップ ${i + 1} の判定番号を選択してください`);
        return;
      }
    }
  }

  const flowData = {
    name: flowName,
    description: '',
    steps: stepsToSave
  };

  try {
    const response = await fetch('/flow/api/flows/default', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(flowData)
    });

    const data = await response.json();

    if (data.success) {
      addLog('info', 'フローを自動保存しました');
      flowSteps = stepsToSave;
    } else {
      alert('保存に失敗しました: ' + data.message);
    }
  } catch (error) {
    console.error('Save failed:', error);
    alert('保存中にエラーが発生しました');
  }
}

async function testExecution() {
  // Blocklyから現在選択されているブロックを取得
  if (!window.FlowBlockly || !window.FlowBlockly.workspace) {
    alert('Blocklyワークスペースが初期化されていません');
    return;
  }
  
  const selectedBlock = window.FlowBlockly.workspace.getBlockById(
    window.Blockly.selected ? window.Blockly.selected.id : null
  );
  
  if (!selectedBlock) {
    alert('テスト実行するブロックを選択してください。\nBlocklyエディタでブロックをクリックして選択してから実行してください。');
    return;
  }
  
  if (window.FlowBlockly && typeof window.FlowBlockly.emitUpdate === 'function') {
    window.FlowBlockly.emitUpdate();
  }
  
  // 選択されたブロックのインデックスを取得
  const allBlocks = window.FlowBlockly.workspace.getTopBlocks(true);
  const selectedIndex = allBlocks.findIndex(block => block.id === selectedBlock.id);
  
  if (selectedIndex === -1 || selectedIndex >= blocklySteps.length) {
    alert('選択されたブロックのステップ情報が見つかりません');
    return;
  }
  
  // 選択されたステップのみを実行
  const stepToTest = blocklySteps[selectedIndex];
  const flowData = {
    name: 'テスト実行',
    description: `ステップ ${selectedIndex + 1} のテスト実行`,
    steps: [stepToTest]
  };
  
  try {
    const execResponse = await fetch('/flow/api/flows/default/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(flowData)
    });

    const execData = await execResponse.json();

    if (execData.success) {
      executionState = {
        isRunning: true,
        currentStepIndex: 0,
        totalSteps: 1,
        logs: []
      };
      
      localStorage.setItem('flowExecuting', 'true');
      emitMappingUpdate({ action: 'flow-test-start' });
      
      addLog('info', `テスト実行開始: ${stepToTest.description || stepToTest.action}`);
      updateExecutionUI();
      
      // 選択されたブロックをハイライト
      if (window.FlowBlockly && typeof window.FlowBlockly.highlightBlock === 'function') {
        window.FlowBlockly.highlightBlock(selectedIndex);
      }
      
      startExecutionMonitoring();
    } else {
      alert('テスト実行開始に失敗しました: ' + (execData.error || execData.message));
    }
  } catch (error) {
    console.error('Test execution failed:', error);
    alert('テスト実行中にエラーが発生しました');
  }
}

async function startExecution() {
  const flowName = document.getElementById('flow-name').value.trim() || 'メインフロー';
  
  if (window.FlowBlockly && typeof window.FlowBlockly.emitUpdate === 'function') {
    window.FlowBlockly.emitUpdate();
  }

  let stepsToExecute = [];
  if (blocklySteps.length > 0) {
    if (flowSteps.length > 0) {
      const skippedIndexSet = new Set(blocklySkippedSteps.map((item) => item.index));
      let blocklyCursor = 0;
      stepsToExecute = flowSteps.map((originalStep, index) => {
        if (skippedIndexSet.has(index)) {
          return originalStep;
        }
        const mappedStep = blocklySteps[blocklyCursor] || originalStep;
        blocklyCursor += 1;
        return mappedStep;
      });
      while (blocklyCursor < blocklySteps.length) {
        stepsToExecute.push(blocklySteps[blocklyCursor]);
        blocklyCursor += 1;
      }
    } else {
      stepsToExecute = blocklySteps.slice();
    }
  } else {
    stepsToExecute = flowSteps.slice();
  }

  if (stepsToExecute.length === 0) {
    alert('実行するステップがありません。Blocklyにブロックを配置してください。');
    return;
  }

  // 簡易バリデーション
  for (let i = 0; i < stepsToExecute.length; i += 1) {
    const step = stepsToExecute[i];
    if (step.type === 'wait') {
      if (typeof step.duration !== 'number') {
        alert(`ステップ ${i + 1} の待機時間を設定してください`);
        return;
      }
      continue;
    }
    if (!step.module || !step.action) {
      alert(`ステップ ${i + 1} のモジュールとアクションを設定してください`);
      return;
    }
  }

  // フローを保存してから実行
  const flowData = {
    name: flowName,
    description: '',
    steps: stepsToExecute
  };

  try {
    // まず保存
    const saveResponse = await fetch('/flow/api/flows/default', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(flowData)
    });

    const saveData = await saveResponse.json();
    if (!saveData.success) {
      alert('フローの保存に失敗しました: ' + saveData.message);
      return;
    }

    // 実行開始
    const execResponse = await fetch('/flow/api/flows/default/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const execData = await execResponse.json();

    if (execData.success) {
      executionState = {
        isRunning: true,
        currentStepIndex: 0,
        totalSteps: stepsToExecute.length,
        logs: []
      };
      
      // フロー実行中フラグをlocalStorageに設定
      localStorage.setItem('flowExecuting', 'true');
      emitMappingUpdate({ action: 'flow-start', groupId: null });
      
      addLog('info', `フロー実行開始: 全${stepsToExecute.length}ステップ`);
      updateExecutionUI();
      
      // 定期的に実行状態をチェック
      startExecutionMonitoring();
    } else {
      alert('実行開始に失敗しました: ' + (execData.error || execData.message));
    }
  } catch (error) {
    console.error('Execution failed:', error);
    alert('実行中にエラーが発生しました');
  }
}

function handleCurrentStepData(stepData) {
  if (!stepData || typeof stepData !== 'object') {
    return false;
  }

  const step = stepData.step || {};
  const result = stepData.result || {};
  const resultData = result && typeof result === 'object' ? result.data : undefined;

  try {
    if (step.module === 'mapping') {
      if (step.action === 'show_group') {
        const groupId = (resultData && resultData.group_id) || step.parameters?.group_id;
        const preview = resultData && resultData.preview;
        console.log('[FlowDesigner] handleCurrentStepData show_group', { groupId, resultData, step });
        if (groupId) {
          triggerMappingDisplay({ action: 'show', groupId, previewElement: preview });
        }
        return true;
      }

      if (step.action === 'hide_group') {
        console.log('[FlowDesigner] handleCurrentStepData hide_group', { step });
        triggerMappingDisplay({ action: 'hide' });
        return true;
      }
    }

    if (resultData) {
      console.log('[FlowDesigner] handleCurrentStepData resultData refresh', { resultData });
      triggerMappingDisplay({ action: 'refresh' });
    }
  } catch (error) {
    console.warn('Failed to handle current step data:', error);
  }
  return false;
}

function startExecutionMonitoring() {
  if (executionCheckInterval) {
    clearInterval(executionCheckInterval);
  }
  
  executionCheckInterval = setInterval(async () => {
    try {
      const response = await fetch('/flow/api/flows/default/status');
      const data = await response.json();
      
      if (data.success) {
        const status = data.status;
        const currentStepData = status.current_step_data;
        let handledStepForDisplay = false;

        if (currentStepData) {
          try {
            const signature = JSON.stringify({
              index: currentStepData.index,
              module: currentStepData.step?.module,
              action: currentStepData.step?.action,
              result: currentStepData.result?.data || currentStepData.result?.message || currentStepData.result?.success
            });
            if (signature !== lastCurrentStepSignature) {
              lastCurrentStepSignature = signature;
              const handled = handleCurrentStepData(currentStepData);
              handledStepForDisplay = handledStepForDisplay || handled;
            }
          } catch (error) {
            console.warn('Failed to process current step data signature:', error);
          }
        }
        
        if (status.is_running) {
          executionState.isRunning = true;
          executionState.currentStepIndex = status.current_step || 0;
          executionState.totalSteps = status.total_steps || executionState.totalSteps;
          localStorage.setItem('flowExecuting', 'true');
          emitMappingUpdate({
            action: 'execution-progress',
            stepIndex: executionState.currentStepIndex,
            totalSteps: executionState.totalSteps
          });
          
          // 現在実行中のステップが投影アクションの場合、flowExecutionGroupを設定
          if (!handledStepForDisplay) {
            updateFlowExecutionGroup(executionState.currentStepIndex);
          }
          
          // ログがあれば追加
          if (status.log && status.log !== executionState.lastLog) {
            const logType = status.log.includes('エラー') || status.log.includes('失敗') ? 'error' : 
                           status.log.includes('警告') ? 'warning' : 
                           status.log.includes('ステップ') ? 'step' : 'info';
            addLog(logType, status.log);
            executionState.lastLog = status.log;
          }
          
          updateExecutionUI();
          renderSteps(); // テーブルの現在ステップをハイライト
          
          // Blocklyブロックをハイライト
          if (window.FlowBlockly && typeof window.FlowBlockly.highlightBlock === 'function') {
            window.FlowBlockly.highlightBlock(executionState.currentStepIndex);
          }
        } else {
          // 実行終了
          executionState.isRunning = false;
          executionState.currentStepIndex = -1;
          
          // フロー実行中フラグをクリア
          localStorage.setItem('flowExecuting', 'false');
          clearFlowExecutionGroup();
          
          if (status.error) {
            addLog('error', `実行エラー: ${status.error}`);
          } else {
            addLog('info', 'フロー実行が完了しました');
          }
          
          // Blocklyハイライトをクリア
          if (window.FlowBlockly && typeof window.FlowBlockly.clearHighlight === 'function') {
            window.FlowBlockly.clearHighlight();
          }
          
          updateExecutionUI();
          renderSteps();
          stopExecutionMonitoring();
          lastCurrentStepSignature = null;
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  }, 500); // 500msごとにチェック
}

function updateFlowExecutionGroup(stepIndex) {
  // 現在実行中のステップを取得
  const usingBlockly = blocklySteps.length > 0;
  let stepsForDisplay = [];

  if (usingBlockly && flowSteps.length > 0) {
    const skippedIndexSet = new Set(blocklySkippedSteps.map((item) => item.index));
    let blocklyCursor = 0;
    stepsForDisplay = flowSteps.map((originalStep, idx) => {
      if (skippedIndexSet.has(idx)) {
        return originalStep;
      }
      const mappedStep = blocklySteps[blocklyCursor] || originalStep;
      blocklyCursor += 1;
      return mappedStep;
    });
    while (blocklyCursor < blocklySteps.length) {
      stepsForDisplay.push(blocklySteps[blocklyCursor]);
      blocklyCursor += 1;
    }
  } else if (usingBlockly) {
    stepsForDisplay = blocklySteps;
  } else {
    stepsForDisplay = flowSteps;
  }

  if (stepIndex < 0 || stepIndex >= stepsForDisplay.length) {
    // インデックス範囲外の場合はクリア
    localStorage.removeItem('flowExecutionGroup');
    return;
  }

  const currentStep = stepsForDisplay[stepIndex];
  
  // 投影開始アクション（停止以外）の場合のみグループIDを設定
  if (currentStep.module === 'mapping') {
    if (currentStep.action === 'show_group') {
      const groupId = currentStep.parameters?.group_id;
      if (groupId) {
        console.log('[Flow] 投影実行中 → グループID設定:', groupId);
        triggerMappingDisplay({ action: 'show', groupId });
      }
    } else if (currentStep.action === 'hide_group') {
      triggerMappingDisplay({ action: 'hide' });
    }
  }
}

function stopExecutionMonitoring() {
  if (executionCheckInterval) {
    clearInterval(executionCheckInterval);
    executionCheckInterval = null;
  }
}

async function stopExecution() {
  try {
    const response = await fetch('/flow/api/flows/default/stop', {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      executionState.isRunning = false;
      executionState.currentStepIndex = -1;
      
      // フロー実行中フラグをクリア
      localStorage.setItem('flowExecuting', 'false');
      clearFlowExecutionGroup();
      
      // Blocklyハイライトをクリア
      if (window.FlowBlockly && typeof window.FlowBlockly.clearHighlight === 'function') {
        window.FlowBlockly.clearHighlight();
      }
      
      addLog('warning', 'フロー実行を停止しました');
      updateExecutionUI();
      renderSteps();
      stopExecutionMonitoring();
    } else {
      alert('停止に失敗しました: ' + (data.error || data.message));
    }
  } catch (error) {
    console.error('Stop failed:', error);
    alert('停止中にエラーが発生しました');
  }
}

function updateExecutionUI() {
  const stateEl = document.getElementById('execution-state');
  const currentStepEl = document.getElementById('current-step');
  const progressTextEl = document.getElementById('progress-text');
  const progressFillEl = document.getElementById('progress-fill');
  const startBtn = document.getElementById('start-execution');
  const stopBtn = document.getElementById('stop-execution');
  
  if (executionState.isRunning) {
    stateEl.textContent = '実行中';
    stateEl.className = 'status-value running';
    
    const stepNum = executionState.currentStepIndex + 1;
    const stepDesc = getStepDescription(executionState.currentStepIndex);
    currentStepEl.textContent = `ステップ ${stepNum}: ${stepDesc}`;
    
    progressTextEl.textContent = `${stepNum} / ${executionState.totalSteps}`;
    const progressPercent = (stepNum / executionState.totalSteps) * 100;
    progressFillEl.style.width = `${progressPercent}%`;
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    stateEl.textContent = '待機中';
    stateEl.className = 'status-value idle';
    currentStepEl.textContent = '--';
    
    const total = blocklySteps.length || flowSteps.length;
    progressTextEl.textContent = `0 / ${total}`;
    progressFillEl.style.width = '0%';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

function getStepDescription(index) {
  const usingBlockly = blocklySteps.length > 0;
  let stepsForDisplay = [];

  if (usingBlockly && flowSteps.length > 0) {
    const skippedIndexSet = new Set(blocklySkippedSteps.map((item) => item.index));
    let blocklyCursor = 0;
    stepsForDisplay = flowSteps.map((originalStep, idx) => {
      if (skippedIndexSet.has(idx)) {
        return originalStep;
      }
      const mappedStep = blocklySteps[blocklyCursor] || originalStep;
      blocklyCursor += 1;
      return mappedStep;
    });
    while (blocklyCursor < blocklySteps.length) {
      stepsForDisplay.push(blocklySteps[blocklyCursor]);
      blocklyCursor += 1;
    }
  } else if (usingBlockly) {
    stepsForDisplay = blocklySteps;
  } else {
    stepsForDisplay = flowSteps;
  }

  if (index < 0 || index >= stepsForDisplay.length) {
    return '不明';
  }

  const step = stepsForDisplay[index];
  return step.description || step.action || step.module || '不明';
}

async function deleteFlow() {
  const flowName = document.getElementById('flow-name').value.trim();
  
  if (!confirm(`フロー "${flowName}" を削除しますか？\nこの操作は取り消せません。`)) {
    return;
  }
  
  try {
    const response = await fetch('/flow/api/flows/default', {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      addLog('info', 'フローを削除しました');
      
      // フローをリセット
      document.getElementById('flow-name').value = 'メインフロー';
      flowSteps = [];
      blocklySteps = [];
      blocklySkippedSteps = [];
      
      // Blocklyワークスペースをクリア
      if (window.FlowBlockly && window.FlowBlockly.workspace) {
        window.FlowBlockly.workspace.clear();
      }
      
      renderSteps();
      
      alert('フローを削除しました');
    } else {
      alert('削除に失敗しました: ' + (data.error || data.message));
    }
  } catch (error) {
    console.error('Delete failed:', error);
    alert('削除中にエラーが発生しました');
  }
}

function addLog(type, message) {
  const logContainer = document.getElementById('execution-log');
  const timestamp = new Date().toLocaleTimeString('ja-JP');
  const logEntry = document.createElement('div');
  logEntry.className = `log-entry ${type}`;
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  logContainer.appendChild(logEntry);
  
  // 自動スクロール
  logContainer.scrollTop = logContainer.scrollHeight;
  
  // ログを保持（最大100件）
  executionState.logs.push({ type, message, timestamp });
  if (executionState.logs.length > 100) {
    executionState.logs.shift();
    logContainer.removeChild(logContainer.firstChild);
  }
}
