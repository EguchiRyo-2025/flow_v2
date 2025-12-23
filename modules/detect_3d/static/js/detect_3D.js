// static/js/detect_3D.js

// グローバル変数（ページ間で共有するためwindowに格納）
if (!window.pixelCountInterval) {
    window.pixelCountInterval = null;
}

let isCameraBusy = false; // カメラの状態を管理

// カメラクリーンアップ関数（確実に実行）
function cleanupCamera() {
    console.log('検知画面: カメラクリーンアップ開始');
    
    // カメラストリームを停止（RGB/Depth両対応）
    const cameraStream = document.getElementById('cameraStream');
    if (cameraStream) {
        cameraStream.src = '';
        console.log('検知画面: カメラストリーム（RGB/Depth）を停止しました');
    }
    
    // インターバルを停止
    if (window.pixelCountInterval) {
        clearInterval(window.pixelCountInterval);
        window.pixelCountInterval = null;
        console.log('検知画面: インターバルを停止しました');
    }
    
    // サーバーにクリーンアップを通知（keepalive: trueで確実に送信）
    try {
        fetch('/detection/cleanup', {
            method: 'POST',
            keepalive: true
        });
        console.log('検知画面: クリーンアップ通知を送信しました');
    } catch (err) {
        console.warn('カメラクリーンアップ通知エラー:', err);
    }
}

async function initializeCameraStream() {
    if (isCameraBusy) {
        console.log("カメラは現在使用中です。初期化をスキップします。");
        return;
    }
    isCameraBusy = true;
    try {
        const response = await fetch('/api/camera/initialize', { method: 'POST' });
        if (response.ok) {
            console.log("カメラストリームを初期化しました。");
        } else {
            console.error("カメラ初期化に失敗しました:", response.statusText);
        }
    } catch (error) {
        console.error("カメラ初期化エラー:", error);
    } finally {
        isCameraBusy = false;
    }
}

async function cleanupCameraStream() {
    if (isCameraBusy) {
        console.log("カメラは現在使用中です。クリーンアップをスキップします。");
        return;
    }
    isCameraBusy = true;
    try {
        const response = await fetch('/api/camera/cleanup', { method: 'POST', keepalive: true });
        if (response.ok) {
            console.log("カメラストリームをクリーンアップしました。");
        } else {
            console.error("カメラクリーンアップに失敗しました:", response.statusText);
        }
    } catch (error) {
        console.error("カメラクリーンアップエラー:", error);
    } finally {
        isCameraBusy = false;
    }
}

// ページ離脱時のクリーンアップ
function cleanupOnPageLeave() {
    console.log('3D検出画面: ページ離脱時のクリーンアップ開始');
    cleanupCameraStream();
}

window.addEventListener('beforeunload', cleanupCamera);
window.addEventListener('pagehide', cleanupCamera);

window.addEventListener('pagehide', () => {
    // pagehideイベントでもクリーンアップ
    if (window.pixelCountInterval) {
        clearInterval(window.pixelCountInterval);
        window.pixelCountInterval = null;
    }
});

// 左右反転した映像の座標を実際のカメラ座標に変換
function convertFlippedCoordinate(x, imageWidth = 640) {
    return imageWidth - 1 - x;
}

// 座標配列を変換する関数
function convertPointsForCamera(points) {
    return points.map(point => [
        convertFlippedCoordinate(point[0]),
        point[1]  // Y座標は変更なし
    ]);
}

// ========================================
// 判定ロジック（純粋関数）
// ========================================

/**
 * ピクセル数と設定値から判定を実行する関数
 * @param {number} pixelCount - 現在のピクセル数
 * @param {number} lowerLimit - ピクセル下限値
 * @param {number} upperLimit - ピクセル上限値
 * @param {number} detectTime - 検知時間閾値（秒）
 * @param {number} okFrameCount - OK状態が継続しているフレーム数
 * @param {number} updateInterval - 更新間隔（ミリ秒、デフォルト500ms）
 * @returns {Object} 判定結果
 */
function evaluateJudgment(pixelCount, lowerLimit, upperLimit, detectTime, okFrameCount = 0, updateInterval = 500) {
    // 数値の有効性チェック
    const hasValidLimits = 
        Number.isFinite(lowerLimit) && 
        Number.isFinite(upperLimit) && 
        lowerLimit >= 0 && 
        upperLimit >= lowerLimit;
    
    if (!hasValidLimits) {
        return {
            pixelJudgment: 'invalid',
            timeJudgment: 'invalid',
            totalJudgment: 'invalid',
            isPixelOk: false,
            isTimeOk: false,
            elapsedTime: 0,
            message: '設定値が無効です',
            needsFrameIncrement: false
        };
    }
    
    // ピクセル判定
    const isPixelOk = (pixelCount >= lowerLimit && pixelCount <= upperLimit);
    
    // 時間判定（フレームカウント方式）
    let isTimeOk = false;
    const detectTimeThreshold = Number.isFinite(detectTime) ? detectTime : 0;
    
    if (isPixelOk) {
        if (detectTimeThreshold === 0) {
            // 検知時間が0秒の場合は即座にOK
            isTimeOk = true;
        } else {
            // 必要なフレーム数を計算（例: 2秒 / 0.5秒 = 4フレーム）
            const requiredFrames = Math.ceil((detectTimeThreshold * 1000) / updateInterval);
            // 現在のフレーム数が必要数に達しているかチェック
            isTimeOk = (okFrameCount >= requiredFrames);
        }
    }
    
    // 経過時間を計算（表示用）
    const elapsedTime = (okFrameCount * updateInterval) / 1000;
    
    // 総合判定
    const totalJudgment = (isPixelOk && isTimeOk) ? 'ok' : 'ng';
    
    return {
        pixelJudgment: isPixelOk ? 'ok' : 'ng',
        timeJudgment: isTimeOk ? 'ok' : 'ng',
        totalJudgment: totalJudgment,
        isPixelOk: isPixelOk,
        isTimeOk: isTimeOk,
        elapsedTime: elapsedTime,
        message: totalJudgment === 'ok' ? '判定OK' : '判定NG',
        needsFrameIncrement: isPixelOk // ピクセルOKならフレームカウントを増やす
    };
}

/**
 * 判定結果をDOMに反映する関数
 * @param {HTMLElement} row - 判定行のDOM要素
 * @param {Object} result - evaluateJudgmentの戻り値
 */
function updateJudgmentUI(row, result) {
    // 直接children配列でアクセス（querySelectorよりも確実）
    const totalJudgmentCell = row.children[0]; // 0列目: 総合判定
    const judgmentCell = row.children[8];       // 8列目: 判定
    
    if (!judgmentCell || !totalJudgmentCell) {
        console.error('判定セルが見つかりません');
        return;
    }
    
    // ピクセル判定列の更新
    if (result.pixelJudgment === 'invalid') {
        judgmentCell.textContent = '-';
        judgmentCell.className = 'judgment';
    } else {
        judgmentCell.textContent = result.isPixelOk ? '○' : '×';
        judgmentCell.className = result.isPixelOk ? 'judgment-ok' : 'judgment-ng';
    }
    
    // 総合判定列の更新
    if (result.totalJudgment === 'invalid') {
        totalJudgmentCell.textContent = '-';
        totalJudgmentCell.className = 'total-judgment';
    } else if (result.totalJudgment === 'ok') {
        totalJudgmentCell.textContent = '◎';
        totalJudgmentCell.className = 'total-judgment total-judgment-ok';
        console.log('[判定完了] OK判定を表示');
    } else {
        totalJudgmentCell.textContent = '×';
        totalJudgmentCell.className = 'total-judgment total-judgment-ng';
    }
}

/**
 * Blocklyから呼び出すための判定結果取得関数
 * @param {number} originNo - 原点番号
 * @param {number} judgeNo - 判定番号（1-3）
 * @returns {Object|null} 判定結果オブジェクト、または見つからない場合null
 */
window.getJudgmentResult = function(originNo, judgeNo) {
    console.log(`[Blockly呼び出し] 判定取得: 原点${originNo}-判定${judgeNo}`);
    
    // 判定行を探す
    const judgeRows = document.querySelectorAll('.judge-table tbody tr');
    let targetRow = null;
    
    for (const row of judgeRows) {
        if (parseInt(row.dataset.originNo) === originNo && 
            parseInt(row.dataset.judgeNo) === judgeNo) {
            targetRow = row;
            break;
        }
    }
    
    if (!targetRow) {
        console.warn(`判定行が見つかりません: 原点${originNo}-判定${judgeNo}`);
        return null;
    }
    
    // 設定値と現在値を取得
    const currentValueCell = targetRow.querySelector('.current-value');
    const lowerLimitCell = targetRow.children[5];
    const upperLimitCell = targetRow.children[6];
    const detectTimeCell = targetRow.children[9];
    
    const pixelCount = parseFloat(currentValueCell?.textContent || '0');
    const lowerRaw = parseFloat((lowerLimitCell?.textContent || '').trim());
    const upperRaw = parseFloat((upperLimitCell?.textContent || '').trim());
    const detectRaw = parseFloat((detectTimeCell?.textContent || '').trim());
    
    const lowerLimit = Number.isFinite(lowerRaw) ? lowerRaw : 0;
    const upperLimit = Number.isFinite(upperRaw) ? upperRaw : 999999;
    const detectTime = Number.isFinite(detectRaw) ? detectRaw : 0;
    const okFrameCount = parseInt(targetRow.dataset.okFrameCount) || 0;
    
    // 判定実行（500ms間隔で実行）
    const result = evaluateJudgment(pixelCount, lowerLimit, upperLimit, detectTime, okFrameCount, 500);
    
    console.log(`[Blockly応答] 原点${originNo}-判定${judgeNo}:`, result);
    
    return {
        originNo: originNo,
        judgeNo: judgeNo,
        pixelCount: pixelCount,
        lowerLimit: lowerLimit,
        upperLimit: upperLimit,
        detectTime: detectTime,
        elapsedTime: result.elapsedTime,
        pixelJudgment: result.pixelJudgment,
        timeJudgment: result.timeJudgment,
        totalJudgment: result.totalJudgment,
        isPixelOk: result.isPixelOk,
        isTimeOk: result.isTimeOk,
        message: result.message
    };
};

/**
 * 全判定結果を一括取得する関数（Blockly用）
 * @returns {Array} 全判定結果の配列
 */
window.getAllJudgmentResults = function() {
    console.log('[Blockly呼び出し] 全判定結果取得');
    
    const results = [];
    const judgeRows = document.querySelectorAll('.judge-table tbody tr');
    
    judgeRows.forEach(row => {
        const originNo = parseInt(row.dataset.originNo);
        const judgeNo = parseInt(row.dataset.judgeNo);
        
        if (!isNaN(originNo) && !isNaN(judgeNo)) {
            const result = window.getJudgmentResult(originNo, judgeNo);
            if (result) {
                results.push(result);
            }
        }
    });
    
    console.log(`[Blockly応答] 全判定結果: ${results.length}件`);
    return results;
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('3D検出画面: DOM読み込み完了');

    // カメラストリームを初期化
    initializeCameraStream();

    // ページ終了時のクリーンアップ
    window.addEventListener('beforeunload', cleanupCameraStream);
    window.addEventListener('pagehide', cleanupCameraStream);
});

document.addEventListener('DOMContentLoaded', function() {
    try {
        localStorage.setItem('mappingPageActive', 'false');
    } catch (error) {
        console.warn('Failed to update mappingPageActive flag on 3D page:', error);
    }
    console.log('DOMContentLoaded: 3D検知画面読み込み完了');
    
    // ページ終了時のクリーンアップ（複数イベントで確実に実行）
    function cleanupIntervals() {
        console.log('クリーンアップ実行: インターバル停止');
        if (window.pixelCountInterval) {
            clearInterval(window.pixelCountInterval);
            window.pixelCountInterval = null;
            console.log('pixelCountInterval を停止しました');
        }
    }
    
    window.addEventListener('beforeunload', cleanupIntervals);
    window.addEventListener('pagehide', cleanupIntervals);
    window.addEventListener('unload', cleanupIntervals);
    
    // ページ表示時に既存のインターバルをクリア（前回の残骸対策）
    if (window.pixelCountInterval) {
        console.log('ページ読み込み時: 既存のインターバルをクリア');
        clearInterval(window.pixelCountInterval);
        window.pixelCountInterval = null;
    }
    
    // ドロップダウンメニューの機能
    const dropdownBtn = document.querySelector('.dropdown-btn');
    const dropdownContent = document.querySelector('.dropdown-content');

    if (dropdownBtn && dropdownContent) {
        dropdownBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropdownContent.classList.toggle('show');
        });

        // ドロップダウンの外をクリックしたら閉じる
        document.addEventListener('click', function() {
            if (dropdownContent.classList.contains('show')) {
                dropdownContent.classList.remove('show');
            }
        });

        // ドロップダウン内のクリックでは閉じない
        dropdownContent.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }

    const colorBtn = document.getElementById('colorBtn');
    const depthBtn = document.getElementById('depthBtn');
    const cameraStream = document.getElementById('cameraStream');
    const tableBody = document.querySelector('.styled-table tbody');

    // 安全な初期化: データ読み込みを優先
    try {
        console.log('検知画面初期化開始');
        
        // 原点データを読み込んでテーブルに表示
        loadOriginData().then(() => {
            console.log('原点データ読み込み完了');
            
            // データ読み込み後にカメラストリームを初期化
            if (cameraStream && colorBtn) {
                setTimeout(() => {
                    cameraStream.src = '/detection/stream/rgb';
                    colorBtn.style.backgroundColor = '#0056b3';
                    console.log('カメラストリーム初期化完了');
                }, 500); // 500ms遅延
            }
        }).catch(error => {
            console.error('原点データ読み込みエラー:', error);
        });
        
    } catch (error) {
        console.error('検知画面初期化エラー:', error);
    }

    // カラー画像ボタンのクリックイベント
    if (colorBtn) {
        colorBtn.addEventListener('click', function() {
            try {
                cameraStream.src = '/detection/stream/rgb';
                colorBtn.style.backgroundColor = '#0056b3';
                if (depthBtn) {
                    depthBtn.style.backgroundColor = '#007BFF';
                }
                console.log('RGBストリームに切り替え');
            } catch (error) {
                console.error('RGBストリーム切り替えエラー:', error);
            }
        });
    }

    // 深度画像ボタンのクリックイベント
    if (depthBtn) {
        depthBtn.addEventListener('click', function() {
            try {
                cameraStream.src = '/detection/stream/depth';
                depthBtn.style.backgroundColor = '#0056b3';
                if (colorBtn) {
                    colorBtn.style.backgroundColor = '#007BFF';
                }
                console.log('深度ストリームに切り替え');
            } catch (error) {
                console.error('深度ストリーム切り替えエラー:', error);
            }
        });
    }

    // 画像の読み込みエラーハンドリング
    if (cameraStream) {
        cameraStream.addEventListener('error', function() {
            console.error('カメラストリームの読み込みに失敗しました');
        });

        cameraStream.addEventListener('load', function() {
            console.log('カメラストリームが正常に読み込まれました');
        });
    }

    // 原点データを保存する変数
    let originDataList = [];
    let selectedRow = null;
    let selectedJudgeRow = null;

    // 原点データを読み込んでテーブルに表示する関数
    function loadOriginData() {
        return fetch('/detection/api/get_origins')
            .then(response => response.json())
            .then(data => {
                if (data.origins && tableBody) {
                    // データを保存
                    originDataList = data.origins;
                    
                    // テーブルをクリア
                    tableBody.innerHTML = '';
                    
                    if (data.origins.length === 0) {
                        // データがない場合
                        const emptyRow = document.createElement('tr');
                        emptyRow.innerHTML = '<td colspan="3">登録された原点がありません</td>';
                        tableBody.appendChild(emptyRow);
                    } else {
                        // データがある場合は各原点を表示
                        data.origins.forEach((origin, index) => {
                            const row = document.createElement('tr');
                            
                            // judge_settingsの数を計算
                            let judgeCount = 0;
                            if (origin.judge_settings && typeof origin.judge_settings === 'object') {
                                judgeCount = Object.keys(origin.judge_settings).length;
                            }
                            
                            row.innerHTML = `
                                <td>${origin.No}</td>
                                <td>${judgeCount}</td>
                                <td>${origin.comment || ''}</td>
                            `;
                            // 行にデータのインデックスを保存
                            row.dataset.originIndex = index;
                            
                            // 行クリックイベントを追加
                            row.addEventListener('click', function() {
                                // 前の選択をクリア
                                if (selectedRow) {
                                    selectedRow.classList.remove('selected');
                                }
                                
                                // 新しい行を選択
                                selectedRow = row;
                                selectedRow.classList.add('selected');
                                
                                // 選択された原点データを取得
                                const originIndex = parseInt(row.dataset.originIndex);
                                const selectedOriginData = originDataList[originIndex];
                                
                                // 選択された原点のjudge-tableを表示
                                showJudgeTableForOrigin(selectedOriginData);
                                
                                console.log('選択された原点データ:', selectedOriginData);
                            });
                            
                            tableBody.appendChild(row);
                        });
                    }
                    
                    // judge-tableを初期化（空の状態）
                    initializeJudgeTable();
                }
            })
            .catch(error => {
                console.error('原点データの読み込みに失敗しました:', error);
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="3">データの読み込みに失敗しました</td></tr>';
                }
            });
    }

    // judge-tableを初期化する関数（空の状態）
    function initializeJudgeTable() {
        const judgeTableBody = document.querySelector('.judge-table tbody');
        if (!judgeTableBody) return;

        // ピクセルカウントを確実に停止
        if (window.pixelCountInterval) {
            clearInterval(window.pixelCountInterval);
            window.pixelCountInterval = null;
            console.log('judge-table初期化時にピクセルカウントを停止');
        }
        
        // 状態をリセット
        currentSelectedOrigin = null;
        selectedJudgeRow = null;

        // 取得ボタンを無効化
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.disabled = true;
            captureBtn.textContent = '取得';
        }

        // テーブルをクリア（初期状態では空にする）
        judgeTableBody.innerHTML = '<tr><td colspan="11">原点を選択してください</td></tr>';
    }

    // リアルタイムピクセルカウント用の変数
    let currentSelectedOrigin = null;

    // 選択された原点のjudge-tableを表示する関数
    function showJudgeTableForOrigin(originData) {
        const judgeTableBody = document.querySelector('.judge-table tbody');
        if (!judgeTableBody || !originData) return;

        // 前のピクセルカウントを停止
        if (pixelCountInterval) {
            clearInterval(pixelCountInterval);
        }

        // 現在選択された原点を保存
        currentSelectedOrigin = originData;
        
        // 判定行選択状態をリセット
        selectedJudgeRow = null;
        resetCaptureButton();

        // テーブルをクリア
        judgeTableBody.innerHTML = '';
        
        console.log('judge-table表示開始:', originData);

        // 選択された原点に対して3つの判定行を生成
        for (let judgeNo = 1; judgeNo <= 3; judgeNo++) {
            const row = document.createElement('tr');
            
            // detect_dataから既存の値を取得
            let pixelMin = '';
            let pixelMax = '';
            let detectTime = 0;
            let comment = '';
            
            // judge_settingsから設定値を取得（一元管理）
            if (originData.judge_settings && originData.judge_settings[`judge${judgeNo}`]) {
                const judgeSettings = originData.judge_settings[`judge${judgeNo}`];
                pixelMin = judgeSettings.pixel_min !== null ? judgeSettings.pixel_min : '';
                pixelMax = judgeSettings.pixel_max !== null ? judgeSettings.pixel_max : '';
                detectTime = judgeSettings.detect_time || 0;
                comment = judgeSettings.comment || '';
                console.log(`設定読み込み: 原点${originData.No}-判定${judgeNo} [${pixelMin}-${pixelMax}] 時間:${detectTime}秒`);
            }
            
            // 安全にデータを取得
            const depthMin = (originData.depth && originData.depth.depth_min !== undefined) ? originData.depth.depth_min : '';
            const depthMax = (originData.depth && originData.depth.depth_max !== undefined) ? originData.depth.depth_max : '';
            
            row.innerHTML = `
                <td class="total-judgment">-</td>
                <td>${originData.No}</td>
                <td>${judgeNo}</td>
                <td>${depthMin}</td>
                <td>${depthMax}</td>
                <td contenteditable="true">${pixelMin}</td>
                <td contenteditable="true">${pixelMax}</td>
                <td class="current-value">-</td>
                <td class="judgment">-</td>
                <td contenteditable="true">${detectTime}</td>
                <td contenteditable="true">${comment}</td>
            `;
            // 行に原点番号と判定番号、フレームカウント管理データを保存
            row.dataset.originNo = originData.No;
            row.dataset.judgeNo = judgeNo;
            row.dataset.okFrameCount = 0;  // OKフレーム数カウンター
            row.dataset.totalJudgment = 'ng'; // 総合判定状態
            
            // 総合判定セルの初期設定（デフォルトは'-'）
            const totalJudgmentCell = row.children[0];
            totalJudgmentCell.textContent = '-';
            totalJudgmentCell.className = 'total-judgment';
            
            // 行クリックで選択
            row.addEventListener('click', function(event) {
                event.preventDefault();
                
                // 前の選択をクリア
                const allJudgeRows = document.querySelectorAll('.judge-table tbody tr');
                allJudgeRows.forEach(r => r.classList.remove('selected'));
                
                // 新しい行を選択
                selectedJudgeRow = row;
                selectedJudgeRow.classList.add('selected');
                
                // 取得ボタンを有効化
                const captureBtn = document.getElementById('captureBtn');
                if (captureBtn) {
                    captureBtn.disabled = false;
                    captureBtn.textContent = `取得 (原点${originData.No}-判定${judgeNo})`;
                }
                
                console.log(`判定行選択: 原点${originData.No}, 判定${judgeNo}`);
                
                // 選択状態をユーザーに通知
                showSelectionStatus(`原点No.${originData.No} - 判定No.${judgeNo} を選択しました`);
            });
            
            judgeTableBody.appendChild(row);
        }

        // リアルタイムピクセルカウントを開始
        startPixelCounting(originData);
    }

    // リアルタイムピクセルカウントを開始する関数
    function startPixelCounting(originData) {
        if (!originData || !originData.points || !originData.depth) {
            console.error('startPixelCounting: 無効な原点データ', originData);
            return;
        }

        // 既存のインターバルを停止（重複実行防止）
        if (window.pixelCountInterval) {
            clearInterval(window.pixelCountInterval);
            console.log('既存のリアルタイム監視を停止');
        }

        console.log(`リアルタイム監視開始: 原点${originData.No}`);
        console.log('監視対象データ:', {
            points: originData.points,
            depth_min: originData.depth.depth_min,
            depth_max: originData.depth.depth_max
        });

        // 500msごとに更新
        window.pixelCountInterval = setInterval(() => {
            console.log(`[${new Date().toLocaleTimeString()}] updatePixelCounts呼び出し`);
            updatePixelCounts(originData);
        }, 500);

        console.log('setIntervalが設定されました。ID:', window.pixelCountInterval);
        
        // 初回実行
        console.log('初回updatePixelCounts実行');
        updatePixelCounts(originData);
    }

    // ピクセルカウントを更新する関数
    function updatePixelCounts(originData) {
        // データ有効性チェック
        if (!originData || !originData.points || !originData.depth) {
            console.warn('無効な原点データ:', originData);
            return;
        }
        
        // 既に保存されている座標は実際のカメラ座標なので、そのまま使用
        const requestData = {
            points: originData.points,  // 既に変換済みの座標
            depth_min: originData.depth.depth_min,
            depth_max: originData.depth.depth_max
        };

        console.log('ピクセルカウント要求データ:', requestData);

        // タイムアウト付きfetch（リアルタイム監視用）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒タイムアウト
        
        fetch('/detection/api/count_pixels', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            console.log('API レスポンス状態:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('ピクセルカウント応答:', data);
            
            if (data.error) {
                console.error('ピクセルカウントエラー:', data.error);
                return;
            }

            const pixelCount = data.pixel_count || 0;
            console.log('取得したピクセル数:', pixelCount);
            
            // 各判定行の現在値を更新
            const judgeRows = document.querySelectorAll('.judge-table tbody tr');
            judgeRows.forEach(row => {
                if (parseInt(row.dataset.originNo) === originData.No) {
                    const currentValueCell = row.querySelector('.current-value');
                    
                    if (currentValueCell) {
                        currentValueCell.textContent = pixelCount;
                        console.log(`原点${originData.No}の現在値を更新: ${pixelCount}`);
                    }

                    // 判定処理を新しい関数で実行
                    const lowerLimitCell = row.children[5];
                    const upperLimitCell = row.children[6];
                    const detectTimeCell = row.children[9];
                    const judgmentCell = row.children[8]; // 8列目が「判定」列
                    
                    if (lowerLimitCell && upperLimitCell && detectTimeCell) {
                        // 設定値を取得
                        const lowerRaw = parseFloat((lowerLimitCell.textContent || '').trim());
                        const upperRaw = parseFloat((upperLimitCell.textContent || '').trim());
                        const detectRaw = parseFloat((detectTimeCell.textContent || '').trim());
                        
                        // 設定値が空の場合は判定をスキップ
                        const hasLowerLimit = Number.isFinite(lowerRaw);
                        const hasUpperLimit = Number.isFinite(upperRaw);
                        
                        if (!hasLowerLimit || !hasUpperLimit) {
                            // 設定値が空の場合は'-'を表示
                            const totalJudgmentCell = row.children[0];
                            const judgmentCell = row.children[8];
                            if (totalJudgmentCell) {
                                totalJudgmentCell.textContent = '-';
                                totalJudgmentCell.className = 'total-judgment';
                            }
                            if (judgmentCell) {
                                judgmentCell.textContent = '-';
                                judgmentCell.className = 'judgment';
                            }
                            return;
                        }
                        
                        const lowerLimit = lowerRaw;
                        const upperLimit = upperRaw;
                        const detectTime = Number.isFinite(detectRaw) ? detectRaw : 0;
                        const okFrameCount = parseInt(row.dataset.okFrameCount) || 0;
                        
                        const judgeNo = parseInt(row.dataset.judgeNo);
                        
                        // 判定関数を呼び出し（500ms間隔で実行）
                        const result = evaluateJudgment(pixelCount, lowerLimit, upperLimit, detectTime, okFrameCount, 500);
                        
                        console.log(`[判定] 原点${originData.No}-判定${judgeNo}: ピクセル=${pixelCount}, 範囲=[${lowerLimit}-${upperLimit}], フレーム=${okFrameCount}, 結果=${result.totalJudgment}`);
                        
                        // フレームカウントの管理
                        if (result.needsFrameIncrement) {
                            // ピクセルOKならフレームカウントを増やす
                            row.dataset.okFrameCount = okFrameCount + 1;
                        } else {
                            // ピクセルNGならフレームカウントをリセット
                            if (okFrameCount > 0) {
                                console.log(`NG状態: 原点${originData.No}-判定${judgeNo} フレームリセット`);
                            }
                            row.dataset.okFrameCount = 0;
                        }
                        
                        // 総合判定状態を保存
                        row.dataset.totalJudgment = result.totalJudgment;
                        
                        // UI更新
                        updateJudgmentUI(row, result);
                    }
                }
            });
        })
        .catch(error => {
            clearTimeout(timeoutId);
            
            // タイムアウトやネットワークエラーは詳細ログのみ（アラート不要）
            if (error.name === 'AbortError') {
                console.warn('ピクセルカウント取得タイムアウト（リアルタイム監視継続）');
            } else if (error.message.includes('Failed to fetch')) {
                console.warn('ピクセルカウント通信エラー（リアルタイム監視継続）');
            } else {
                console.error('ピクセルカウント取得エラー:', error);
                console.error('エラー詳細:', error.message);
            }
        });
    }

    // 選択状態通知関数
    function showSelectionStatus(message) {
        // コンソールにログ出力
        console.log('選択状態:', message);
        
        // ステータス表示エリアがある場合はそこに表示
        const statusElement = document.getElementById('selectionStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = '#007BFF';
            statusElement.style.fontWeight = 'bold';
        }
    }

    // 取得ボタンをリセットする関数
    function resetCaptureButton() {
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) {
            captureBtn.disabled = true;
            captureBtn.textContent = '取得';
        }
    }

    // 取得ボタンのクリックイベント
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.addEventListener('click', function() {
            if (!selectedJudgeRow || !currentSelectedOrigin) {
                alert('原点と判定行を選択してください');
                return;
            }

            const originNo = parseInt(selectedJudgeRow.dataset.originNo);
            const judgeNo = parseInt(selectedJudgeRow.dataset.judgeNo);
            
            console.log(`取得開始: 原点${originNo}, 判定${judgeNo}`);
            
            // 取得ボタンを無効化
            captureBtn.disabled = true;
            captureBtn.textContent = '計測中...';
            
            // カウントダウン開始
            startCountdown(() => {
                // カウントダウン完了後に5フレーム計測
                capture5Frames(originNo, judgeNo, currentSelectedOrigin);
            });
        });
    }

    // カウントダウン機能
    function startCountdown(callback) {
        const popup = document.getElementById('countdownPopup');
        const numberElement = document.getElementById('countdownNumber');
        
        if (!popup || !numberElement) return;
        
        let count = 3;
        popup.style.display = 'flex';
        numberElement.textContent = count;
        
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                numberElement.textContent = count;
            } else {
                clearInterval(countdownInterval);
                popup.style.display = 'none';
                
                // コールバックを実行
                if (typeof callback === 'function') {
                    callback();
                }
            }
        }, 1000);
    }

    // 5フレーム分の計測を行う関数
    function capture5Frames(originNo, judgeNo, originData) {
        console.log(`5フレーム計測開始: 原点${originNo}, 判定${judgeNo}`);
        
        // 計測結果を保存する配列
        const results = [];
        
        // 5回の計測を実行
        for (let i = 0; i < 5; i++) {
            // ピクセルカウントを一時停止
            if (window.pixelCountInterval) {
                clearInterval(window.pixelCountInterval);
                console.log('ピクセルカウントを一時停止');
            }
            
            // 現在の時刻を取得
            const timestamp = new Date().toISOString();
            
            // 計測データを生成
            const data = {
                origin_no: originNo,
                judge_no: judgeNo,
                timestamp: timestamp,
                pixel_count: parseInt(document.querySelector('.current-value').textContent) || 0
            };
            
            console.log(`計測データ: ${JSON.stringify(data)}`);
            
            // サーバーに計測データを送信
            fetch('/detection/api/capture_frame', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                console.log('サーバー応答:', data);
                
                if (data.success) {
                    results.push(data.result);
                    console.log(`フレーム${i+1}の計測結果を保存:`, data.result);
                } else {
                    console.error(`フレーム${i+1}の計測に失敗:`, data.message);
                }
            })
            .catch(error => {
                console.error(`フレーム${i+1}の計測中にエラー発生:`, error);
            })
            .finally(() => {
                // 最後のフレーム以外は待機
                if (i < 4) {
                    setTimeout(() => {
                        console.log(`フレーム${i+1}の計測完了、次のフレームへ`);
                    }, 1000); // 1秒待機
                } else {
                    // 最後のフレーム計測後の処理
                    setTimeout(() => {
                        console.log('全フレームの計測が完了しました:', results);
                        
                        // 結果を表示
                        displayCaptureResults(results);
                        
                        // ピクセルカウントを再開
                        startPixelCounting(originData);
                    }, 1000);
                }
            });
        }
    }

    // 計測結果を表示する関数
    function displayCaptureResults(results) {
        const resultTableBody = document.querySelector('#resultTable tbody');
        if (!resultTableBody) return;
        
        // テーブルをクリア
        resultTableBody.innerHTML = '';
        
        results.forEach((result, index) => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${result.timestamp}</td>
                <td>${result.pixel_count}</td>
                <td>${result.judge_result}</td>
            `;
            
            resultTableBody.appendChild(row);
        });
        
        // 結果ポップアップを表示
        const resultPopup = document.getElementById('resultPopup');
        if (resultPopup) {
            resultPopup.style.display = 'block';
        }
    }

    // 結果ポップアップの閉じるボタン
    const closeButton = document.getElementById('closeResultButton');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            const resultPopup = document.getElementById('resultPopup');
            if (resultPopup) {
                resultPopup.style.display = 'none';
            }
        });
    }
});

