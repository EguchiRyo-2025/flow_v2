// static/js/set_3D_origin.js

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

document.addEventListener('DOMContentLoaded', () => {
  try {
    localStorage.setItem('mappingPageActive', 'false');
  } catch (error) {
    console.warn('Failed to update mappingPageActive flag on origin page:', error);
  }
  console.log('原点設定画面: DOM読み込み完了');
  
  // ページ遷移時のクリーンアップ（どのページから来てもカメラリソースを確実に解放）
  function cleanupOnPageLeave() {
    console.log('原点設定画面: ページ離脱時のクリーンアップ開始');
    
    // カメラストリームを停止（RGB/Depth両対応）
    const cameraStream = document.getElementById('cameraStream');
    if (cameraStream) {
      cameraStream.src = '';
      console.log('原点設定画面: カメラストリーム（RGB/Depth）を停止しました');
    }
    
    // インターバルをクリア
    if (window.pixelCountInterval) {
      clearInterval(window.pixelCountInterval);
      window.pixelCountInterval = null;
      console.log('原点設定画面: インターバルを停止しました');
    }
    
    // サーバーにクリーンアップを通知（keepalive: trueで確実に送信）
    try {
      fetch('/detection/cleanup', {
        method: 'POST',
        keepalive: true
      });
      console.log('原点設定画面: クリーンアップ通知を送信しました');
    } catch (err) {
      console.warn('カメラクリーンアップ通知エラー:', err);
    }
  }
  
  // ページ読み込み時にも既存のインターバルをクリア
  if (window.pixelCountInterval) {
    console.log('原点設定画面: 読み込み時に既存のインターバルを停止');
    clearInterval(window.pixelCountInterval);
    window.pixelCountInterval = null;
  }
  
  window.addEventListener('beforeunload', cleanupOnPageLeave);
  window.addEventListener('pagehide', cleanupOnPageLeave);
  window.addEventListener('unload', cleanupOnPageLeave);
  
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

  const tbody = document.querySelector('.styled-table tbody');
  const btnNew = document.getElementById('addBtn');
  const editBtn = document.getElementById('editBtn');
  const box = document.getElementById('resizableBox');
  const handle = box ? box.querySelector('.resize-handle') : null;
  const colorBtn = document.getElementById('colorBtn');
  const depthBtn = document.getElementById('depthBtn');
  const cameraContainer = document.querySelector('.camera-area');
  const originBtn = document.querySelector('.origin-button button');
  const commentDisplay = document.getElementById('commentDisplay');

  let selectedRow = null; // 選択された行を記録
  let selectedData = null; // 選択された行のデータ
  let currentComment = ''; // 現在のコメント

  if (!box || !handle || !cameraContainer) {
    console.warn('必要な要素が見つかりません');
    return;
  }

  // JSONデータからテーブルを初期化
  function loadTableFromJSON() {
    fetch('/detection/api/get_origins')
      .then(response => response.json())
      .then(data => {
        if (data.origins && Array.isArray(data.origins)) {
          // テーブルをクリア
          tbody.innerHTML = '';
          
          // データを追加
          data.origins.forEach(origin => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${origin.No}</td>
              <td>${origin.depth ? `${origin.depth.depth_min}-${origin.depth.depth_max}` : ''}</td>
              <td contenteditable="true">${origin.comment || ''}</td>
            `;
            // データを行に保存
            row.dataset.originData = JSON.stringify(origin);
            tbody.appendChild(row);
          });
          
          // イベントリスナーを再設定
          setupTableRowEvents();
        }
      })
      .catch(error => {
        console.error('JSONデータの読み込みエラー:', error);
      });
  }

  // テーブル行のクリックイベントを設定
  function setupTableRowEvents() {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      row.addEventListener('click', function() {
        // 前の選択をクリア
        if (selectedRow) {
          selectedRow.classList.remove('selected');
        }
        
        // 新しい行を選択
        selectedRow = row;
        selectedRow.classList.add('selected');
        
        // 選択された行のデータを取得
        try {
          selectedData = JSON.parse(row.dataset.originData);
          console.log('選択されたデータ:', selectedData);
        } catch (e) {
          selectedData = null;
          console.error('データの解析エラー:', e);
        }
        
        // コメントを取得して表示
        const commentCell = row.querySelector('td:nth-child(3)');
        currentComment = commentCell ? commentCell.textContent : '';
        updateCommentDisplay();
      });
    });
  }

  // コメント表示を更新
  function updateCommentDisplay() {
    if (commentDisplay) {
      commentDisplay.textContent = currentComment;
      commentDisplay.style.display = currentComment ? 'block' : 'none';
    }
  }

  // 初期設定 - JSONからテーブルを読み込み
  loadTableFromJSON();

  function getMaxNumber() {
    const rows = tbody.querySelectorAll('tr');
    let maxNum = 0;
    rows.forEach(row => {
      const numCell = row.querySelector('td:first-child');
      const num = parseInt(numCell.textContent);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return maxNum;
  }



  if (btnNew && tbody) {
    btnNew.addEventListener('click', () => {
      const newNumber = getMaxNumber() + 1;
      const newRow = document.createElement('tr');
      newRow.innerHTML = `<td>${newNumber}</td><td></td><td contenteditable="true"></td>`;
      tbody.appendChild(newRow);
      
      // 新しい行にもイベントを設定
      setupTableRowEvents();
    });
  }

  // 削除ボタン
  const deleteBtn = document.querySelector('.table-buttons button[type="button"]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!selectedRow || !selectedData) {
        alert('削除する原点を選択してください');
        return;
      }
      
      const originNo = selectedData.No;
      const confirmDelete = confirm(`原点No.${originNo}を削除してもよろしいですか？\n削除後、原点番号は自動的に振り直されます。`);
      
      if (!confirmDelete) {
        return;
      }
      
      try {
        const response = await fetch(`/detection/api/delete_origin/${originNo}`, {
          method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          alert(result.message);
          // テーブルを再読み込み
          loadTableFromJSON();
          // 選択状態をリセット
          selectedRow = null;
          selectedData = null;
          currentComment = '';
          updateCommentDisplay();
        } else {
          alert('削除に失敗しました: ' + (result.error || '不明なエラー'));
        }
      } catch (error) {
        console.error('削除エラー:', error);
        alert('削除処理中にエラーが発生しました');
      }
    });
  }

  // ボックスのイベントリスナーを設定する関数
  function setupBoxEvents(boxEl, handleEl) {
    if (!boxEl || !handleEl) return;
    
    boxEl.addEventListener('mousedown', (e) => {
      if (e.target === handleEl) return;
      isMoving = true;
      offsetX = e.clientX - boxEl.offsetLeft;
      offsetY = e.clientY - boxEl.offsetTop;
      boxEl.style.cursor = 'move';
    });

    handleEl.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      initialWidth = boxEl.offsetWidth;
      initialHeight = boxEl.offsetHeight;
    });
  }

  editBtn.addEventListener('click', () => {
    let boxEl = document.getElementById('resizableBox');
    let handleEl = null;
    
    if (!boxEl) {
      // boxが消えていた場合は再生成
      boxEl = document.createElement('div');
      boxEl.id = 'resizableBox';
      boxEl.className = 'resizable-box';
      boxEl.innerHTML = '<div class="resize-handle"></div>';
      cameraContainer.appendChild(boxEl);
      
      // handleの参照を取得
      handleEl = boxEl.querySelector('.resize-handle');
      
      // 新しい要素にイベントリスナーを設定
      setupBoxEvents(boxEl, handleEl);
    } else {
      handleEl = boxEl.querySelector('.resize-handle');
    }
    
    // 選択されたデータがある場合は、その位置とサイズにボックスを配置
    if (selectedData && selectedData.points && selectedData.points.length === 4) {
      const points = selectedData.points;
      const x1 = Math.min(...points.map(p => p[0]));
      const y1 = Math.min(...points.map(p => p[1]));
      const x2 = Math.max(...points.map(p => p[0]));
      const y2 = Math.max(...points.map(p => p[1]));
      
      boxEl.style.left = `${x1}px`;
      boxEl.style.top = `${y1}px`;
      boxEl.style.width = `${x2 - x1}px`;
      boxEl.style.height = `${y2 - y1}px`;
      
      // 選択されたデータのコメントを設定
      currentComment = selectedData.comment || '';
      updateCommentDisplay();
      
      console.log('選択データの位置でボックスを表示:', {x1, y1, x2, y2});
    } else {
      // デフォルト位置
      boxEl.style.top = '10px';
      boxEl.style.left = '10px';
    }
    
    boxEl.style.display = 'block';
    boxEl.style.position = 'absolute';
  });

  let isMoving = false;
  let isResizing = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;
  let initialWidth = 0;
  let initialHeight = 0;
  const MIN_SIZE = 30;
  const MAX_SIZE = 2000;

  // グローバルなマウスイベント（ボックスの再生成に関係なく動作）
  document.addEventListener('mouseup', () => {
    isMoving = false;
    isResizing = false;
    const currentBox = document.getElementById('resizableBox');
    if (currentBox) {
      currentBox.style.cursor = 'default';
    }
  });

  document.addEventListener('mousemove', (e) => {
    const currentBox = document.getElementById('resizableBox');
    if (!currentBox) return;
    
    if (isMoving) {
      currentBox.style.left = `${e.clientX - offsetX}px`;
      currentBox.style.top = `${e.clientY - offsetY}px`;
    } else if (isResizing) {
      e.preventDefault();
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const newWidth = Math.max(MIN_SIZE, Math.min(MAX_SIZE, initialWidth + deltaX));
      const newHeight = Math.max(MIN_SIZE, Math.min(MAX_SIZE, initialHeight + deltaY));
      currentBox.style.width = `${newWidth}px`;
      currentBox.style.height = `${newHeight}px`;
    }
  });

  // 初期ボックスにもイベントを設定（存在する場合）
  if (box && handle) {
    setupBoxEvents(box, handle);
  }

  function switchStream(newSrc) {
    // 既存のストリームを停止してから新しいストリームに切り替え
    const existingStream = document.getElementById('cameraStream');
    if (existingStream) {
      existingStream.src = '';
    }
    cameraContainer.innerHTML = `<img id="cameraStream" src="${newSrc}">`;
    console.log('原点設定画面: カメラストリームを切り替えました:', newSrc);
  }

  if (colorBtn) {
    colorBtn.addEventListener('click', () => {
      switchStream('/detection/stream/rgb');
    });
  }

  if (depthBtn) {
    depthBtn.addEventListener('click', () => {
      switchStream('/detection/stream/depth');
    });
  }
  
  // ページ読み込み時にデフォルトでRGBストリームを開始
  console.log('原点設定画面: カメラストリームを初期化します');
  switchStream('/detection/stream/rgb');

  if (originBtn) {
    originBtn.addEventListener('click', () => {
        const img = document.getElementById('cameraStream');
        const box = document.getElementById('resizableBox');

        if (!img || !box || box.style.display === 'none') {
            alert('編集ボタンを押して選択枠を表示し、カメラ映像が読み込まれていることを確認してください。');
            return;
        }

        // 1. 画像のロード完了チェック (前回の回答で省略されていたが重要)
        if (!(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)) {
            alert('画像の読み込み中です。少し待ってから再度お試しください。');
            return;
        }

        const boxRect = box.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();

        // 2. 選択範囲のクリッピングと画像への相対座標変換
        
        // 選択ボックスと画像表示領域の共通部分 (ビューポート座標)
        const selLeft = Math.max(boxRect.left, imgRect.left);
        const selTop = Math.max(boxRect.top, imgRect.top);
        const selRight = Math.min(boxRect.right, imgRect.right);
        const selBottom = Math.min(boxRect.bottom, imgRect.bottom);

        if (selRight <= selLeft || selBottom <= selTop) {
            alert('選択範囲が画像外です');
            return;
        }

        // 3. スケールファクタの計算 (表示サイズ -> 実際のピクセルサイズ)
        // デフォルトの解像度 640x480 に対応
        const naturalWidth = img.naturalWidth; // 640
        const naturalHeight = img.naturalHeight; // 480

        const scaleX = naturalWidth / imgRect.width;
        const scaleY = naturalHeight / imgRect.height;

        // 4. 画像ピクセル座標の計算 (左上、右上、右下、左下)
        // 座標 = (ビューポート座標 - 画像の左上座標) * スケールファクタ
        const x1 = (selLeft   - imgRect.left) * scaleX;
        const y1 = (selTop    - imgRect.top)  * scaleY;
        
        const x2 = (selRight  - imgRect.left) * scaleX;
        const y2 = (selTop    - imgRect.top)  * scaleY; // y2はy1と同じ

        const x3 = (selRight  - imgRect.left) * scaleX;
        const y3 = (selBottom - imgRect.top)  * scaleY;
        
        const x4 = (selLeft   - imgRect.left) * scaleX;
        const y4 = (selBottom - imgRect.top)  * scaleY; // x4はx1と同じ

        const points = [
            [Math.round(x1), Math.round(y1)],
            [Math.round(x2), Math.round(y2)],
            [Math.round(x3), Math.round(y3)],
            [Math.round(x4), Math.round(y4)]
        ];
        
        console.log("変換後のピクセル座標:", points); // 確認用

        // 左右反転した映像の座標を実際のカメラ座標に変換
        const convertedPoints = convertPointsForCamera(points);
        console.log("カメラ座標に変換:", convertedPoints); // 確認用

        // 5. データの準備と送信
        const originData = {
            origin_No: getMaxNumber(),
            point: convertedPoints,  // 変換された座標を使用
            comment: currentComment, // 現在のコメントを追加
            depth: [0, 0] // depthはバックエンドで計算・上書きされる
        };

        fetch('/detection/register_origin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(originData)
        })
        .then(response => response.json())
        .then(data => alert('原点登録完了: ' + JSON.stringify(data)))
        .catch(error => console.error('登録エラー:', error));
    });
  }

});