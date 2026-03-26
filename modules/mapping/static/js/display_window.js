/**
 * ディスプレイウィンドウ用スクリプト
 * 部品棚・作業台に表示される画像を管理
 */

var CURRENT_GROUP_KEY = 'currentGroupId';
var SELECTED_ELEMENT_KEY = 'selectedElementId';
var MAPPING_SYNC_KEY = 'mappingLastUpdate';
var FLOW_DESIGNER_ACTIVE_KEY = 'flowDesignerActive';
var MAPPING_DEBUG_ENDPOINT = '/mapping/api/debug-log';

class DisplayWindow {
    constructor() {
        this.displayTarget = window.DISPLAY_TARGET;
        this.canvas = document.getElementById('display-canvas');
        this.currentGroupId = null;
        this.elements = [];
        this.selectedElement = null;
        this.selectedElementId = null;
        this.isDragging = false;
        this.isResizing = false;
        this.resizeCorner = null; // 'nw', 'ne', 'sw', 'se'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.elementStartX = 0;
        this.elementStartY = 0;
        this.elementStartWidth = 0;
        this.elementStartHeight = 0;
        this.lastElementsSignature = null;
        this.pollTimer = null;
        this.lastFetchInfo = null;
        this.lastFetchError = null;
        
        // 図形描画モード
        this.shapeDrawer = null;
        
        this.init();
    }
    
    init() {
        console.log(`DisplayWindow initialized for: ${this.displayTarget}`);
        
        // イベントリスナーを設定
        this.setupEventListeners();
        
        // 図形描画モードを初期化
        if (typeof ShapeDrawingMode !== 'undefined') {
            this.shapeDrawer = new ShapeDrawingMode(this);
            console.log('ShapeDrawingMode initialized');
        }
        
        // 初期状態を同期
        this.syncSelectionState();
        this.fetchElements(true).catch((error) => {
            console.error('Initial element fetch failed:', error);
            this.lastFetchError = String(error);
            this.debugLog('init-fetch-error', { error: this.lastFetchError });
        });
        
        // ポーリング開始
        this.startPolling();
        
        // 情報パネルの切り替えボタン
        const toggleInfoBtn = document.getElementById('toggle-info-btn');
        if (toggleInfoBtn) {
            toggleInfoBtn.addEventListener('click', (evt) => {
                const panel = document.getElementById('info-panel');
                if (!panel) {
                    return;
                }
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    evt.target.textContent = '情報パネルを隠す';
                } else {
                    panel.style.display = 'none';
                    evt.target.textContent = '情報パネルを表示';
                }
            });
        }
    }
    
    setupEventListeners() {
        // 別ウィンドウからのstorageイベントをリッスン
        window.addEventListener('storage', (event) => this.handleStorageEvent(event));
        
        // 同じドメイン内での変更を検知するため、定期的にlocalStorageをチェック
        this.startPolling();

        if (!this.canvas) {
            console.error('Display canvas element not found.');
            return;
        }
        // マウスダウン
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        
        // マウス移動
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // マウスアップ
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // コンテキストメニュー無効化（右クリックでの選択解除用）
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.selectedElement = null;
            this.updateSelectedElement();
        });
        
        // キャンバス自体のドラッグを防止
        this.canvas.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        // キャンバス全体でホイールイベントのデフォルト動作を防止
        // （プレビュー画像のホイールイベントが確実に動作するように）
        this.canvas.addEventListener('wheel', (e) => {
            // プレビュー画像でない場合のみデフォルト動作を防止
            if (!e.target.classList.contains('preview-image')) {
                e.preventDefault();
            }
        }, { passive: false });

        // Alt+Shift+D で現在の状態をコンソール出力
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.shiftKey && e.code === 'KeyD') {
                this.logCurrentState();
            }
        });
    }

    handleStorageEvent(event) {
        if (!event) return;
        if (event.key === CURRENT_GROUP_KEY) {
            this.currentGroupId = event.newValue || null;
            this.fetchElements(true);
        } else if (event.key === SELECTED_ELEMENT_KEY) {
            const parsed = parseInt(event.newValue, 10);
            this.selectedElementId = Number.isNaN(parsed) ? null : parsed;
            this.highlightSelectedElement();
        } else if (event.key === MAPPING_SYNC_KEY) {
            this.fetchElements(true);
        } else if (event.key === 'flowExecutionGroup' || event.key === 'previewElement' || event.key === 'flowExecuting') {
            this.fetchElements(true);
        }
    }

    syncSelectionState() {
        const params = new URLSearchParams(window.location.search);
        const groupIdFromQuery = params.get('group_id');
        const storedGroupId = localStorage.getItem(CURRENT_GROUP_KEY);
        this.currentGroupId = groupIdFromQuery || storedGroupId || null;
        if (this.currentGroupId) {
            const groupLabel = document.getElementById('current-group');
            if (groupLabel) {
                groupLabel.textContent = this.currentGroupId;
            }
        }

        const storedSelectedId = parseInt(localStorage.getItem(SELECTED_ELEMENT_KEY), 10);
        this.selectedElementId = Number.isNaN(storedSelectedId) ? null : storedSelectedId;
    }

    highlightSelectedElement() {
        if (!this.canvas) return;
        if (this.selectedElementId) {
            const element = this.canvas.querySelector(
                `.display-image[data-element-id="${this.selectedElementId}"]`
            );
            this.selectedElement = element || null;
        } else {
            this.selectedElement = null;
        }
        this.updateSelectedElement();
    }

    signalUpdate() {
        try {
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
        } catch (error) {
            console.warn('Failed to broadcast mapping update:', error);
        }
    }
    
    handleMouseDown(e) {
        // リサイズハンドルをクリックした場合
        if (e.target.classList.contains('resize-handle')) {
            e.preventDefault();
            e.stopPropagation();
            this.resizeCorner = e.target.dataset.corner;
            this.isResizing = true;
            this.isDragging = false;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.elementStartX = parseInt(this.selectedElement.style.left) || 0;
            this.elementStartY = parseInt(this.selectedElement.style.top) || 0;
            this.elementStartWidth = parseInt(this.selectedElement.style.width) || 100;
            this.elementStartHeight = parseInt(this.selectedElement.style.height) || 100;
            return;
        }
        
        const clickedElement = e.target.closest('.display-image');
        
        if (!clickedElement) {
            this.selectedElement = null;
            this.updateSelectedElement();
            return;
        }
        
        // 画像要素のドラッグを防止
        e.preventDefault();
        e.stopPropagation();
        
        // 要素を選択
        this.selectedElement = clickedElement;
        const elementIdValue = parseInt(clickedElement.dataset.elementId, 10);
        this.selectedElementId = Number.isNaN(elementIdValue) ? null : elementIdValue;
        if (this.selectedElementId) {
            try {
                localStorage.setItem(SELECTED_ELEMENT_KEY, String(this.selectedElementId));
            } catch (error) {
                console.warn('Failed to persist selected element id:', error);
            }
        }
        this.updateSelectedElement();
        
        // ドラッグ開始
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.elementStartX = parseInt(clickedElement.style.left) || 0;
        this.elementStartY = parseInt(clickedElement.style.top) || 0;
        this.elementStartWidth = parseInt(clickedElement.style.width) || 100;
        this.elementStartHeight = parseInt(clickedElement.style.height) || 100;
        
        clickedElement.classList.add('dragging');
    }
    
    handleMouseMove(e) {
        if (!this.selectedElement) return;
        
        if (this.isDragging) {
            // ドラッグ移動
            e.preventDefault();
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            
            const newX = this.elementStartX + dx;
            const newY = this.elementStartY + dy;
            
            this.selectedElement.style.left = `${newX}px`;
            this.selectedElement.style.top = `${newY}px`;
            
            this.updateResizeHandles();
            
        } else if (this.isResizing) {
            // 8方向からのリサイズ（任意変形）
            e.preventDefault();
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            
            let newX = this.elementStartX;
            let newY = this.elementStartY;
            let newWidth = this.elementStartWidth;
            let newHeight = this.elementStartHeight;
            
            switch (this.resizeCorner) {
                case 'nw': // 左上
                    newX = this.elementStartX + dx;
                    newY = this.elementStartY + dy;
                    newWidth = Math.max(20, this.elementStartWidth - dx);
                    newHeight = Math.max(20, this.elementStartHeight - dy);
                    break;
                case 'n': // 上辺中央
                    newY = this.elementStartY + dy;
                    newHeight = Math.max(20, this.elementStartHeight - dy);
                    break;
                case 'ne': // 右上
                    newY = this.elementStartY + dy;
                    newWidth = Math.max(20, this.elementStartWidth + dx);
                    newHeight = Math.max(20, this.elementStartHeight - dy);
                    break;
                case 'e': // 右辺中央
                    newWidth = Math.max(20, this.elementStartWidth + dx);
                    break;
                case 'se': // 右下
                    newWidth = Math.max(20, this.elementStartWidth + dx);
                    newHeight = Math.max(20, this.elementStartHeight + dy);
                    break;
                case 's': // 下辺中央
                    newHeight = Math.max(20, this.elementStartHeight + dy);
                    break;
                case 'sw': // 左下
                    newX = this.elementStartX + dx;
                    newWidth = Math.max(20, this.elementStartWidth - dx);
                    newHeight = Math.max(20, this.elementStartHeight + dy);
                    break;
                case 'w': // 左辺中央
                    newX = this.elementStartX + dx;
                    newWidth = Math.max(20, this.elementStartWidth - dx);
                    break;
            }
            
            this.selectedElement.style.left = `${newX}px`;
            this.selectedElement.style.top = `${newY}px`;
            this.selectedElement.style.width = `${newWidth}px`;
            this.selectedElement.style.height = `${newHeight}px`;
            
            this.updateResizeHandles();
        }
    }
    
    async handleMouseUp(e) {
        if (this.isDragging || this.isResizing) {
            // 位置とサイズをDBに保存
            await this.saveElementPosition(this.selectedElement);
            
            this.selectedElement.classList.remove('dragging');
        }
        
        this.isDragging = false;
        this.isResizing = false;
    }
    
    async saveElementPosition(element) {
        if (!element) return;
        
        const elementId = element.dataset.elementId;
        const x = parseInt(element.style.left) || 0;
        const y = parseInt(element.style.top) || 0;
        const currentWidth = parseInt(element.style.width) || 100;
        const currentHeight = parseInt(element.style.height) || 100;
        
        // 元の画像サイズを取得してスケールを計算
        const originalWidth = parseInt(element.dataset.originalWidth) || currentWidth;
        const originalHeight = parseInt(element.dataset.originalHeight) || currentHeight;
        const scale = currentWidth / originalWidth;
        
        try {
            const response = await fetch(`/mapping/api/elements/${elementId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y, scale })
            });
            
            if (response.ok) {
                console.log(`Element ${elementId} updated: (${x}, ${y}), scale: ${scale.toFixed(2)}`);
                this.signalUpdate();
            }
        } catch (error) {
            console.error('Failed to save element position:', error);
        }
    }
    
    updateResizeHandles() {
        if (!this.selectedElement) return;
        
        const rect = this.selectedElement.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const handles = document.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            const position = handle.dataset.corner;
            const size = 12;
            const halfSize = size / 2;
            
            const centerX = (rect.left + rect.right) / 2 - canvasRect.left;
            const centerY = (rect.top + rect.bottom) / 2 - canvasRect.top;
            const left = rect.left - canvasRect.left;
            const right = rect.right - canvasRect.left;
            const top = rect.top - canvasRect.top;
            const bottom = rect.bottom - canvasRect.top;
            
            switch (position) {
                case 'nw': // 左上
                    handle.style.left = `${left - halfSize}px`;
                    handle.style.top = `${top - halfSize}px`;
                    break;
                case 'n': // 上辺中央
                    handle.style.left = `${centerX - halfSize}px`;
                    handle.style.top = `${top - halfSize}px`;
                    break;
                case 'ne': // 右上
                    handle.style.left = `${right - halfSize}px`;
                    handle.style.top = `${top - halfSize}px`;
                    break;
                case 'e': // 右辺中央
                    handle.style.left = `${right - halfSize}px`;
                    handle.style.top = `${centerY - halfSize}px`;
                    break;
                case 'se': // 右下
                    handle.style.left = `${right - halfSize}px`;
                    handle.style.top = `${bottom - halfSize}px`;
                    break;
                case 's': // 下辺中央
                    handle.style.left = `${centerX - halfSize}px`;
                    handle.style.top = `${bottom - halfSize}px`;
                    break;
                case 'sw': // 左下
                    handle.style.left = `${left - halfSize}px`;
                    handle.style.top = `${bottom - halfSize}px`;
                    break;
                case 'w': // 左辺中央
                    handle.style.left = `${left - halfSize}px`;
                    handle.style.top = `${centerY - halfSize}px`;
                    break;
            }
        });
    }
    
    updateSelectedElement() {
        // 選択状態を更新
        document.querySelectorAll('.display-image').forEach(img => {
            img.classList.remove('selected');
        });
        
        // 既存のリサイズハンドルを削除
        document.querySelectorAll('.resize-handle').forEach(h => h.remove());
        
        const selectedLabel = document.getElementById('selected-element');

        if (this.selectedElement) {
            this.selectedElement.classList.add('selected');
            const elementId = this.selectedElement.dataset.elementId;
            if (selectedLabel) {
                selectedLabel.textContent = `ID: ${elementId}`;
            }
            
            // リサイズハンドルを作成
            this.createResizeHandles();
        } else {
            if (selectedLabel) {
                selectedLabel.textContent = 'なし';
            }
        }
    }
    
    createResizeHandles() {
        if (!this.selectedElement) return;
        
        // 四隅 + 四辺中央の8つのハンドル
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        
        handles.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            handle.dataset.corner = position;
            this.canvas.appendChild(handle);
        });
        
        this.updateResizeHandles();
    }
    
    startPolling() {
        // 0.5秒ごとに要素を更新
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
        this.pollTimer = setInterval(() => {
            this.fetchElements();
        }, 500);
    }

    async fetchElements(force = false) {
        try {
            // 表示条件をチェック
            // 1. 描画・音メニューがアクティブでグループ選択中
            // 2. フロー投影ブロックで選択中 (blocklyPreviewGroup)
            // 3. フロー実行中 (flowExecutionGroup)

            const mappingPageActive = localStorage.getItem('mappingPageActive') === 'true';
            const flowDesignerActive = localStorage.getItem(FLOW_DESIGNER_ACTIVE_KEY) === 'true';
            const currentGroupId = localStorage.getItem(CURRENT_GROUP_KEY);
            const flowExecuting = localStorage.getItem('flowExecuting') === 'true';
            let executionGroupId = localStorage.getItem('flowExecutionGroup');
            const blocklyPreviewGroup = flowDesignerActive ? localStorage.getItem('blocklyPreviewGroup') : null;

            // フローステータスから直接シグナルを取得（flowExecutionGroup がセットされていない場合のフォールバック）
            let groupId = null;
            let source = null;

            const flowSignal = await this.fetchFlowExecutionSignal();
            if (flowSignal) {
                if (flowSignal.groupId) {
                    executionGroupId = String(flowSignal.groupId);
                    source = flowSignal.isRunning ? 'flow-status' : 'flow-status-idle';
                    if (localStorage.getItem('flowExecutionGroup') !== executionGroupId) {
                        localStorage.setItem('flowExecutionGroup', executionGroupId);
                    }
                    if (flowSignal.previewElement) {
                        try {
                            localStorage.setItem('previewElement', JSON.stringify(flowSignal.previewElement));
                        } catch (previewError) {
                            console.warn('[Display] Failed to store previewElement from flow signal:', previewError);
                        }
                    }
                } else if (flowSignal.shouldClear) {
                    if (localStorage.getItem('flowExecutionGroup')) {
                        localStorage.removeItem('flowExecutionGroup');
                    }
                    localStorage.removeItem('previewElement');
                    executionGroupId = null;
                }
            }

            if (executionGroupId) {
                groupId = executionGroupId;
                source = flowExecuting ? 'flow' : 'flow-persisted';
                console.log('[Display] フロー実行中のグループを表示:', { groupId, flowExecuting });
            } else if (flowDesignerActive && blocklyPreviewGroup) {
                groupId = blocklyPreviewGroup;
                source = 'blockly';
            } else if (mappingPageActive && currentGroupId) {
                groupId = currentGroupId;
                source = 'mapping';
            } else {
                if (localStorage.getItem('blocklyPreviewGroup')) {
                    localStorage.removeItem('blocklyPreviewGroup');
                    localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                }
                const idleInfo = {
                    mappingPageActive,
                    currentGroupId,
                    flowDesignerActive,
                    flowExecuting,
                    executionGroupId
                };
                console.log('[Display] 表示条件なし', idleInfo);
                this.debugLog('no-group', idleInfo);
            }

            if (!groupId) {
                if (this.elements.length > 0 || this.currentGroupId !== null) {
                    console.log('[Display] 表示条件を満たさないためキャンバスをクリア');
                    this.clearCanvas();
                }
                this.currentGroupId = null;
                this.lastFetchInfo = null;
                return;
            }
            
            // グループIDが変わった場合
            if (this.currentGroupId !== groupId) {
                this.currentGroupId = groupId;
                const groupLabel = document.getElementById('current-group');
                if (groupLabel) {
                    groupLabel.textContent = groupId;
                }
                if (source) {
                    console.log('[Display] 投影ソース:', source, 'groupId:', groupId);
                }
            }
            
            const response = await fetch(
                `/mapping/api/display/elements/${this.displayTarget}?group_id=${groupId}`
            );
            
            if (!response.ok) {
                console.error('Failed to fetch elements');
                this.lastFetchError = `HTTP ${response.status}`;
                this.debugLog('fetch-error', {
                    status: response.status,
                    statusText: response.statusText,
                    groupId,
                    source
                });
                return;
            }
            
            const elements = await response.json();
            const signature = JSON.stringify(elements);

            // 要素が変更された場合のみ再描画
            if (force || signature !== this.lastElementsSignature) {
                this.lastElementsSignature = signature;
                this.elements = elements;
                this.renderElements();
            }

            this.lastFetchInfo = {
                timestamp: new Date().toISOString(),
                groupId,
                source,
                elementCount: Array.isArray(elements) ? elements.length : 0
            };
            this.lastFetchError = null;
            this.debugLog('fetch-success', {
                groupId,
                source,
                elementCount: this.lastFetchInfo.elementCount
            });
            
        } catch (error) {
            console.error('Error fetching elements:', error);
            this.lastFetchError = String(error);
            this.debugLog('fetch-exception', { error: this.lastFetchError });
        }
    }
    
    clearCanvas() {
        this.canvas.innerHTML = '';
        this.elements = [];
        this.selectedElement = null;
        this.selectedElementId = null;
        this.lastElementsSignature = null;
        const countLabel = document.getElementById('element-count');
        if (countLabel) {
            countLabel.textContent = '0';
        }
        const groupLabel = document.getElementById('current-group');
        if (groupLabel) {
            groupLabel.textContent = '未選択';
        }
        this.updateSelectedElement();
    }
    
    renderElements() {
        console.log('=== renderElements 開始 ===');
        console.log(`displayTarget: ${this.displayTarget}`);
        console.log(`要素数: ${this.elements.length}`);
        console.log(`選択中の要素ID: ${this.selectedElementId}`);
        
        const mappingPageActive = localStorage.getItem('mappingPageActive') === 'true';
        const flowExecutionGroup = localStorage.getItem('flowExecutionGroup');
        const storedSelectedId = parseInt(localStorage.getItem(SELECTED_ELEMENT_KEY), 10);
        this.selectedElementId = Number.isNaN(storedSelectedId) ? null : storedSelectedId;

        // 既存の要素をクリア
        this.canvas.innerHTML = '';
        
        // SVGレイヤーも再作成
        const svgLayer = document.getElementById('svg-layer');
        if (svgLayer) {
            svgLayer.innerHTML = '';
        }
        
        this.selectedElement = null;

        const elementsToRender = this.elements;

        console.log(`表示する要素数: ${elementsToRender.length}`);
        
        // 一時プレビュー要素を確認
        const previewData = localStorage.getItem('previewElement');
        console.log('localStorage.previewElement:', previewData);
        let previewElement = null;
        const previewEnabled = mappingPageActive || Boolean(flowExecutionGroup);
        if (previewEnabled && previewData) {
            try {
                previewElement = JSON.parse(previewData);
                // プレビューが現在のdisplay_targetに一致するか確認
                if (previewElement.display_target === this.displayTarget) {
                    console.log('一時プレビューを表示:', previewElement);
                    
                    // シェイププレビューの場合はSVGで描画
                    if (previewElement.type === 'shape' && previewElement.shape_data) {
                        this.renderShapePreview(previewElement);
                    }
                } else {
                    previewElement = null;
                }
            } catch (error) {
                console.error('プレビューデータのパースエラー:', error);
                previewElement = null;
            }
        }

        // DB要素を描画
        elementsToRender.forEach(elem => {
            const img = document.createElement('img');
            
            // 画像パスを構築
            const originalPath = elem.file_path || '';
            if (originalPath) {
                // file_pathが「images/filename.png」形式の場合
                // /mapping/media/images/filename.png として配信される
                img.src = `/mapping/media/${originalPath}`;
                console.log(`Loading image: ${img.src}`);
            } else {
                console.warn(`Element ${elem.id} has no file_path`);
            }
            
            img.className = 'display-image';
            img.dataset.elementId = elem.id;
            const originalWidth = elem.width || elem.image_width || 1;
            const originalHeight = elem.height || elem.image_height || 1;
            img.dataset.originalWidth = originalWidth;
            img.dataset.originalHeight = originalHeight;
            
            // スケールを適用
            const scale = elem.scale || 1.0;
            const displayWidth = originalWidth * scale;
            const displayHeight = originalHeight * scale;
            
            img.style.left = `${elem.x}px`;
            img.style.top = `${elem.y}px`;
            img.style.width = `${displayWidth}px`;
            img.style.height = `${displayHeight}px`;
            
            // 画像読み込みエラー処理
            img.onerror = () => {
                console.error(`Failed to load image: ${img.src}`);
                img.style.border = '2px solid red';
                img.alt = 'Image Load Error';
            };
            
            const elementIdNumber = parseInt(elem.id, 10);
            if (this.selectedElementId && elementIdNumber === this.selectedElementId) {
                this.selectedElement = img;
            }

            this.canvas.appendChild(img);
        });
        
        // 一時プレビュー要素を追加描画
        if (previewElement) {
            const previewImg = document.createElement('img');
            
            if (previewElement.file_path) {
                previewImg.src = `/mapping/media/${previewElement.file_path}`;
                console.log(`Loading preview image: ${previewImg.src}`);
            }
            
            previewImg.className = 'display-image preview-image';
            previewImg.dataset.elementId = 'preview-temp';
            previewImg.dataset.originalWidth = previewElement.width || 200;
            previewImg.dataset.originalHeight = previewElement.height || 200;
            
            const scale = previewElement.scale || 1.0;
            const displayWidth = (previewElement.width || 200) * scale;
            const displayHeight = (previewElement.height || 200) * scale;
            
            previewImg.style.left = `${previewElement.x}px`;
            previewImg.style.top = `${previewElement.y}px`;
            previewImg.style.width = `${displayWidth}px`;
            previewImg.style.height = `${displayHeight}px`;
            previewImg.style.transform = `rotate(${previewElement.rotation || 0}deg)`;
            previewImg.style.opacity = '0.8';
            previewImg.style.border = '3px dashed #FFD700';
            previewImg.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
            previewImg.style.cursor = 'move';
            
            // プレビュー画像のマウス操作イベント
            this.setupPreviewMouseEvents(previewImg, previewElement);
            
            this.canvas.appendChild(previewImg);
        }

        // 要素数を更新
        const countLabel = document.getElementById('element-count');
        if (countLabel) {
            countLabel.textContent = elementsToRender.length;
        }

        // 選択状態を反映
        this.highlightSelectedElement();
    }

    debugLog(event, details = {}) {
        try {
            const payload = Object.assign({}, details, {
                displayTarget: this.displayTarget,
                currentGroupId: this.currentGroupId
            });
            // console.log(`[DisplayDebug:${event}]`, payload);

            try {
                const logBody = JSON.stringify({
                    message: `[DisplayDebug:${event}]`,
                    level: 'info',
                    payload
                });

                if (navigator && typeof navigator.sendBeacon === 'function') {
                    const blob = new Blob([logBody], { type: 'application/json' });
                    navigator.sendBeacon(MAPPING_DEBUG_ENDPOINT, blob);
                } else {
                    fetch(MAPPING_DEBUG_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: logBody,
                        keepalive: true
                    }).catch(() => {});
                }
            } catch (networkError) {
                // ネットワークエラーはサイレントに無視
            }
        } catch (logError) {
            console.warn('Failed to log debug info:', logError);
        }
    }

    logCurrentState() {
        this.debugLog('state-dump', {
            lastFetchInfo: this.lastFetchInfo,
            lastFetchError: this.lastFetchError,
            localStorage: {
                flowExecutionGroup: localStorage.getItem('flowExecutionGroup'),
                flowExecuting: localStorage.getItem('flowExecuting'),
                blocklyPreviewGroup: localStorage.getItem('blocklyPreviewGroup'),
                mappingPageActive: localStorage.getItem('mappingPageActive'),
                currentGroupId: localStorage.getItem('currentGroupId'),
                flowDesignerActive: localStorage.getItem(FLOW_DESIGNER_ACTIVE_KEY)
            }
        });
    }
    
    setupPreviewMouseEvents(previewImg, previewData) {
        let isDragging = false;
        let isRotating = false;
        let startX = 0;
        let startY = 0;
        let startPosX = 0;
        let startPosY = 0;
        let startRotation = 0;
        let centerX = 0;
        let centerY = 0;
        
        // マウスダウン
        previewImg.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.button === 0) {
                // 左クリック: ドラッグ移動
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startPosX = previewData.x;
                startPosY = previewData.y;
                previewImg.style.cursor = 'grabbing';
            } else if (e.button === 2) {
                // 右クリック: 回転
                isRotating = true;
                const rect = previewImg.getBoundingClientRect();
                centerX = rect.left + rect.width / 2;
                centerY = rect.top + rect.height / 2;
                startRotation = previewData.rotation || 0;
                previewImg.style.cursor = 'crosshair';
            }
        });
        
        // マウス移動
        const handleMouseMove = (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                const newX = startPosX + dx;
                const newY = startPosY + dy;
                
                // プレビューデータを更新
                previewData.x = newX;
                previewData.y = newY;
                
                // 画像位置を更新
                previewImg.style.left = `${newX}px`;
                previewImg.style.top = `${newY}px`;
                
                // localStorageに保存
                this.updatePreviewInLocalStorage(previewData);
                
            } else if (isRotating) {
                // マウス位置から角度を計算
                const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
                const newRotation = angle;
                
                // プレビューデータを更新
                previewData.rotation = newRotation;
                
                // 画像回転を更新
                previewImg.style.transform = `rotate(${newRotation}deg)`;
                
                // localStorageに保存
                this.updatePreviewInLocalStorage(previewData);
            }
        };
        
        // マウスアップ
        const handleMouseUp = (e) => {
            if (isDragging || isRotating) {
                isDragging = false;
                isRotating = false;
                previewImg.style.cursor = 'move';
            }
        };
        
        // ホイール: 拡大縮小
        previewImg.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            let newScale = (previewData.scale || 1.0) + delta;
            
            // スケールを0.1〜10の範囲に制限
            newScale = Math.max(0.1, Math.min(10, newScale));
            
            previewData.scale = newScale;
            
            const originalWidth = parseInt(previewImg.dataset.originalWidth) || 200;
            const originalHeight = parseInt(previewImg.dataset.originalHeight) || 200;
            const displayWidth = originalWidth * newScale;
            const displayHeight = originalHeight * newScale;
            
            previewImg.style.width = `${displayWidth}px`;
            previewImg.style.height = `${displayHeight}px`;
            
            console.log('[Display] ホイール拡大縮小:', newScale.toFixed(2));
            
            // localStorageに保存
            this.updatePreviewInLocalStorage(previewData);
        }, { passive: false });
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // 右クリックメニューを無効化
        previewImg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    updatePreviewInLocalStorage(previewData) {
        try {
            // プレビューデータをlocalStorageに保存
            localStorage.setItem('previewElement', JSON.stringify(previewData));
            // 他のディスプレイウィンドウに変更を通知
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
            
            console.log('[Display] プレビュー更新:', {
                display_target: previewData.display_target,
                x: Math.round(previewData.x),
                y: Math.round(previewData.y),
                scale: previewData.scale.toFixed(2),
                rotation: Math.round(previewData.rotation || 0)
            });
        } catch (error) {
            console.error('[Display] プレビュー更新エラー:', error);
        }
    }

    async fetchFlowExecutionSignal() {
        try {
            const response = await fetch('/flow/api/flows/default/status', { cache: 'no-store' });
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            if (!data || !data.success) {
                return null;
            }
            const status = data.status || {};
            const isRunning = Boolean(status.is_running);
            try {
                localStorage.setItem('flowExecuting', isRunning ? 'true' : 'false');
            } catch (storageError) {
                console.warn('[Display] Failed to update flowExecuting flag:', storageError);
            }
            const projectionState = status.projection_state || null;
            const stepData = status.current_step_data;

            if (!stepData) {
                const storedGroup = (() => {
                    try {
                        return localStorage.getItem('flowExecutionGroup');
                    } catch (storageError) {
                        console.warn('[Display] Failed to read flowExecutionGroup:', storageError);
                        return null;
                    }
                })();

                if (!isRunning) {
                    if (storedGroup || (projectionState && projectionState.group_id)) {
                        return {
                            groupId: null,
                            previewElement: null,
                            shouldClear: true,
                            isRunning
                        };
                    }
                    return null;
                }

                if (projectionState && projectionState.group_id) {
                    return {
                        groupId: projectionState.group_id,
                        previewElement: projectionState.preview || null,
                        isRunning
                    };
                }

                return null;
            }

            const step = stepData.step || {};
            const result = stepData.result || {};
            const resultData = result.data || null;

            if (step.module === 'mapping') {
                if (step.action === 'show_group') {
                    const groupId = (resultData && resultData.group_id) || (step.parameters && step.parameters.group_id);
                    if (!groupId) {
                        return null;
                    }
                    let previewElement = null;
                    if (resultData && resultData.preview) {
                        previewElement = Object.assign({}, resultData.preview);
                    } else if (projectionState && projectionState.preview) {
                        previewElement = Object.assign({}, projectionState.preview);
                    }
                    if (!previewElement) {
                        previewElement = projectionState && projectionState.preview ? Object.assign({}, projectionState.preview) : null;
                    }
                    if (previewElement) {
                        if (!previewElement.group_id) {
                            previewElement.group_id = groupId;
                        }
                        if (!previewElement.display_target) {
                            previewElement.display_target = (resultData && resultData.display_target) || step.display_target || (step.parameters && step.parameters.display_target) || (projectionState && projectionState.display_target) || 'monitor';
                        }
                    }
                    return {
                        groupId,
                        previewElement,
                        isRunning
                    };
                }

                if (step.action === 'hide_group') {
                    return {
                        groupId: null,
                        previewElement: null,
                        shouldClear: true
                    };
                }
            }

            if (projectionState && projectionState.group_id && isRunning) {
                const fallbackPreview = projectionState.preview ? Object.assign({}, projectionState.preview) : null;
                return {
                    groupId: projectionState.group_id,
                    previewElement: fallbackPreview,
                    isRunning
                };
            }

            return null;
        } catch (error) {
            console.warn('[Display] Failed to fetch flow execution signal:', error);
            return null;
        }
    }

    /**
     * シェイププレビューをSVGで描画
     */
    renderShapePreview(previewData) {
        const svgLayer = document.getElementById('svg-layer');
        if (!svgLayer) return;

        const shapeData = previewData.shape_data;
        if (!shapeData) return;

        const strokeColor = previewData.stroke_color || '#000000';
        const fillColor = previewData.fill_color || '#FFFFFF';
        const strokeWidth = previewData.stroke_width || 2;

        console.log('[RenderShapePreview] シェイプ描画:', shapeData);

        if (shapeData.type === 'rectangle') {
            const [x, y] = shapeData.top_left;
            const { width, height } = shapeData;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('stroke', strokeColor);
            rect.setAttribute('stroke-width', strokeWidth);
            rect.setAttribute('fill', fillColor);
            rect.setAttribute('opacity', '0.7');
            rect.setAttribute('class', 'shape-preview');

            svgLayer.appendChild(rect);

            // 制御ハンドルを追加
            this.addShapeControlHandles(svgLayer, shapeData, 'rectangle', previewData);

        } else if (shapeData.type === 'polygon') {
            const pointsStr = shapeData.points.map(p => `${p[0]},${p[1]}`).join(' ');

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('stroke', strokeColor);
            polygon.setAttribute('stroke-width', strokeWidth);
            polygon.setAttribute('fill', fillColor);
            polygon.setAttribute('opacity', '0.7');
            polygon.setAttribute('class', 'shape-preview');

            svgLayer.appendChild(polygon);

            // 制御点を追加
            shapeData.points.forEach((point, index) => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', point[0]);
                circle.setAttribute('cy', point[1]);
                circle.setAttribute('r', '5');
                circle.setAttribute('fill', strokeColor);
                circle.setAttribute('class', 'control-point');
                circle.setAttribute('data-index', index);
                circle.style.cursor = 'move';

                // ドラッグ可能に
                circle.addEventListener('mousedown', (e) => {
                    this.startPolygonPointDrag(e, index, shapeData, previewData);
                });

                svgLayer.appendChild(circle);
            });

            // 右クリックで頂点追加
            svgLayer.addEventListener('contextmenu', (e) => {
                if (previewData.shapeType === 'polygon') {
                    e.preventDefault();
                    this.addPolygonPoint(e, shapeData, previewData);
                }
            });

        } else if (shapeData.type === 'circle') {
            const [cx, cy] = shapeData.center;
            const { radius } = shapeData;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', radius);
            circle.setAttribute('stroke', strokeColor);
            circle.setAttribute('stroke-width', strokeWidth);
            circle.setAttribute('fill', fillColor);
            circle.setAttribute('opacity', '0.7');
            circle.setAttribute('class', 'shape-preview');

            svgLayer.appendChild(circle);
        } else if (shapeData.type === 'triangle') {
            const pointsStr = shapeData.points.map(p => `${p[0]},${p[1]}`).join(' ');

            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', pointsStr);
            polygon.setAttribute('stroke', strokeColor);
            polygon.setAttribute('stroke-width', strokeWidth);
            polygon.setAttribute('fill', fillColor);
            polygon.setAttribute('opacity', '0.7');
            polygon.setAttribute('class', 'shape-preview');

            svgLayer.appendChild(polygon);
        }
    }

    /**
     * 図形の制御ハンドルを追加
     */
    addShapeControlHandles(svgLayer, shapeData, shapeType, previewData) {
        if (shapeType === 'rectangle') {
            const [x, y] = shapeData.top_left;
            const { width, height } = shapeData;

            // 4隅のハンドル
            const corners = [
                { x: x, y: y, corner: 'nw' },
                { x: x + width, y: y, corner: 'ne' },
                { x: x + width, y: y + height, corner: 'se' },
                { x: x, y: y + height, corner: 'sw' }
            ];

            corners.forEach(({ x: hx, y: hy, corner }) => {
                const handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                handle.setAttribute('x', hx - 5);
                handle.setAttribute('y', hy - 5);
                handle.setAttribute('width', '10');
                handle.setAttribute('height', '10');
                handle.setAttribute('fill', '#007BFF');
                handle.setAttribute('stroke', '#FFFFFF');
                handle.setAttribute('stroke-width', '1');
                handle.setAttribute('class', 'control-handle');
                handle.setAttribute('data-corner', corner);
                handle.style.cursor = 'pointer';

                svgLayer.appendChild(handle);
            });
        }
    }

    /**
     * 多角形の頂点ドラッグ開始
     */
    startPolygonPointDrag(e, index, shapeData, previewData) {
        const svgLayer = document.getElementById('svg-layer');
        const rect = svgLayer.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        const handleMouseMove = (moveEvent) => {
            const x = moveEvent.clientX - rect.left;
            const y = moveEvent.clientY - rect.top;

            shapeData.points[index] = [x, y];
            previewData.shape_data = shapeData;

            localStorage.setItem('previewElement', JSON.stringify(previewData));
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());

            // 再描画
            this.renderShapePreview(previewData);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    /**
     * 多角形に頂点を追加
     */
    addPolygonPoint(e, shapeData, previewData) {
        e.preventDefault();

        const svgLayer = document.getElementById('svg-layer');
        const rect = svgLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        shapeData.points.push([x, y]);
        previewData.shape_data = shapeData;

        localStorage.setItem('previewElement', JSON.stringify(previewData));
        localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());

        console.log('[AddPolygonPoint] 頂点追加:', [x, y], '新しい頂点数:', shapeData.points.length);

        // 再描画
        this.renderShapePreview(previewData);
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    window.displayWindow = new DisplayWindow();
});
