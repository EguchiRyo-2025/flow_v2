// static/js/detect_3D.js

// グローバル変数
let pixelCountInterval = null;

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

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded: 3D検知画面読み込み完了');
    
    // ページ終了時のクリーンアップ
    window.addEventListener('beforeunload', function() {
        console.log('ページ終了: クリーンアップ実行');
        if (pixelCountInterval) {
            clearInterval(pixelCountInterval);
            pixelCountInterval = null;
        }
    });
    
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
                    cameraStream.src = '/stream/rgb';
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
                cameraStream.src = '/stream/rgb';
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
                cameraStream.src = '/stream/depth';
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
        return fetch('/api/get_origins')
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
        if (pixelCountInterval) {
            clearInterval(pixelCountInterval);
            pixelCountInterval = null;
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
            // 行に原点番号と判定番号、時間管理データを保存
            row.dataset.originNo = originData.No;
            row.dataset.judgeNo = judgeNo;
            row.dataset.okStartTime = null;  // OK状態開始時刻
            row.dataset.totalJudgment = 'ng'; // 総合判定状態
            
            // 総合判定セルの初期設定
            const totalJudgmentCell = row.children[0];
            totalJudgmentCell.textContent = '×';
            totalJudgmentCell.className = 'total-judgment total-judgment-ng';
            
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
        if (!originData || !originData.points || !originData.depth) return;

        // 既存のインターバルを停止（重複実行防止）
        if (pixelCountInterval) {
            clearInterval(pixelCountInterval);
            console.log('既存のリアルタイム監視を停止');
        }

        // 500msごとに更新
        pixelCountInterval = setInterval(() => {
            updatePixelCounts(originData);
        }, 500);

        console.log(`リアルタイム監視開始: 原点${originData.No}`);
        
        // 初回実行
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
        
        fetch('/api/count_pixels', {
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
                    const judgmentCell = row.querySelector('.judgment');
                    
                    if (currentValueCell) {
                        currentValueCell.textContent = pixelCount;
                        console.log(`原点${originData.No}の現在値を更新: ${pixelCount}`);
                    }

                    // リアルタイム判定ロジック
                    const lowerLimitCell = row.children[5]; // ピクセル判定下限
                    const upperLimitCell = row.children[6]; // ピクセル判定上限
                    const detectTimeCell = row.children[9]; // 検知時間
                    const totalJudgmentCell = row.children[0]; // 総合判定
                    
                    if (lowerLimitCell && upperLimitCell && judgmentCell && detectTimeCell) {
                        const lowerLimit = parseFloat(lowerLimitCell.textContent) || 0;
                        const upperLimit = parseFloat(upperLimitCell.textContent) || 999999;
                        const detectTimeThreshold = parseFloat(detectTimeCell.textContent) || 0;
                        
                        // ピクセル判定（上下限が有効な数値で設定されている場合のみ）
                        const hasValidLimits = !isNaN(lowerLimit) && !isNaN(upperLimit) && 
                                             lowerLimit >= 0 && upperLimit > 0 && 
                                             lowerLimit <= upperLimit &&
                                             (lowerLimit > 0 || upperLimit < 999999);
                        
                        // rowからjudgeNoを取得
                        const judgeNo = parseInt(row.dataset.judgeNo);
                        
                        console.log(`判定処理: 原点${originData.No}-判定${judgeNo}, ピクセル=${pixelCount}, 下限=${lowerLimit}, 上限=${upperLimit}, 時間=${detectTimeThreshold}, 有効範囲=${hasValidLimits}`);
                        
                        let judgment = '-';
                        let judgmentClass = 'judgment';
                        
                        if (hasValidLimits) {
                            if (pixelCount >= lowerLimit && pixelCount <= upperLimit) {
                                judgment = '○';
                                judgmentClass = 'judgment-ok';
                                
                                // OK状態の開始時刻を記録
                                if (!row.dataset.okStartTime) {
                                    row.dataset.okStartTime = Date.now();
                                    console.log(`OK状態開始: 原点${originData.No}-判定${judgeNo}, ピクセル数: ${pixelCount}`);
                                }
                            
                            // 検知時間の計算
                            const elapsedTime = (Date.now() - parseInt(row.dataset.okStartTime)) / 1000; // 秒
                            
                            // 検知時間を超えた場合、または検知時間が0の場合は総合判定をOKに
                            if ((detectTimeThreshold > 0 && elapsedTime >= detectTimeThreshold) || detectTimeThreshold === 0) {
                                if (row.dataset.totalJudgment !== 'ok') {
                                    row.dataset.totalJudgment = 'ok';
                                    totalJudgmentCell.textContent = '○';
                                    totalJudgmentCell.className = 'total-judgment total-judgment-ok';
                                    console.log(`総合判定OK: 原点${originData.No}-判定${judgeNo}, 経過時間: ${elapsedTime.toFixed(1)}秒, 闾値: ${detectTimeThreshold}`);
                                }
                            }
                            } else {
                                // NG状態
                                judgment = '×';
                                judgmentClass = 'judgment-ng';
                                
                                // NG状態になったらOK開始時刻をリセット
                                if (row.dataset.okStartTime) {
                                    console.log(`NG状態に変更: 原点${originData.No}-判定${judgeNo}, ピクセル数: ${pixelCount}`);
                                    row.dataset.okStartTime = null;
                                }
                                
                                // 総合判定もNGに戻す
                                if (row.dataset.totalJudgment !== 'ng') {
                                    row.dataset.totalJudgment = 'ng';
                                    totalJudgmentCell.textContent = '×';
                                    totalJudgmentCell.className = 'total-judgment total-judgment-ng';
                                }
                            }
                        }
                        
                        // 判定結果を表示更新（必ず実行）
                        judgmentCell.textContent = judgment;
                        judgmentCell.className = judgmentClass;
                        console.log(`判定更新: ${judgment} (${judgmentClass})`);

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
                if (callback) callback();
            }
        }, 1000);
    }

    // 5フレーム計測機能
    function capture5Frames(originNo, judgeNo, originData) {
        // 既に保存されている座標は実際のカメラ座標なので、そのまま使用
        const requestData = {
            origin_no: originNo,
            judge_no: judgeNo,
            points: originData.points,  // 既に変換済みの座標
            depth_min: originData.depth.depth_min,
            depth_max: originData.depth.depth_max
        };

        console.log('5フレーム計測開始:', requestData);

        // タイムアウト付きfetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒タイムアウト
        
        fetch('/api/capture_pixel_range', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: controller.signal
        })
        .then(response => response.json())
        .then(data => {
            clearTimeout(timeoutId);
            console.log('5フレーム計測結果:', data);
            
            if (data.error) {
                alert(`計測エラー: ${data.error}`);
                return;
            }

            if (data.success) {
                // 判定テーブルのピクセル判定下限・上限を更新
                const pixelMinCell = selectedJudgeRow.children[5]; // ピクセル判定下限
                const pixelMaxCell = selectedJudgeRow.children[6]; // ピクセル判定上限
                
                if (pixelMinCell && pixelMaxCell) {
                    pixelMinCell.textContent = data.pixel_min;
                    pixelMaxCell.textContent = data.pixel_max;
                }

                // 成功メッセージ
                console.log('計測結果をテーブルに反映済み、リアルタイム監視を継続');
                alert(`計測完了!\nピクセル範囲: ${data.pixel_min} - ${data.pixel_max}\nフレーム値: [${data.frame_counts.join(', ')}]`);
                
                // リアルタイム監視が継続されていることを確認
                if (pixelCountInterval) {
                    console.log('リアルタイム監視は正常に動作中');
                } else {
                    console.warn('リアルタイム監視が停止している可能性があります');
                }
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            console.error('5フレーム計測エラー:', error);
            
            if (error.name === 'AbortError') {
                alert('計測がタイムアウトしました。カメラの接続を確認してください。');
            } else if (error.message.includes('Failed to fetch')) {
                alert('サーバーとの通信に失敗しました。アプリケーションが動作しているか確認してください。');
            } else {
                alert(`計測エラー: ${error.message}`);
            }
        })
        .finally(() => {
            // 取得ボタンを再度有効化（選択状態を維持）
            const captureBtn = document.getElementById('captureBtn');
            if (captureBtn && selectedJudgeRow) {
                captureBtn.disabled = false;
                const originNo = selectedJudgeRow.dataset.originNo;
                const judgeNo = selectedJudgeRow.dataset.judgeNo;
                captureBtn.textContent = `取得 (原点${originNo}-判定${judgeNo})`;
            } else {
                resetCaptureButton();
            }
        });
    }

    // 登録ボタンのクリックイベント
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            if (!currentSelectedOrigin) {
                alert('原点を選択してください');
                return;
            }

            // 現在表示されている判定テーブルのデータを収集
            const judgeRows = document.querySelectorAll('.judge-table tbody tr');
            const judgeData = [];

            judgeRows.forEach(row => {
                const originNo = parseInt(row.dataset.originNo);
                const judgeNo = parseInt(row.dataset.judgeNo);
                
                if (originNo === currentSelectedOrigin.No) {
                    const pixelMinCell = row.children[5];  // ピクセル判定下限
                    const pixelMaxCell = row.children[6];  // ピクセル判定上限
                    const detectTimeCell = row.children[9]; // 検知時間
                    const commentCell = row.children[10];   // コメント
                    
                    const judgeItem = {
                        judge_no: judgeNo,
                        pixel_min: pixelMinCell.textContent.trim(),
                        pixel_max: pixelMaxCell.textContent.trim(),
                        detect_time: detectTimeCell.textContent.trim(),
                        comment: commentCell.textContent.trim()
                    };
                    
                    judgeData.push(judgeItem);
                }
            });

            if (judgeData.length === 0) {
                alert('保存するデータがありません');
                return;
            }

            // サーバーに送信
            const requestData = {
                origin_no: currentSelectedOrigin.No,
                judge_data: judgeData
            };

            console.log('判定設定保存要求:', requestData);

            fetch('/api/save_judge_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            })
            .then(response => response.json())
            .then(data => {
                console.log('判定設定保存結果:', data);
                
                if (data.error) {
                    alert(`保存エラー: ${data.error}`);
                    return;
                }

                if (data.success) {
                    alert('判定設定を保存しました');
                    // 原点データを再読み込み（更新された設定を反映）
                    const selectedOriginNo = currentSelectedOrigin.No;
                    loadOriginData().then(() => {
                        // 同じ原点を再選択してjudge-tableを再表示
                        const updatedOrigin = originDataList.find(origin => origin.No === selectedOriginNo);
                        if (updatedOrigin) {
                            showJudgeTableForOrigin(updatedOrigin);
                        }
                    });
                }
            })
            .catch(error => {
                console.error('判定設定保存エラー:', error);
                alert(`保存エラー: ${error.message}`);
            });
        });
    }
});