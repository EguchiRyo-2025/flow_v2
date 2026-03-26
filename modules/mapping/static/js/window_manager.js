/**
 * WindowManager - コンポーネントのレンダリングとタブ管理を行うクラス
 */
var SELECTED_ELEMENT_KEY = 'selectedElementId';
var CURRENT_GROUP_KEY = 'currentGroupId';
var MAPPING_SYNC_KEY = 'mappingLastUpdate';

class WindowManager {
    constructor() {
        this.currentTab = 'visual';
        this.componentCache = {};
        this.init();
    }

    /**
     * 初期化処理
     */
    init() {
        this.setupTabs();
        this.loadComponent(this.currentTab);
    }

    /**
     * タブの設定
     */
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.target.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    }

    /**
     * タブの切り替え
     * @param {string} tabName - 切り替え先のタブ名 (figure, sound, media)
     */
    switchTab(tabName) {
        // すべてのタブボタンから active クラスを削除
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // クリックされたタブボタンに active クラスを追加
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // 現在のタブを更新
        this.currentTab = tabName;

        // コンポーネントをロード
        this.loadComponent(tabName);
    }

    /**
     * コンポーネントのロード
     * @param {string} componentName - コンポーネント名 (figure, sound, media)
     */
    async loadComponent(componentName) {
        const tabContent = document.querySelector('.tab-content');
        
        if (!tabContent) {
            console.error('tab-content要素が見つかりません');
            return;
        }

        // ローディング表示
        tabContent.innerHTML = '<div class="loading">読み込み中...</div>';

        try {
            // キャッシュがあればそれを使用
            if (this.componentCache[componentName]) {
                this.renderComponent(componentName, this.componentCache[componentName]);
                return;
            }

            // コンポーネントのHTMLを取得
            const componentHtml = await this.fetchComponent(componentName);
            
            // キャッシュに保存
            this.componentCache[componentName] = componentHtml;
            
            // レンダリング
            this.renderComponent(componentName, componentHtml);
            
        } catch (error) {
            console.error(`コンポーネントのロードに失敗しました: ${componentName}`, error);
            tabContent.innerHTML = `
                <div class="error-message">
                    <p>コンポーネントの読み込みに失敗しました。</p>
                    <p class="error-detail">${error.message}</p>
                </div>
            `;
        }
    }

    /**
     * コンポーネントのHTMLを取得
     * @param {string} componentName - コンポーネント名
     * @returns {Promise<string>} コンポーネントのHTML
     */
    async fetchComponent(componentName) {
        const componentMap = {
            'visual': 'visual_component.html',
            'figure': 'figure_component.html',
            'sound': 'sound_component.html',
            'media': 'media_component.html'
        };

        const fileName = componentMap[componentName];
        if (!fileName) {
            throw new Error(`未知のコンポーネント: ${componentName}`);
        }

        const url = `/mapping/components/${fileName}`;
        console.log(`[コンポーネント取得] URL: ${url}`);
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`[コンポーネント取得エラー] ステータス: ${response.status}, ボディ:`, errorBody);
                throw new Error(`HTTPエラー: ${response.status} - ${errorBody}`);
            }

            const html = await response.text();
            console.log(`[コンポーネント取得成功] ${fileName}`);
            return html;
        } catch (error) {
            console.error(`[コンポーネント取得失敗] ${componentName}:`, error);
            throw error;
        }
    }

    /**
     * コンポーネントをレンダリング
     * @param {string} componentName - コンポーネント名
     * @param {string} html - レンダリングするHTML
     */
    renderComponent(componentName, html) {
        const tabContent = document.querySelector('.tab-content');
        
        // フェードアウト
        tabContent.style.opacity = '0';
        
        setTimeout(() => {
            // HTMLを挿入
            tabContent.innerHTML = html;
            
            // コンポーネント固有の初期化処理を実行
            this.initializeComponent(componentName);
            
            // フェードイン
            tabContent.style.opacity = '1';
        }, 150);
    }

    /**
     * コンポーネント固有の初期化処理
     * @param {string} componentName - コンポーネント名
     */
    initializeComponent(componentName) {
        switch(componentName) {
            case 'visual':
                this.initializeVisualComponent();
                break;
            case 'figure':
                this.initializeFigureComponent();
                break;
            case 'sound':
                this.initializeSoundComponent();
                break;
            case 'media':
                this.initializeMediaComponent();
                break;
        }
    }

    /**
     * 図形コンポーネントの初期化
     */
    initializeFigureComponent() {
        let figureCounter = 0; // 図形番号カウンター
        let currentFigureState = 'on'; // 現在選択されている状態（on/off）

        // 図形状態タブの切り替え
        const figureTabs = document.querySelectorAll('.figure-tab');
        figureTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const state = tab.getAttribute('data-state');
                currentFigureState = state;
                
                // タブの active クラスを切り替え
                figureTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // テーブルコンテナの表示を切り替え
                document.getElementById('on-figure-container').classList.toggle('hidden', state !== 'on');
                document.getElementById('off-figure-container').classList.toggle('hidden', state !== 'off');
            });
        });

        // カーソル移動: X座標移動ボタン
        const xMinusBtn = document.getElementById('x-minus');
        const xPlusBtn = document.getElementById('x-plus');
        const xValueInput = document.getElementById('x-value');
        
        if (xMinusBtn && xValueInput) {
            xMinusBtn.addEventListener('click', () => {
                const currentValue = parseInt(xValueInput.value) || 0;
                xValueInput.value = currentValue - 10;
            });
        }
        
        if (xPlusBtn && xValueInput) {
            xPlusBtn.addEventListener('click', () => {
                const currentValue = parseInt(xValueInput.value) || 0;
                xValueInput.value = currentValue + 10;
            });
        }

        // カーソル移動: Y座標移動ボタン
        const yMinusBtn = document.getElementById('y-minus');
        const yPlusBtn = document.getElementById('y-plus');
        const yValueInput = document.getElementById('y-value');
        
        if (yMinusBtn && yValueInput) {
            yMinusBtn.addEventListener('click', () => {
                const currentValue = parseInt(yValueInput.value) || 0;
                yValueInput.value = currentValue - 10;
            });
        }
        
        if (yPlusBtn && yValueInput) {
            yPlusBtn.addEventListener('click', () => {
                const currentValue = parseInt(yValueInput.value) || 0;
                yValueInput.value = currentValue + 10;
            });
        }

        // カーソル移動ボタン
        const cursorMoveBtn = document.getElementById('cursor-move');
        if (cursorMoveBtn) {
            cursorMoveBtn.addEventListener('click', async () => {
                const xPos = parseInt(xValueInput?.value) || 0;
                const yPos = parseInt(yValueInput?.value) || 0;
                
                // 表示先を取得（デフォルトは'monitor'）
                const displayTargetSelect = document.getElementById('dest');
                const displayTarget = displayTargetSelect ? displayTargetSelect.value : 'monitor';
                
                console.log(`図形のカーソル移動: X=${xPos}, Y=${yPos}, displayTarget=${displayTarget}`);
                
                try {
                    const response = await fetch('/mapping/api/move_cursor', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            x: xPos,
                            y: yPos,
                            display_target: displayTarget
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('カーソル移動成功:', result);
                        alert(`カーソルを移動しました (${xPos}, ${yPos})`);
                    } else {
                        const error = await response.json();
                        console.error('カーソル移動エラー:', error);
                        alert('カーソルの移動に失敗しました: ' + error.error);
                    }
                } catch (error) {
                    console.error('カーソル移動リクエストエラー:', error);
                    alert('カーソルの移動に失敗しました');
                }
            });
        }

        // 追加ボタンのイベント
        const addButton = document.getElementById('add-figure');
        if (addButton) {
            addButton.addEventListener('click', () => {
                const figureType = document.getElementById('figure-type')?.value || 'circle';
                const figureColor = document.getElementById('figure-color')?.value || '#007BFF';
                const comment = document.getElementById('comment')?.value || '';
                const xPos = parseInt(xValueInput?.value) || 0;
                const yPos = parseInt(yValueInput?.value) || 0;
                const blinkEnabled = document.getElementById('blink-enabled')?.checked || false;
                const blinkOnTime = document.getElementById('blink-on-time')?.value || '0.5';
                const blinkOffTime = document.getElementById('blink-off-time')?.value || '0.5';

                figureCounter++;

                // 内容欄の組み立て
                const colorBox = `<span style="display:inline-block;width:16px;height:16px;background-color:${figureColor};border:1px solid #ccc;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>`;
                const content = `${colorBox}${this.getFigureTypeName(figureType)} (${xPos}, ${yPos})${blinkEnabled ? ' [点滅]' : ''}`;

                // 現在選択されている状態に応じてテーブルに追加
                const figureListId = currentFigureState === 'on' ? 'figure-list-on' : 'figure-list-off';
                const figureList = document.getElementById(figureListId);
                
                if (figureList) {
                    const row = figureList.insertRow();
                    row.setAttribute('data-id', figureCounter);
                    row.innerHTML = `
                        <td>${figureCounter}</td>
                        <td>${content}</td>
                        <td>${comment}</td>
                    `;
                    
                    // 行クリックで選択
                    row.addEventListener('click', () => {
                        const currentTable = row.closest('tbody');
                        currentTable.querySelectorAll('tr').forEach(r => {
                            r.classList.remove('selected');
                        });
                        row.classList.add('selected');
                    });
                }

                console.log(`図形を追加 [${currentFigureState.toUpperCase()}]:`, { figureCounter, figureType, figureColor, xPos, yPos, comment, blinkEnabled, blinkOnTime, blinkOffTime });
            });
        }

        // 削除ボタンのイベント
        const deleteButton = document.getElementById('delete-figures');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                // 現在表示されているテーブルから選択された行を削除
                const figureListId = currentFigureState === 'on' ? 'figure-list-on' : 'figure-list-off';
                const figureList = document.getElementById(figureListId);
                
                if (figureList) {
                    const selectedRow = figureList.querySelector('tr.selected');
                    if (selectedRow) {
                        const figureId = selectedRow.getAttribute('data-id');
                        selectedRow.remove();
                        console.log(`図形を削除 [${currentFigureState.toUpperCase()}]: ID=${figureId}`);
                    } else {
                        console.log('削除する図形が選択されていません');
                        alert('削除する図形を選択してください');
                    }
                }
            });
        }
    }

    /**
     * 図形タイプ名を取得
     */
    getFigureTypeName(type) {
        const typeMap = {
            'polygon': '多角形',
            'rectangle': '矩形',
            'circle': '円',
            'triangle': '三角形'
        };
        return typeMap[type] || type;
    }

    /**
     * ビジュアルコンポーネント（図形・画像統合）の初期化
     */
    initializeVisualComponent() {
        console.log('=== initializeVisualComponent 開始 ===');
        
        // ElementManagerのイベントリスナーを設定
        if (window.elementManager) {
            // 少し遅延させてDOM要素が確実に存在するようにする
            setTimeout(() => {
                console.log('ElementManager イベントリスナー設定');
                window.elementManager.setupEventListeners();
                
                // 現在選択中のグループがあれば、その要素を読み込み
                if (window.groupManager && window.groupManager.currentGroupId) {
                    console.log('現在選択中のグループの要素を読み込み:', window.groupManager.currentGroupId);
                    window.elementManager.loadElements(window.groupManager.currentGroupId);
                }
            }, 100);
        }
        
        let visualCounter = 0;
        let currentVisualState = 'on';
        let currentElementType = 'figure'; // 'figure' or 'image'
        
        // アップロード済み画像情報を保持
        let uploadedImageData = {
            on: null,  // ON時の画像データ
            off: null  // OFF時の画像データ
        };

        // 要素の存在確認
        const visualTabs = document.querySelectorAll('.visual-tab');
        const typeButtons = document.querySelectorAll('.type-btn');
        
        console.log('visualTabs.length:', visualTabs.length);
        console.log('typeButtons.length:', typeButtons.length);
        
        // ビジュアル状態タブの切り替え
        if (visualTabs.length > 0) {
            visualTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const state = tab.getAttribute('data-state');
                    currentVisualState = state;
                    
                    visualTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    
                    const onContainer = document.getElementById('on-visual-container');
                    const offContainer = document.getElementById('off-visual-container');
                    
                    if (onContainer) onContainer.classList.toggle('hidden', state !== 'on');
                    if (offContainer) offContainer.classList.toggle('hidden', state !== 'off');
                });
            });
        }

        // 要素タイプボタンの切り替え
        if (typeButtons.length > 0) {
            typeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const type = btn.getAttribute('data-type');
                    currentElementType = type;
                    
                    typeButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // 設定パネルの表示切り替え
                    const figureSettings = document.getElementById('figure-settings');
                    const imageSettings = document.getElementById('image-settings');
                    
                    if (figureSettings) figureSettings.classList.toggle('hidden', type !== 'figure');
                    if (imageSettings) imageSettings.classList.toggle('hidden', type !== 'image');
                });
            });
        }
        
        // 点滅制御チェックボックスの切り替え
        const blinkEnabledCheckbox = document.getElementById('blink-enabled');
        const singleImageGroup = document.getElementById('single-image-group');
        const blinkImageGroup = document.getElementById('blink-image-group');
        
        if (blinkEnabledCheckbox) {
            blinkEnabledCheckbox.addEventListener('change', (e) => {
                const isBlinkEnabled = e.target.checked;
                
                if (singleImageGroup) singleImageGroup.style.display = isBlinkEnabled ? 'none' : 'block';
                if (blinkImageGroup) blinkImageGroup.style.display = isBlinkEnabled ? 'block' : 'none';
                
                console.log('点滅制御:', isBlinkEnabled ? 'ON' : 'OFF');
            });
        }

        // 図形タイプセレクトボックスの change イベント
        const figureTypeSelect = document.getElementById('figure-type');
        if (figureTypeSelect) {
            figureTypeSelect.addEventListener('change', (e) => {
                const figureType = e.target.value;
                const displayTargetSelect = document.getElementById('dest');
                const displayTarget = displayTargetSelect ? displayTargetSelect.value : 'parts';
                
                // プレビューデータを生成（デフォルト矩形）
                const previewData = createShapePreview(figureType, displayTarget);
                
                // localStorage に保存
                localStorage.setItem('previewElement', JSON.stringify(previewData));
                localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                
                console.log('[Shape Preview] プレビュー生成:', previewData);
            });
        }

        // プレビューデータを生成する関数
        function createShapePreview(shapeType, displayTarget) {
            // ディスプレイの解像度を取得
            let displayWidth = 1920, displayHeight = 1200;
            if (displayTarget === 'monitor') {
                displayWidth = 1920;
                displayHeight = 1080;
            }
            
            // 矩形のデフォルトサイズ
            const defaultWidth = 200;
            const defaultHeight = 150;
            
            // 中央に配置
            const centerX = Math.floor((displayWidth - defaultWidth) / 2);
            const centerY = Math.floor((displayHeight - defaultHeight) / 2);
            
            let shapeData = {};
            if (shapeType === 'rectangle') {
                shapeData = {
                    type: 'rectangle',
                    top_left: [centerX, centerY],
                    width: defaultWidth,
                    height: defaultHeight
                };
            } else if (shapeType === 'polygon') {
                // 多角形: 初期は四角形
                shapeData = {
                    type: 'polygon',
                    points: [
                        [centerX, centerY],
                        [centerX + defaultWidth, centerY],
                        [centerX + defaultWidth, centerY + defaultHeight],
                        [centerX, centerY + defaultHeight]
                    ]
                };
            } else if (shapeType === 'circle') {
                shapeData = {
                    type: 'circle',
                    center: [centerX + defaultWidth/2, centerY + defaultHeight/2],
                    radius: defaultWidth / 2
                };
            } else if (shapeType === 'triangle') {
                shapeData = {
                    type: 'triangle',
                    points: [
                        [centerX + defaultWidth/2, centerY],
                        [centerX + defaultWidth, centerY + defaultHeight],
                        [centerX, centerY + defaultHeight]
                    ]
                };
            }
            
            return {
                type: 'shape',
                shapeType: shapeType,
                shape_data: shapeData,
                x: centerX,
                y: centerY,
                display_target: displayTarget,
                stroke_color: '#000000',
                fill_color: '#FFFFFF',
                stroke_width: 2,
                isPreview: true
            };
        }

        // 座標移動ボタンのイベント（プレビュー更新用）
        const bulkXMinusBtn = document.getElementById('bulk-x-minus');
        const bulkXPlusBtn = document.getElementById('bulk-x-plus');
        const bulkYMinusBtn = document.getElementById('bulk-y-minus');
        const bulkYPlusBtn = document.getElementById('bulk-y-plus');
        const bulkXValue = document.getElementById('bulk-x-value');
        const bulkYValue = document.getElementById('bulk-y-value');

        function updateShapePreview() {
            const previewData = localStorage.getItem('previewElement');
            if (!previewData) return;

            try {
                const preview = JSON.parse(previewData);
                if (preview.type !== 'shape') return;

                const offsetX = parseInt(bulkXValue?.value || 0);
                const offsetY = parseInt(bulkYValue?.value || 0);

                // shape_data の座標を更新
                if (preview.shape_data.type === 'rectangle') {
                    const [x, y] = preview.shape_data.top_left;
                    preview.shape_data.top_left = [x + offsetX, y + offsetY];
                } else if (preview.shape_data.type === 'polygon') {
                    preview.shape_data.points = preview.shape_data.points.map(p => [p[0] + offsetX, p[1] + offsetY]);
                } else if (preview.shape_data.type === 'circle') {
                    const [cx, cy] = preview.shape_data.center;
                    preview.shape_data.center = [cx + offsetX, cy + offsetY];
                }

                preview.x += offsetX;
                preview.y += offsetY;

                localStorage.setItem('previewElement', JSON.stringify(preview));
                localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());

                console.log('[Shape Update] プレビュー座標更新:', offsetX, offsetY);
            } catch (e) {
                console.error('プレビュー更新エラー:', e);
            }
        }

        if (bulkXMinusBtn) bulkXMinusBtn.addEventListener('click', () => {
            const val = parseInt(bulkXValue.value) || 0;
            bulkXValue.value = val - 10;
            updateShapePreview();
        });

        if (bulkXPlusBtn) bulkXPlusBtn.addEventListener('click', () => {
            const val = parseInt(bulkXValue.value) || 0;
            bulkXValue.value = val + 10;
            updateShapePreview();
        });

        if (bulkYMinusBtn) bulkYMinusBtn.addEventListener('click', () => {
            const val = parseInt(bulkYValue.value) || 0;
            bulkYValue.value = val - 10;
            updateShapePreview();
        });

        if (bulkYPlusBtn) bulkYPlusBtn.addEventListener('click', () => {
            const val = parseInt(bulkYValue.value) || 0;
            bulkYValue.value = val + 10;
            updateShapePreview();
        });
        

        // カーソル移動ボタン（図形用）
        const cursorMoveBtn = document.getElementById('cursor-move');
        if (cursorMoveBtn) {
            cursorMoveBtn.addEventListener('click', () => {
                console.log('図形のカーソル移動');
                // TODO: カーソル移動の実装
            });
        }

        // カーソル移動ボタン（画像用）
        const cursorMoveImageBtn = document.getElementById('cursor-move-image');
        if (cursorMoveImageBtn) {
            cursorMoveImageBtn.addEventListener('click', async () => {
                let centerX, centerY, displayTarget, sourceType;
                
                // まずプレビュー要素をチェック
                const previewData = localStorage.getItem('previewElement');
                if (previewData) {
                    try {
                        const preview = JSON.parse(previewData);
                        // プレビューの中心座標を計算（スケールを考慮）
                        const scaledWidth = (preview.width || 200) * (preview.scale || 1.0);
                        const scaledHeight = (preview.height || 200) * (preview.scale || 1.0);
                        centerX = preview.x + (scaledWidth / 2);
                        centerY = preview.y + (scaledHeight / 2);
                        displayTarget = preview.display_target;
                        sourceType = 'プレビュー';
                        console.log(`[プレビュー] カーソル移動: 中心=(${centerX}, ${centerY}), 表示先=${displayTarget}`);
                    } catch (e) {
                        console.error('プレビューデータのパースエラー:', e);
                    }
                }
                
                // プレビューがない場合は選択中の要素を取得
                if (!centerX && !centerY) {
                    const currentElement = window.elementManager?.currentElement;
                    
                    if (!currentElement) {
                        alert('要素またはプレビューが存在しません。画像を選択するか、プレビュー表示してください。');
                        return;
                    }
                    
                    // 要素の中心座標を計算
                    const scaledWidth = (currentElement.width || currentElement.image_width || 200) * (currentElement.scale || 1.0);
                    const scaledHeight = (currentElement.height || currentElement.image_height || 200) * (currentElement.scale || 1.0);
                    centerX = currentElement.x + (scaledWidth / 2);
                    centerY = currentElement.y + (scaledHeight / 2);
                    displayTarget = currentElement.display_target;
                    sourceType = 'DB要素';
                    console.log(`[DB要素] カーソル移動: 要素ID=${currentElement.id}, 中心=(${centerX}, ${centerY}), 表示先=${displayTarget}`);
                }
                
                try {
                    // サーバーのマウス移動APIを呼び出し
                    const response = await fetch('/mapping/api/move_cursor', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            x: Math.round(centerX),
                            y: Math.round(centerY),
                            display_target: displayTarget
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`マウス移動成功 (${sourceType}):`, result);
                        alert(`カーソルを移動しました (${sourceType})`);
                    } else {
                        const error = await response.json();
                        console.error('マウス移動エラー:', error);
                        alert('マウスの移動に失敗しました: ' + error.error);
                    }
                } catch (error) {
                    console.error('マウス移動リクエストエラー:', error);
                    alert('マウスの移動に失敗しました');
                }
            });
        }
        
        // ディスプレイウィンドウを開くボタン
        const openDisplayWindowBtn = document.getElementById('open-display-window');
        if (openDisplayWindowBtn) {
            openDisplayWindowBtn.addEventListener('click', async () => {
                const displayTargetSelect = document.getElementById('dest');
                const displayTarget = displayTargetSelect ? displayTargetSelect.value : 'parts';
                
                // ディスプレイウィンドウマネージャーを初期化（まだなければ）
                if (!window.displayWindowManager) {
                    window.displayWindowManager = new DisplayWindowManager();
                }
                
                // 現在のグループIDをlocalStorageに保存
                const currentGroupId = window.groupManager?.currentGroupId;
                if (currentGroupId) {
                    localStorage.setItem(CURRENT_GROUP_KEY, currentGroupId);
                }
                
                // ディスプレイウィンドウを開く
                const url = `/display/${displayTarget}`;
                const win = window.open(url, `display_${displayTarget}`, 'width=1920,height=1080');
                
                if (win) {
                    // ディスプレイに応じて位置を調整
                    if (displayTarget === 'monitor') {
                        win.moveTo(0, 0);
                    } else if (displayTarget === 'parts' || displayTarget === 'workbench') {
                        // セカンダリディスプレイに移動（画面の幅分右に移動）
                        win.moveTo(window.screen.width, 0);
                    }
                    console.log(`ディスプレイウィンドウを開きました: ${displayTarget}`);
                }
            });
        }

        // 画像ファイル選択時の処理（通常）
        const imageFileInput = document.getElementById('image-file');
        if (imageFileInput) {
            imageFileInput.addEventListener('change', async (e) => {
                await handleImageUpload(e.target.files[0], 'single');
            });
        }
        
        // 画像ファイル選択時の処理（ON時）
        const imageFileOnInput = document.getElementById('image-file-on');
        if (imageFileOnInput) {
            imageFileOnInput.addEventListener('change', async (e) => {
                await handleImageUpload(e.target.files[0], 'on');
            });
        }
        
        // 画像ファイル選択時の処理（OFF時）
        const imageFileOffInput = document.getElementById('image-file-off');
        if (imageFileOffInput) {
            imageFileOffInput.addEventListener('change', async (e) => {
                await handleImageUpload(e.target.files[0], 'off');
            });
        }
        
        // 画像アップロード処理の共通関数
        async function handleImageUpload(file, mode) {
            const startTime = performance.now();
            console.log(`[画像アップロード開始] モード: ${mode}, ファイル: ${file.name}`);
            
            const fileNameDisplayId = mode === 'single' ? 'image-file-name' : 
                                      mode === 'on' ? 'image-file-on-name' : 'image-file-off-name';
            const fileNameDisplay = document.getElementById(fileNameDisplayId);
            const displayImg = document.getElementById('image-display-img');
            const imageDimensions = document.getElementById('image-dimensions');
            
            if (file) {
                // ファイル名表示
                if (fileNameDisplay) {
                    fileNameDisplay.textContent = file.name;
                }
                
                // 画像を表示
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (displayImg) {
                        displayImg.src = event.target.result;
                    }
                    
                    // 画像サイズを取得
                    const img = new Image();
                    img.onload = () => {
                        if (imageDimensions) {
                            imageDimensions.textContent = `${img.width} × ${img.height} px`;
                        }
                        
                        // デフォルトの幅と高さを設定（画像の実サイズの1/2）
                        const widthInput = document.getElementById('image-width');
                        const heightInput = document.getElementById('image-height');
                        if (widthInput && !widthInput.value) {
                            widthInput.value = Math.floor(img.width / 2);
                        }
                        if (heightInput && !heightInput.value) {
                            heightInput.value = Math.floor(img.height / 2);
                        }
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
                
                // サーバーにアップロード
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    const response = await fetch('/mapping/api/upload/image', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        const imageData = await response.json();
                        // モードに応じてデータを保存
                        if (mode === 'single') {
                            uploadedImageData.on = imageData;
                            uploadedImageData.off = null;
                        } else {
                            uploadedImageData[mode] = imageData;
                        }
                        
                        const endTime = performance.now();
                        const duration = ((endTime - startTime) / 1000).toFixed(2);
                        console.log(`[画像アップロード完了] ${duration}秒 - データ:`, imageData);
                        
                        // アップロード完了後、一時プレビューを表示（DBには登録しない）
                        showPreviewInMemory(imageData, mode);
                        
                    } else {
                        const error = await response.json();
                        console.error('画像アップロードエラー:', error);
                        alert('画像のアップロードに失敗しました');
                    }
                } catch (error) {
                    console.error('アップロードエラー:', error);
                    alert('画像のアップロードに失敗しました');
                }
            } else {
                // ファイルが選択されていない場合
                if (fileNameDisplay) {
                    fileNameDisplay.textContent = '未選択';
                }
                if (displayImg) {
                    displayImg.src = '';
                }
            }
        }
        
        // 画像アップロード後に一時プレビューを表示（メモリ上でのみ）
        function showPreviewInMemory(imageData, mode) {
            const currentGroupId = window.groupManager?.currentGroupId;
            if (!currentGroupId) {
                console.warn('グループが選択されていません');
                return;
            }
            
            const displayTargetSelect = document.getElementById('dest');
            const displayTarget = displayTargetSelect ? displayTargetSelect.value : 'parts';
            
            // 現在のフォーム値を取得
            const xPos = parseInt(document.getElementById('image-x')?.value || 0);
            const yPos = parseInt(document.getElementById('image-y')?.value || 0);
            const scale = parseFloat(document.getElementById('image-scale')?.value || 1.0);
            const rotation = parseFloat(document.getElementById('image-rotation')?.value || 0);
            
            // 一時プレビューデータを作成
            const previewData = {
                id: 'preview-temp',
                file_path: imageData.file_path,
                width: imageData.width,
                height: imageData.height,
                x: xPos,
                y: yPos,
                scale: scale,
                rotation: rotation,
                display_target: displayTarget,
                isPreview: true
            };
            
            // localStorageに一時プレビューデータを保存
            localStorage.setItem('previewElement', JSON.stringify(previewData));
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
            
            console.log('=== プレビュー保存 ===');
            console.log('previewData:', previewData);
            console.log('localStorage.previewElement:', localStorage.getItem('previewElement'));
            console.log('localStorage.mappingLastUpdate:', localStorage.getItem(MAPPING_SYNC_KEY));
            console.log('一時プレビューを表示しました');
        }
        
        // フォーム値が変更されたらプレビューを更新
        function updatePreview() {
            const previewElement = localStorage.getItem('previewElement');
            if (!previewElement) {
                console.log('プレビュー要素が存在しません');
                return;
            }
            
            try {
                const preview = JSON.parse(previewElement);
                const xPos = parseInt(document.getElementById('image-x')?.value || 0);
                const yPos = parseInt(document.getElementById('image-y')?.value || 0);
                const scale = parseFloat(document.getElementById('image-scale')?.value || 1.0);
                const rotation = parseFloat(document.getElementById('image-rotation')?.value || 0);
                
                console.log(`プレビュー更新: x=${xPos}, y=${yPos}, scale=${scale}, rotation=${rotation}`);
                
                preview.x = xPos;
                preview.y = yPos;
                preview.scale = scale;
                preview.rotation = rotation;
                
                localStorage.setItem('previewElement', JSON.stringify(preview));
                localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                
                console.log('プレビューを更新しました');
            } catch (error) {
                console.error('プレビュー更新エラー:', error);
            }
        }
        
        // 座標、スケール、回転の入力欄にイベントリスナーを追加
        setTimeout(() => {
            ['image-x', 'image-y', 'image-scale', 'image-rotation'].forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    // input イベント（リアルタイム）
                    input.addEventListener('input', updatePreview);
                    // change イベント（フォーカスアウト時）
                    input.addEventListener('change', updatePreview);
                    console.log(`イベントリスナー登録: ${id}`);
                } else {
                    console.warn(`要素が見つかりません: ${id}`);
                }
            });
        }, 200);
        
        // 画像をDBに登録してディスプレイに表示
        async function registerAndDisplayImage(imageData, mode) {
            // 現在選択中のグループIDを取得
            const currentGroupId = window.groupManager?.currentGroupId;
            if (!currentGroupId) {
                console.warn('グループが選択されていません');
                return;
            }
            
            // 表示先を取得
            const displayTargetSelect = document.getElementById('dest');
            const displayTarget = displayTargetSelect ? displayTargetSelect.value : 'parts';
            
            // 部品棚または作業台の場合のみ即座に表示
            if (displayTarget !== 'parts' && displayTarget !== 'workbench') {
                console.log('即座表示の対象外:', displayTarget);
                return;
            }
            
            // ディスプレイウィンドウが開いていない場合は自動的に開く
            if (window.displayWindowManager) {
                await window.displayWindowManager.openWindow(displayTarget);
                console.log(`ディスプレイウィンドウを自動的に開きました: ${displayTarget}`);
            }
            
            // 座標とサイズを取得（デフォルト値を使用）
            const xInput = document.getElementById('image-x');
            const yInput = document.getElementById('image-y');
            
            const x = xInput ? parseInt(xInput.value) || 960 : 960;  // デフォルト中央
            const y = yInput ? parseInt(yInput.value) || 540 : 540;
            
            // 状態を取得
            const blinkControl = document.getElementById('blink-control');
            const elementState = (blinkControl && blinkControl.checked) ? mode : null;
            
            // group_elementsに登録
            try {
                const response = await fetch('/mapping/api/group_elements', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        group_id: currentGroupId,
                        image_asset_id: imageData.id,
                        display_target: displayTarget,
                        x: x,
                        y: y,
                        scale: 1.0,
                        rotation: 0.0,
                        element_state: elementState
                    })
                });
                
                if (response.ok) {
                    const elementData = await response.json();
                    console.log('要素をDBに登録しました:', elementData);

                    // 現在のグループIDをlocalStorageに保存（ディスプレイウィンドウで参照）
                    localStorage.setItem(CURRENT_GROUP_KEY, currentGroupId);
                    
                    // 要素テーブルを再読み込み
                    if (window.elementManager) {
                        await window.elementManager.loadElements(currentGroupId);
                        if (typeof window.elementManager.notifyDisplayUpdate === 'function') {
                            window.elementManager.notifyDisplayUpdate();
                        }
                    }
                } else {
                    console.error('要素の登録に失敗しました');
                }
            } catch (error) {
                console.error('要素登録エラー:', error);
            }
        }

        // 画像表示の拡大縮小・回転機能
        const displayImgEl = document.getElementById('image-display-img');
        const scaleSlider = document.getElementById('image-scale');
        const scaleValue = document.getElementById('scale-value');
        const rotationSlider = document.getElementById('image-rotation');
        const rotationValue = document.getElementById('rotation-value');
        const xInput = document.getElementById('image-x');
        const yInput = document.getElementById('image-y');
        
        // 拡大縮小スライダー
        if (scaleSlider && scaleValue && displayImgEl) {
            scaleSlider.addEventListener('input', (e) => {
                const scale = parseFloat(e.target.value);
                scaleValue.textContent = scale.toFixed(1);
                const rotation = rotationSlider ? rotationSlider.value : 0;
                displayImgEl.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
            });
        }
        
        // 回転スライダー
        if (rotationSlider && rotationValue && displayImgEl) {
            rotationSlider.addEventListener('input', (e) => {
                const rotation = parseInt(e.target.value);
                rotationValue.textContent = rotation;
                const scale = scaleSlider ? scaleSlider.value : 1;
                displayImgEl.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
            });
        }
        
        // 座標入力の反映
        if (xInput) {
            xInput.addEventListener('change', () => {
                console.log('X座標変更:', xInput.value);
            });
        }
        
        if (yInput) {
            yInput.addEventListener('change', () => {
                console.log('Y座標変更:', yInput.value);
            });
        }
        
        // プレビューウィンドウを開く
        const openPreviewBtn = document.getElementById('open-preview');
        if (openPreviewBtn) {
            openPreviewBtn.addEventListener('click', () => {
                const displayTargetInput = document.getElementById('dest');
                const displayTarget = displayTargetInput ? displayTargetInput.value : 'monitor';
                
                // プレビューウィンドウを開く
                const previewUrl = `/preview/${displayTarget}`;
                const previewWindow = window.open(previewUrl, `preview_${displayTarget}`, 'width=1920,height=1080');
                
                if (previewWindow) {
                    // ディスプレイに応じて位置を調整
                    if (displayTarget === 'monitor') {
                        previewWindow.moveTo(0, 0);
                    } else {
                        previewWindow.moveTo(window.screen.width, 0);
                    }
                    console.log(`プレビューウィンドウを開きました: ${displayTarget}`);
                }
            });
        }

        // フォーム要素変更時の自動保存
        const autoSaveInputs = ['image-x', 'image-y', 'image-scale', 'image-rotation', 'comment', 'dest'];
        autoSaveInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                const saveHandler = async () => {
                    if (window.elementManager && window.elementManager.currentElementId) {
                        await window.elementManager.updateCurrentElement();
                        console.log('要素を自動保存しました');
                    }
                };
                
                // 入力フィールドはblurで、スライダーはchangeで保存
                if (input.type === 'range') {
                    input.addEventListener('change', saveHandler);
                } else {
                    input.addEventListener('blur', saveHandler);
                }
            }
        });
        
        // 追加ボタン
        const addButton = document.getElementById('add-visual');
        if (addButton) {
            addButton.addEventListener('click', async () => {
                // 現在選択中のグループIDを取得
                const currentGroupId = window.elementManager ? window.elementManager.getCurrentGroupId() : null;
                
                if (!currentGroupId) {
                    alert('左側の表からグループを選択してください');
                    return;
                }
                
                const commentInput = document.getElementById('comment');
                const blinkEnabledInput = document.getElementById('blink-enabled');
                const displayTargetInput = document.getElementById('dest');
                
                const comment = commentInput ? commentInput.value : '';
                const blinkEnabled = blinkEnabledInput ? blinkEnabledInput.checked : false;
                const displayTarget = displayTargetInput ? displayTargetInput.value : '';
                
                visualCounter++;
                
                let typeLabel = '';
                let content = '';

                if (currentElementType === 'figure') {
                    // 図形の場合
                    const figureTypeInput = document.getElementById('figure-type');
                    const figureColorInput = document.getElementById('figure-color');
                    
                    const figureType = figureTypeInput ? figureTypeInput.value : 'circle';
                    const figureColor = figureColorInput ? figureColorInput.value : '#007BFF';
                    const colorBox = `<span style="display:inline-block;width:16px;height:16px;background-color:${figureColor};border:1px solid #ccc;border-radius:2px;margin-right:6px;vertical-align:middle;"></span>`;
                    
                    typeLabel = '図形';
                    content = `${colorBox}${this.getFigureTypeName(figureType)}${blinkEnabled ? ' [点滅]' : ''}`;
                    
                    // プレビューデータから座標・図形情報を取得
                    const previewData = localStorage.getItem('previewElement');
                    if (!previewData) {
                        alert('図形がプレビューされていません。図形タイプを選択してください');
                        return;
                    }

                    try {
                        const preview = JSON.parse(previewData);
                        if (preview.type !== 'shape') {
                            alert('図形プレビューが無効です');
                            return;
                        }

                        console.log('[DB登録開始] 図形要素をgroup_elementsテーブルに保存中...', preview);

                        const requestData = {
                            group_id: currentGroupId,
                            element_type: 'shape',
                            display_target: displayTarget,
                            x_position: preview.x,
                            y_position: preview.y,
                            shape_type: preview.shapeType,
                            shape_data: preview.shape_data,
                            stroke_color: preview.stroke_color,
                            fill_color: preview.fill_color,
                            stroke_width: preview.stroke_width,
                            element_comment: comment,
                            has_blink_control: blinkEnabled,
                            blink_on_time: parseFloat(document.getElementById('blink-on-time')?.value || 0.5),
                            blink_off_time: parseFloat(document.getElementById('blink-off-time')?.value || 0.5)
                        };

                        console.log('[図形登録] リクエストデータ:', requestData);

                        const response = await fetch('/mapping/api/group_elements', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestData)
                        });

                        if (response.ok) {
                            const result = await response.json();
                            console.log('[図形登録成功]:', result);
                            alert('図形を登録しました');

                            // プレビューをクリア
                            localStorage.removeItem('previewElement');
                            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());

                            // 要素テーブルを再読み込み
                            if (window.elementManager) {
                                await window.elementManager.loadElements(currentGroupId);
                            }
                        } else {
                            const error = await response.json();
                            console.error('[図形登録エラー]:', error);
                            alert('図形の登録に失敗しました: ' + error.error);
                        }
                    } catch (error) {
                        console.error('[図形登録リクエストエラー]:', error);
                        alert('図形の登録に失敗しました');
                    }
                    return;
                } else {
                    // 画像の場合
                    const imageData = uploadedImageData[currentVisualState];
                    
                    if (!imageData) {
                        alert('画像ファイルを選択してください');
                        return;
                    }
                    
                    // DBに登録
                    try {
                        const dbStartTime = performance.now();
                        console.log('[DB登録開始] 画像要素をgroup_elementsテーブルに保存中...');
                        
                        // プレビュー要素から座標・スケール・回転を取得（内部メモリ優先）
                        let xPos, yPos, scale, rotation;
                        
                        const previewData = localStorage.getItem('previewElement');
                        if (previewData) {
                            // プレビューデータがあればそれを使用
                            try {
                                const preview = JSON.parse(previewData);
                                xPos = preview.x;
                                yPos = preview.y;
                                scale = preview.scale;
                                rotation = preview.rotation;
                                console.log('プレビューデータから座標を取得:', { xPos, yPos, scale, rotation });
                            } catch (e) {
                                console.error('プレビューデータのパースエラー:', e);
                                // フォールバック: フォームから取得
                                xPos = parseInt(document.getElementById('image-x')?.value || 0);
                                yPos = parseInt(document.getElementById('image-y')?.value || 0);
                                scale = parseFloat(document.getElementById('image-scale')?.value || 1.0);
                                rotation = parseFloat(document.getElementById('image-rotation')?.value || 0);
                            }
                        } else {
                            // プレビューデータがなければフォームから取得
                            xPos = parseInt(document.getElementById('image-x')?.value || 0);
                            yPos = parseInt(document.getElementById('image-y')?.value || 0);
                            scale = parseFloat(document.getElementById('image-scale')?.value || 1.0);
                            rotation = parseFloat(document.getElementById('image-rotation')?.value || 0);
                        }
                        
                        const requestData = {
                            group_id: currentGroupId,
                            image_asset_id: imageData.id,
                            display_target: displayTarget,
                            x_position: xPos,
                            y_position: yPos,
                            scale: scale,
                            rotation: rotation,
                            has_blink_control: blinkEnabled,
                            blink_on_time: parseFloat(document.getElementById('blink-on-time')?.value || 0.5),
                            blink_off_time: parseFloat(document.getElementById('blink-off-time')?.value || 0.5),
                            element_comment: comment
                        };
                        
                        // ON/OFF制御がある場合は両方の画像IDを送信
                        if (blinkEnabled) {
                            if (uploadedImageData.on) {
                                requestData.on_image_asset_id = uploadedImageData.on.id;
                            }
                            if (uploadedImageData.off) {
                                requestData.off_image_asset_id = uploadedImageData.off.id;
                            }
                        }
                        
                        console.log('[DEBUG] リクエストデータ:', requestData);
                        console.log('[DEBUG] リクエストURL: /mapping/api/group_elements');
                        
                        const response = await fetch('/mapping/api/group_elements', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestData)
                        });
                        
                        console.log('[DEBUG] レスポンスステータス:', response.status, response.statusText);
                        console.log('[DEBUG] レスポンスヘッダ Content-Type:', response.headers.get('content-type'));
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('[DEBUG] エラーレスポンスボディ:', errorText);
                            throw new Error(`DB登録に失敗しました (HTTP ${response.status}: ${errorText})`);
                        }
                        
                        const result = await response.json();
                        const dbEndTime = performance.now();
                        const dbDuration = ((dbEndTime - dbStartTime) / 1000).toFixed(2);
                        console.log(`[DB登録完了] ${dbDuration}秒 - 結果:`, result);
                        console.log('[DEBUG] レスポンスデータ詳細:', JSON.stringify(result, null, 2));
                        
                        // 一時プレビューをクリア
                        localStorage.removeItem('previewElement');
                        
                        // アップロード画像データをクリア（同じ画像を再登録できるように）
                        uploadedImageData = {
                            on: null,
                            off: null
                        };
                        
                        // ファイル入力要素をクリア（同じファイルを再選択可能に）
                        const imageFileInput = document.getElementById('image-file');
                        const imageFileOnInput = document.getElementById('image-file-on');
                        const imageFileOffInput = document.getElementById('image-file-off');
                        if (imageFileInput) imageFileInput.value = '';
                        if (imageFileOnInput) imageFileOnInput.value = '';
                        if (imageFileOffInput) imageFileOffInput.value = '';
                        
                        // ファイル名表示をクリア
                        const imageFileName = document.getElementById('image-file-name');
                        const imageFileOnName = document.getElementById('image-file-on-name');
                        const imageFileOffName = document.getElementById('image-file-off-name');
                        if (imageFileName) imageFileName.textContent = '未選択';
                        if (imageFileOnName) imageFileOnName.textContent = '未選択';
                        if (imageFileOffName) imageFileOffName.textContent = '未選択';
                        
                        console.log('画像キャッシュとファイル入力をクリアしました');
                        
                        // localStorageを先にクリア（選択状態をリセット）
                        localStorage.removeItem(SELECTED_ELEMENT_KEY);
                        
                        // 要素一覧を再読み込み
                        if (window.elementManager) {
                            await window.elementManager.loadElements(currentGroupId);
                            // フォームをリセットして次の要素を追加できるようにする
                            window.elementManager.resetForm();
                        }
                        
                        // 表示ウィンドウに即座に通知
                        localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                        
                        // 少し遅延してもう1回通知（確実に反映させる）
                        setTimeout(() => {
                            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                        }, 100);
                        
                        alert('画像を追加しました。次の画像を追加できます。');
                        
                    } catch (error) {
                        console.error('DB登録エラー:', error);
                        console.error('[DEBUG] エラースタック:', error.stack);
                        console.error('[DEBUG] エラー詳細:', {
                            message: error.message,
                            name: error.name,
                            toString: error.toString()
                        });
                        alert('画像の登録に失敗しました: ' + error.message);
                        return;
                    }
                    
                    const fileName = imageData.file_path.split('/').pop();
                    const xPos = parseInt(document.getElementById('image-x')?.value || 0);
                    const yPos = parseInt(document.getElementById('image-y')?.value || 0);
                    const scale = parseFloat(document.getElementById('image-scale')?.value || 1.0);
                }

                console.log(`要素を追加:`, { visualCounter, elementType: currentElementType, comment, blinkEnabled });
            });
        }

        // 削除ボタン
        const deleteButton = document.getElementById('delete-visual');
        if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
                if (window.elementManager && window.elementManager.currentElementId) {
                    const confirmed = confirm('この要素を削除しますか？');
                    if (confirmed) {
                        await window.elementManager.deleteCurrentElement();
                    }
                } else {
                    alert('削除する要素を選択してください');
                }
            });
        }
        
        // 更新ボタン
        const updateButton = document.getElementById('update-visual');
        if (updateButton) {
            updateButton.addEventListener('click', async () => {
                if (window.elementManager && window.elementManager.currentElementId) {
                    const success = await window.elementManager.updateCurrentElement();
                    if (success) {
                        alert('要素を更新しました');
                    }
                } else {
                    alert('更新する要素を選択してください');
                }
            });
        }
        
        // クリアボタン（フォームをリセット）
        const clearButton = document.getElementById('clear-visual');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (window.elementManager) {
                    window.elementManager.currentElementId = null;
                    window.elementManager.currentElement = null;
                    localStorage.removeItem(SELECTED_ELEMENT_KEY);
                    window.elementManager.resetForm();
                    
                    // 表の選択を解除
                    document.querySelectorAll('.visual-table tbody tr').forEach(row => {
                        row.classList.remove('selected');
                    });
                    
                    // 更新ボタンを非表示、追加ボタンを表示
                    const addBtn = document.getElementById('add-visual');
                    const updateBtn = document.getElementById('update-visual');
                    if (addBtn) addBtn.style.display = 'inline-block';
                    if (updateBtn) updateBtn.style.display = 'none';
                }
            });
        }
    }


    /**
     * 音コンポーネントの初期化
     */
    initializeSoundComponent() {
        // 音量スライダーの値表示
        const volumeSlider = document.getElementById('sound-volume');
        const volumeValue = document.getElementById('volume-value');
        
        if (volumeSlider && volumeValue) {
            volumeSlider.addEventListener('input', (e) => {
                volumeValue.textContent = e.target.value;
            });
        }

        // 追加ボタンのイベント
        const addButton = document.getElementById('add-sound');
        if (addButton) {
            addButton.addEventListener('click', () => {
                console.log('音を追加');
                // TODO: 音追加の実装
            });
        }

        // テスト再生ボタンのイベント
        const testButton = document.getElementById('test-sound');
        if (testButton) {
            testButton.addEventListener('click', () => {
                console.log('音をテスト再生');
                // TODO: テスト再生の実装
            });
        }
    }

    /**
     * メディアコンポーネントの初期化
     */
    initializeMediaComponent() {
        // メディアタイプ変更時の処理
        const mediaType = document.getElementById('media-type');
        const videoOptions = document.getElementById('video-options');
        
        if (mediaType && videoOptions) {
            mediaType.addEventListener('change', (e) => {
                if (e.target.value === 'video') {
                    videoOptions.style.display = 'block';
                } else {
                    videoOptions.style.display = 'none';
                }
            });
        }

        // 追加ボタンのイベント
        const addButton = document.getElementById('add-media');
        if (addButton) {
            addButton.addEventListener('click', () => {
                console.log('メディアを追加');
                // TODO: メディア追加の実装
            });
        }

        // プレビューボタンのイベント
        const previewButton = document.getElementById('preview-media');
        if (previewButton) {
            previewButton.addEventListener('click', () => {
                console.log('メディアをプレビュー');
                // TODO: プレビューの実装
            });
        }
    }

    /**
     * キャッシュをクリア
     */
    clearCache() {
        this.componentCache = {};
    }

    /**
     * コンポーネントを再読み込み
     */
    reloadComponent() {
        this.clearCache();
        this.loadComponent(this.currentTab);
    }
    
    /**
     * 表示ウィンドウに更新を通知
     */
    notifyDisplayUpdate() {
        if (typeof MAPPING_SYNC_KEY !== 'undefined') {
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
        }
    }
}

// DOMContentLoaded後にWindowManagerを初期化
document.addEventListener('DOMContentLoaded', () => {
    try {
        localStorage.setItem('mappingPageActive', 'true');
    } catch (error) {
        console.warn('Failed to set mappingPageActive flag:', error);
    }
    window.windowManager = new WindowManager();
});

function clearMappingPageActiveFlag() {
    try {
        localStorage.setItem('mappingPageActive', 'false');
    } catch (error) {
        console.warn('Failed to clear mappingPageActive flag:', error);
    }
}

window.addEventListener('beforeunload', clearMappingPageActiveFlag);
window.addEventListener('pagehide', clearMappingPageActiveFlag);
