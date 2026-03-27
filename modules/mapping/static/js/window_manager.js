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
        let selectedElementId = null;  // 選択中の要素ID
        
        // アップロード済み画像情報を保持
        let uploadedImageData = {
            on: null,  // ON時の画像データ
            off: null  // OFF時の画像データ
        };

        // DEBUG: ストレージ確認
        console.log('[Visual] localStorage.CURRENT_GROUP_KEY =', CURRENT_GROUP_KEY);
        console.log('[Visual] localStorage.getItem(CURRENT_GROUP_KEY) =', localStorage.getItem(CURRENT_GROUP_KEY));

        // ========== 要素一覧の読み込みと初期化 ==========
        async function loadVisualElements() {
            const groupId = localStorage.getItem(CURRENT_GROUP_KEY);
            console.log('[Visual] loadVisualElements 実行: groupId =', groupId);
            
            if (!groupId) {
                console.warn('[Visual] グループが選択されていません');
                renderVisualTable({});
                return;
            }

            try {
                const url = `/mapping/api/groups/${groupId}/elements/list`;
                console.log('[Visual] API 呼び出し:', url);
                
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const elements = await response.json();
                console.log('[Visual] 要素一覧取得成功:', elements);
                
                if (!Array.isArray(elements)) {
                    console.error('[Visual] レスポンスは配列ではありません:', elements);
                    return;
                }
                
                // 要素を表示先ごとにグループ化
                const elementsByTarget = {};
                elements.forEach(el => {
                    const target = el.display_target || 'monitor';
                    if (!elementsByTarget[target]) {
                        elementsByTarget[target] = [];
                    }
                    elementsByTarget[target].push(el);
                    console.log('[Visual] 要素追加:', target, el);
                });
                
                console.log('[Visual] 表示先別グループ化完了:', elementsByTarget);
                
                // テーブルに表示
                renderVisualTable(elementsByTarget);
                
            } catch (error) {
                console.error('[Visual] 要素読み込みエラー:', error);
                renderVisualTable({});
            }
        }

        function renderVisualTable(elementsByTarget) {
            console.log('[Visual] renderVisualTable 呼び出し:', elementsByTarget);
            
            const onTbody = document.getElementById('visual-list-on');
            const offTbody = document.getElementById('visual-list-off');
            
            if (!onTbody) {
                console.error('[Visual] visual-list-on が見つかりません');
                return;
            }
            if (!offTbody) {
                console.error('[Visual] visual-list-off が見つかりません');
                return;
            }

            console.log('[Visual] テーブル tbody を検出: on=' + !!onTbody + ', off=' + !!offTbody);

            // テーブルをクリア
            onTbody.innerHTML = '';
            offTbody.innerHTML = '';

            // 要素がない場合
            if (!elementsByTarget || Object.keys(elementsByTarget).length === 0) {
                console.log('[Visual] 要素ありません');
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="4" style="text-align: center; color: #999;">要素がありません</td>';
                onTbody.appendChild(tr.cloneNode(true));
                offTbody.appendChild(tr);
                return;
            }

            // 表示先ごとにテーブル行を作成
            Object.entries(elementsByTarget).forEach(([displayTarget, elements]) => {
                console.log(`[Visual] 表示先 "${displayTarget}" の要素をレンダリング (${elements.length} 件)`);
                
                // 表示先をヘッダーとして表示
                const headerRow = document.createElement('tr');
                headerRow.style.backgroundColor = '#f0f0f0';
                headerRow.style.fontWeight = 'bold';
                headerRow.innerHTML = `
                    <td colspan="4" style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">
                        📺 <strong>${displayTarget.toUpperCase()}</strong>
                    </td>
                `;
                
                onTbody.appendChild(headerRow.cloneNode(true));

                // 要素の行を追加
                elements.forEach((element, index) => {
                    console.log(`[Visual] 行を追加: ${displayTarget} - ${element.element_type} - ${element.element_comment}`);
                    
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-element-id', element.id);
                    tr.classList.add('visual-element-row');
                    tr.style.cursor = 'pointer';

                    // タイプ表示
                    let typeLabel = element.element_type || '不明';
                    const typeMap = {
                        'image': '🖼️ 画像',
                        'rectangle': '📦 矩形',
                        'polygon': '🔺 多角形',
                        'circle': '⭕ 円',
                        'triangle': '△ 三角形',
                        'text': '📝 テキスト',
                        'shape': '🔷 図形'
                    };
                    typeLabel = typeMap[element.element_type] || `${element.element_type}`;

                    // 座標表示
                    const coord = `(${Math.round(element.x_position || 0)}, ${Math.round(element.y_position || 0)})`;

                    tr.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${typeLabel}</td>
                        <td>${element.element_comment || '—'}</td>
                        <td>${coord}</td>
                    `;

                    // 行をクリックして要素を選択・編集
                    tr.addEventListener('click', () => {
                        selectVisualElement(element, tr);
                    });

                    onTbody.appendChild(tr.cloneNode(true));
                });
            });
            
            console.log('[Visual] renderVisualTable 完了');
        }

        function selectVisualElement(element, row) {
            // 前の選択を解除
            document.querySelectorAll('.visual-element-row').forEach(r => {
                r.style.backgroundColor = '';
            });

            // 新しい行を選択
            row.style.backgroundColor = '#e3f2fd';
            selectedElementId = element.id;

            console.log('[Visual] 要素選択:', element);

            // 編集パネルに情報を反映
            loadElementToEditPanel(element);
        }

        function loadElementToEditPanel(element) {
            // 表示先を設定
            const destSelect = document.getElementById('dest');
            if (destSelect && element.display_target) {
                destSelect.value = element.display_target;
            }

            // コメント
            const commentInput = document.getElementById('comment');
            if (commentInput) {
                commentInput.value = element.element_comment || '';
            }

            // 要素タイプ設定
            const typeButtons = document.querySelectorAll('.type-btn');
            typeButtons.forEach(btn => btn.classList.remove('active'));
            
            console.log('[Element Select] element.element_type =', element.element_type);
            
            if (element.element_type === 'image') {
                currentElementType = 'image';
                console.log('[Element Select] Setting type to IMAGE - currentElementType =', currentElementType);
                const imageBtn = document.querySelector('[data-type="image"]');
                if (imageBtn) imageBtn.classList.add('active');
                document.getElementById('figure-settings').classList.add('hidden');
                document.getElementById('image-settings').classList.remove('hidden');
                
                // 画像情報を設定
                if (element.image_path) {
                    const imgDisplay = document.getElementById('image-display-img');
                    if (imgDisplay) imgDisplay.src = element.image_path;
                }
                
                document.getElementById('image-x').value = element.x_position || 0;
                document.getElementById('image-y').value = element.y_position || 0;
                
            } else {
                currentElementType = 'figure';
                console.log('[Element Select] Setting type to FIGURE - currentElementType =', currentElementType);
                const figureBtn = document.querySelector('[data-type="figure"]');
                if (figureBtn) figureBtn.classList.add('active');
                document.getElementById('figure-settings').classList.remove('hidden');
                document.getElementById('image-settings').classList.add('hidden');
                
                // 図形情報を設定
                document.getElementById('figure-type').value = element.element_type || 'rectangle';
                document.getElementById('figure-color').value = element.stroke_color || '#000000';
                
                // 座標（必要に応じて）
                // document.getElementById('figure-x').value = element.x_position || 0;
                // document.getElementById('figure-y').value = element.y_position || 0;
            }

            // 追加ボタンを非表示、更新ボタンを表示
            const addBtn = document.getElementById('add-visual');
            const updateBtn = document.getElementById('update-visual');
            if (addBtn) addBtn.style.display = 'none';
            if (updateBtn) updateBtn.style.display = 'block';
        }

        // ========== 初期状態：要素一覧を読み込み ==========
        // DOM がレンダリングされた後に実行
        setTimeout(() => {
            console.log('[Visual] 初期化: loadVisualElements を実行します');
            loadVisualElements();
        }, 50);

        // ストレージ更新時に要素一覧を再読み込み
        window.addEventListener('storage', (event) => {
            if (event.key === MAPPING_SYNC_KEY || event.key === CURRENT_GROUP_KEY) {
                console.log('[Visual] ストレージ更新をキャッチ:', event.key);
                loadVisualElements();
            }
        });

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
                    
                    console.log('[Type Button] クリック:', type, '-> currentElementType =', currentElementType);
                    console.log('[Type Button] typeButtons.length =', typeButtons.length);
                    
                    typeButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // 設定パネルの表示切り替え
                    const figureSettings = document.getElementById('figure-settings');
                    const imageSettings = document.getElementById('image-settings');
                    
                    console.log('[Type Button] figureSettings:', figureSettings ? 'found' : 'NOT FOUND');
                    console.log('[Type Button] imageSettings:', imageSettings ? 'found' : 'NOT FOUND');
                    
                    if (figureSettings) figureSettings.classList.toggle('hidden', type !== 'figure');
                    if (imageSettings) imageSettings.classList.toggle('hidden', type !== 'image');
                    
                    console.log('[Type Button] figureSettings.hidden =', figureSettings?.classList.contains('hidden'));
                    console.log('[Type Button] imageSettings.hidden =', imageSettings?.classList.contains('hidden'));
                });
            });
        } else {
            console.log('[Type Button] ERROR: typeButtons.length = 0! typeButtons not found!');
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
                console.log('[Figure Type Change] figureType =', figureType, ', polygonPointsList =', polygonPointsList);
                
                // エディタコンテナの表示切り替え
                const rectEditor = document.getElementById('rectangle-editor-container');
                const polyEditor = document.getElementById('polygon-editor-container');
                const textEditor = document.getElementById('text-editor-container');
                
                console.log('[Figure Type Change] Before: rect=' + (rectEditor?.style.display), ', poly=' + (polyEditor?.style.display));
                
                if (rectEditor) rectEditor.style.display = figureType === 'rectangle' ? 'block' : 'none';
                if (polyEditor) polyEditor.style.display = figureType === 'polygon' ? 'block' : 'none';
                if (textEditor) textEditor.style.display = figureType === 'text' ? 'block' : 'none';
                
                console.log('[Figure Type Change] After: rect=' + (rectEditor?.style.display), ', poly=' + (polyEditor?.style.display));
                
                // JSON フォーマットを初期化（非表示）
                if (figureType === 'rectangle') {
                    const rectData = {
                        type: 'rectangle',
                        x: parseInt(document.getElementById('rect-x')?.value || 50),
                        y: parseInt(document.getElementById('rect-y')?.value || 50),
                        width: parseInt(document.getElementById('rect-width')?.value || 200),
                        height: parseInt(document.getElementById('rect-height')?.value || 150),
                        strokeColor: document.getElementById('rect-stroke-color')?.value || '#000000',
                        fillColor: document.getElementById('rect-fill-color')?.value || '#007BFF',
                        strokeWidth: parseInt(document.getElementById('rect-stroke-width')?.value || 2)
                    };
                    
                    // プレビューを送信
                    localStorage.setItem('previewElement', JSON.stringify(rectData));
                    localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                    console.log('[Shape Preview] 矩形プレビュー送信:', rectData);
                    
                    // ローカルプレビューも更新
                    updateLocalPreview('rectangle', rectData);
                    
                    // shape_data を hidden input に保存
                    const shapeData = JSON.stringify({ type: 'rectangle', rect: { 
                        x: rectData.x, y: rectData.y, width: rectData.width, height: rectData.height 
                    }});
                    const shapeDataInput = document.getElementById('shape-data-hidden');
                    if (shapeDataInput) shapeDataInput.value = shapeData;
                    
                } else if (figureType === 'polygon') {
                    console.log('[Shape Preview] 多角形プレビュー作成中... polygonPointsList =', polygonPointsList);
                    
                    const polyData = {
                        type: 'polygon',
                        points: polygonPointsList,
                        strokeColor: document.getElementById('polygon-stroke-color')?.value || '#000000',
                        fillColor: document.getElementById('polygon-fill-color')?.value || '#FF0000',
                        strokeWidth: parseInt(document.getElementById('polygon-stroke-width')?.value || 2)
                    };
                    
                    console.log('[Shape Preview] 多角形データを JSON.stringify...', JSON.stringify(polyData));
                    
                    // プレビューを送信
                    localStorage.setItem('previewElement', JSON.stringify(polyData));
                    localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                    console.log('[Shape Preview] 多角形プレビュー送信完了:', polyData);
                    
                    // ローカルプレビューも更新
                    updateLocalPreview('polygon', polyData);
                    
                    // shape_data を hidden input に保存
                    const shapeDataPoly = JSON.stringify({ type: 'polygon', points: polygonPointsList });
                    const shapeDataInputPoly = document.getElementById('shape-data-hidden');
                    if (shapeDataInputPoly) shapeDataInputPoly.value = shapeDataPoly;
                    
                    // ポリゴンポイントリストを表示
                    setTimeout(() => {
                        renderPolygonPointsList();
                    }, 50);
                }
                
                console.log('[Figure Type] 変更完了: ' + figureType);
            });
        } else {
            console.log('[Figure Type Select] ERROR: figure-type element not found!');
        }

        // ========== 矩形エディタのリアルタイム更新 ==========
        const rectInputs = ['rect-x', 'rect-y', 'rect-width', 'rect-height', 'rect-stroke-color', 'rect-fill-color', 'rect-stroke-width'];
        rectInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', updateRectanglePreview);
                input.addEventListener('input', updateRectanglePreview);
            }
        });

        function updateRectanglePreview() {
            const x = parseInt(document.getElementById('rect-x')?.value || 50);
            const y = parseInt(document.getElementById('rect-y')?.value || 50);
            const width = parseInt(document.getElementById('rect-width')?.value || 200);
            const height = parseInt(document.getElementById('rect-height')?.value || 150);
            const strokeColor = document.getElementById('rect-stroke-color')?.value || '#000000';
            const fillColor = document.getElementById('rect-fill-color')?.value || '#007BFF';
            const strokeWidth = parseInt(document.getElementById('rect-stroke-width')?.value || 2);
            
            const rectData = {
                type: 'rectangle',
                x, y, width, height,
                strokeColor,
                fillColor,
                strokeWidth
            };
            
            // プレビュー送信
            localStorage.setItem('previewElement', JSON.stringify(rectData));
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
            console.log('[Rect Preview] 更新:', rectData);
            
            // ローカルプレビュー表示（register_figure 内）
            updateLocalPreview('rectangle', rectData);
            
            // shape_data を hidden input に保存
            const shapeData = JSON.stringify({ type: 'rectangle', rect: { x, y, width, height } });
            const shapeDataInput = document.getElementById('shape-data-hidden');
            if (shapeDataInput) shapeDataInput.value = shapeData;
        }

        // ========== 多角形エディタのリアルタイム更新 ==========
        const polygonInputs = ['polygon-stroke-color', 'polygon-fill-color', 'polygon-stroke-width'];
        polygonInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('change', updatePolygonPreview);
                input.addEventListener('input', updatePolygonPreview);
            }
        });

        // 多角形の頂点を管理する配列（初期値：四角形）
        let polygonPointsList = [[50, 50], [250, 50], [250, 200], [50, 200]];

        function updatePolygonPreview() {
            const strokeColor = document.getElementById('polygon-stroke-color')?.value || '#000000';
            const fillColor = document.getElementById('polygon-fill-color')?.value || '#FF0000';
            const strokeWidth = parseInt(document.getElementById('polygon-stroke-width')?.value || 2);
            
            const polyData = {
                type: 'polygon',
                points: polygonPointsList,
                strokeColor,
                fillColor,
                strokeWidth
            };
            
            // プレビュー送信
            localStorage.setItem('previewElement', JSON.stringify(polyData));
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
            console.log('[Polygon Preview] 更新:', polyData);
            
            // ローカルプレビューを表示
            updateLocalPreview('polygon', polyData);
            
            // shape_data を hidden input に保存
            const shapeData = JSON.stringify({ type: 'polygon', points: polygonPointsList });
            const shapeDataInput = document.getElementById('shape-data-hidden');
            if (shapeDataInput) shapeDataInput.value = shapeData;
        }

        /**
         * register_figure のプレビュー SVG を更新
         */
        function updateLocalPreview(shapeType, shapeData) {
            const previewSvg = document.getElementById('figure-preview');
            if (!previewSvg) {
                console.warn('[Preview] figure-preview SVG が見つかりません');
                return;
            }

            // SVG をクリア
            previewSvg.innerHTML = '';

            try {
                if (shapeType === 'rectangle') {
                    const x = shapeData.x || 0;
                    const y = shapeData.y || 0;
                    const width = shapeData.width || 200;
                    const height = shapeData.height || 150;
                    const strokeColor = shapeData.strokeColor || '#000000';
                    const fillColor = shapeData.fillColor || '#FFFFFF';
                    const strokeWidth = shapeData.strokeWidth || 2;

                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', x);
                    rect.setAttribute('y', y);
                    rect.setAttribute('width', width);
                    rect.setAttribute('height', height);
                    rect.setAttribute('fill', fillColor);
                    rect.setAttribute('stroke', strokeColor);
                    rect.setAttribute('stroke-width', strokeWidth);

                    previewSvg.appendChild(rect);
                    console.log('[Preview] 矩形描画:', { x, y, width, height });

                } else if (shapeType === 'polygon') {
                    const points = shapeData.points || [];
                    const pointsStr = points.map(p => `${p[0]},${p[1]}`).join(' ');
                    const strokeColor = shapeData.strokeColor || '#000000';
                    const fillColor = shapeData.fillColor || '#FFFFFF';
                    const strokeWidth = shapeData.strokeWidth || 2;

                    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', pointsStr);
                    polygon.setAttribute('fill', fillColor);
                    polygon.setAttribute('stroke', strokeColor);
                    polygon.setAttribute('stroke-width', strokeWidth);

                    previewSvg.appendChild(polygon);
                    console.log('[Preview] 多角形描画:', points);
                }
            } catch (error) {
                console.error('[Preview] SVG 描画エラー:', error);
            }
        }

        // ========== 多角形頂点管理 ==========
        const addPointBtn = document.getElementById('polygon-add-point');
        if (addPointBtn) {
            addPointBtn.addEventListener('click', () => {
                const x = parseInt(document.getElementById('polygon-new-x')?.value || 0);
                const y = parseInt(document.getElementById('polygon-new-y')?.value || 0);
                
                polygonPointsList.push([x, y]);
                console.log('[Polygon] 頂点追加:', [x, y], 'リスト:', polygonPointsList);
                
                // 表示を更新
                renderPolygonPointsList();
                updatePolygonPreview();
            });
        }

        function renderPolygonPointsList() {
            const listDiv = document.getElementById('polygon-points-list');
            if (!listDiv) return;
            
            if (polygonPointsList.length === 0) {
                listDiv.innerHTML = '<p style="color: #999; margin: 0;">頂点がまだ追加されていません</p>';
                return;
            }
            
            let html = '<table style="width: 100%; font-size: 12px; border-collapse: collapse;">';
            html += '<thead><tr style="background: #f0f0f0;"><th style="text-align: left; padding: 4px;">No</th><th style="text-align: left; padding: 4px;">X</th><th style="text-align: left; padding: 4px;">Y</th><th style="text-align: center; padding: 4px;">削除</th></tr></thead>';
            html += '<tbody>';
            
            polygonPointsList.forEach((point, index) => {
                html += `<tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 4px;">${index + 1}</td>
                    <td style="padding: 4px;"><input type="number" class="polygon-point-x" value="${point[0]}" data-index="${index}" style="width: 60px; padding: 2px; font-size: 11px;"></td>
                    <td style="padding: 4px;"><input type="number" class="polygon-point-y" value="${point[1]}" data-index="${index}" style="width: 60px; padding: 2px; font-size: 11px;"></td>
                    <td style="text-align: center; padding: 4px;"><button class="polygon-delete-point" data-index="${index}" style="padding: 2px 4px; font-size: 11px;">削除</button></td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            listDiv.innerHTML = html;
            
            // イベントリスナーを追加
            document.querySelectorAll('.polygon-point-x, .polygon-point-y').forEach(input => {
                input.addEventListener('change', (e) => {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    if (e.target.classList.contains('polygon-point-x')) {
                        polygonPointsList[index][0] = parseInt(e.target.value);
                    } else {
                        polygonPointsList[index][1] = parseInt(e.target.value);
                    }
                    updatePolygonPreview();
                });
            });
            
            document.querySelectorAll('.polygon-delete-point').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    if (polygonPointsList.length > 3) {
                        polygonPointsList.splice(index, 1);
                        renderPolygonPointsList();
                        updatePolygonPreview();
                    } else {
                        alert('多角形には最低3つの頂点が必要です');
                    }
                });
            });
        }

        // 初期化時にポリゴンポイントを表示
        setTimeout(() => {
            const polyEditor = document.getElementById('polygon-editor-container');
            if (polyEditor && polyEditor.style.display !== 'none') {
                renderPolygonPointsList();
            }
            
            // 矩形エディタを初期表示
            const rectEditor = document.getElementById('rectangle-editor-container');
            if (rectEditor) {
                rectEditor.style.display = 'block';
            }
            
            // 初期プレビューを生成
            const rectData = {
                type: 'rectangle',
                x: parseInt(document.getElementById('rect-x')?.value || 50),
                y: parseInt(document.getElementById('rect-y')?.value || 50),
                width: parseInt(document.getElementById('rect-width')?.value || 200),
                height: parseInt(document.getElementById('rect-height')?.value || 150),
                strokeColor: document.getElementById('rect-stroke-color')?.value || '#000000',
                fillColor: document.getElementById('rect-fill-color')?.value || '#007BFF',
                strokeWidth: parseInt(document.getElementById('rect-stroke-width')?.value || 2)
            };
            localStorage.setItem('previewElement', JSON.stringify(rectData));
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
            console.log('[初期化] 矩形プレビューを生成:', rectData);
        }, 100);
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
        

        // カーソル移動ボタン（図形を表示先に投影・頂点編集可能）
        const cursorMoveBtn = document.getElementById('cursor-move');
        if (cursorMoveBtn) {
            cursorMoveBtn.addEventListener('click', async () => {
                try {
                    console.log('[カーソル移動] ボタンクリック！');
                    
                    // 現在の図形フォーム値を取得
                    const figureType = document.getElementById('figure-type')?.value || 'rectangle';
                    const displayTarget = document.getElementById('dest')?.value || 'monitor';
                    const strokeColor = document.getElementById('rect-stroke-color')?.value || 
                                      document.getElementById('polygon-stroke-color')?.value || '#000000';
                    const fillColor = document.getElementById('rect-fill-color')?.value ||
                                    document.getElementById('polygon-fill-color')?.value || '#FFFFFF';
                    const strokeWidth = parseInt(document.getElementById('rect-stroke-width')?.value || 
                                        document.getElementById('polygon-stroke-width')?.value || 2);

                    console.log('[カーソル移動] フォーム値:', { figureType, displayTarget, strokeColor, fillColor, strokeWidth });

                    // shape_data を計算
                    let shapeData = {};
                    if (figureType === 'rectangle') {
                        const x = parseInt(document.getElementById('rect-x')?.value || 100);
                        const y = parseInt(document.getElementById('rect-y')?.value || 100);
                        const width = parseInt(document.getElementById('rect-width')?.value || 200);
                        const height = parseInt(document.getElementById('rect-height')?.value || 150);
                        
                        shapeData = {
                            type: 'rectangle',
                            rect: { x, y, width, height }
                        };
                        console.log('[カーソル移動] 矩形データ:', shapeData);
                    } else if (figureType === 'polygon') {
                        // polygon の場合、hidden input から取得するか、デフォルト値を使う
                        const shapeDataStr = document.getElementById('shape-data-hidden')?.value || '{}';
                        try {
                            shapeData = JSON.parse(shapeDataStr);
                            // デフォルト値がない場合は、多角形を作成
                            if (!shapeData.points || shapeData.points.length === 0) {
                                shapeData = {
                                    type: 'polygon',
                                    points: [[100, 100], [300, 100], [300, 250], [100, 250]]
                                };
                            }
                            console.log('[カーソル移動] 多角形データ:', shapeData);
                        } catch (e) {
                            shapeData = {
                                type: 'polygon',
                                points: [[100, 100], [300, 100], [300, 250], [100, 250]]
                            };
                            console.log('[カーソル移動] 多角形データ（デフォルト）:', shapeData);
                        }
                    }

                    // 表示先に確定送信するデータ
                    const projectionData = {
                        action: 'projectShape',
                        type: figureType,
                        shape_data: shapeData,
                        stroke_color: strokeColor,
                        fill_color: fillColor,
                        stroke_width: strokeWidth,
                        displayTarget: displayTarget,
                        timestamp: Date.now(),
                        enableVertexEdit: true
                    };

                    console.log('[カーソル移動] 投影データ完成:', projectionData);
                    console.log('[カーソル移動] localStorage に保存中...');
                    
                    localStorage.setItem('projectionData', JSON.stringify(projectionData));
                    localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                    
                    console.log('[カーソル移動] ✅ localStorage に保存完了！');
                    console.log('[カーソル移動] 確認:', {
                        savedProjection: localStorage.getItem('projectionData'),
                        dispTarget: displayTarget
                    });

                    alert(`✅ 【${displayTarget}】に図形を投影しました！\n\nプロジェクター表示で頂点を編集できます：\n• ドラッグで頂点移動\n• プレビューは register_figure に表示されます`);
                } catch (error) {
                    console.error('[カーソル移動] エラー:', error);
                    alert(`❌ エラー: ${error.message}`);
                }
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
        
        // ディスプレイウィンドウを開くボタン（削除済み - 表示先に直接投影）
        // const openDisplayWindowBtn = document.getElementById('open-display-window');
        // if (openDisplayWindowBtn) {
        //     // 不要 - 現在は「カーソル移動」で直接投影
        // }

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
        
        // 表示ボタン（プレビュー表示のみ）
        const previewButton = document.getElementById('preview-visual');
        console.log('[Preview Button] 登録試行 - previewButton =', previewButton);
        
        if (previewButton) {
            console.log('[Preview Button] イベントリスナーを登録');
            previewButton.addEventListener('click', () => {
                try {
                    console.log('[表示ボタン] クリック');
                    
                    // display_target を取得
                    const destSelect = document.getElementById('dest');
                    const displayTarget = destSelect ? destSelect.value : 'monitor';
                    console.log('[表示ボタン] displayTarget =', displayTarget);
                    
                    const figureTypeSelect = document.getElementById('figure-type');
                    const figureType = figureTypeSelect ? figureTypeSelect.value : 'rectangle';
                    
                    console.log('[表示ボタン] figureType =', figureType);
                    console.log('[表示ボタン] polygonPointsList =', polygonPointsList);
                    
                    if (figureType === 'rectangle') {
                        const x = parseInt(document.getElementById('rect-x')?.value || 50);
                        const y = parseInt(document.getElementById('rect-y')?.value || 50);
                        const width = parseInt(document.getElementById('rect-width')?.value || 200);
                        const height = parseInt(document.getElementById('rect-height')?.value || 150);
                        const strokeColor = document.getElementById('rect-stroke-color')?.value || '#000000';
                        const fillColor = document.getElementById('rect-fill-color')?.value || '#007BFF';
                        const strokeWidth = parseInt(document.getElementById('rect-stroke-width')?.value || 2);
                        
                        const rectData = {
                            type: 'rectangle',
                            x, y, width, height,
                            strokeColor, fillColor, strokeWidth,
                            displayTarget
                        };
                        
                        console.log('[表示ボタン] localStorage.setItem("previewElement", ...) を実行');
                        localStorage.setItem('previewElement', JSON.stringify(rectData));
                        localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                        console.log('[表示ボタン] 矩形プレビューを送信:', rectData);
                        alert(`${displayTarget} ウィンドウに矩形を表示しました`);
                        
                    } else if (figureType === 'polygon') {
                        console.log('[表示ボタン] polygonPointsList.length =', polygonPointsList.length);
                        
                        if (polygonPointsList.length < 3) {
                            alert('多角形には最低3つの頂点が必要です');
                            return;
                        }
                        
                        const strokeColor = document.getElementById('polygon-stroke-color')?.value || '#000000';
                        const fillColor = document.getElementById('polygon-fill-color')?.value || '#FF0000';
                        const strokeWidth = parseInt(document.getElementById('polygon-stroke-width')?.value || 2);
                        
                        const polyData = {
                            type: 'polygon',
                            points: polygonPointsList,
                            strokeColor, fillColor, strokeWidth,
                            displayTarget
                        };
                        
                        console.log('[表示ボタン] localStorage.setItem("previewElement", ...) を実行');
                        localStorage.setItem('previewElement', JSON.stringify(polyData));
                        localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                        console.log('[表示ボタン] 多角形プレビューを送信:', polyData);
                        alert(`${displayTarget} ウィンドウに多角形を表示しました`);
                    }
                } catch (e) {
                    console.error('[表示ボタン] エラー:', e);
                    alert('[表示ボタン] エラー: ' + e.message);
                }
            });
        } else {
            console.log('[Preview Button] ERROR: preview-visual ボタンが見つかりません！');
        }
        
        // 追加ボタン
        const addButton = document.getElementById('add-visual');
        if (addButton) {
            console.log('[Add Button] イベントリスナーを登録');
            addButton.addEventListener('click', async () => {
                // === UI をリセット（要素選択履歴をクリア） ===
                console.log('[追加ボタン] UI リセット処理を実行');
                currentElementType = 'figure';  // 図形をデフォルトに
                selectedElementId = null;       // 選択要素をクリア
                
                // テーブル行の選択状態を最整
                document.querySelectorAll('.visual-element-row').forEach(row => {
                    row.style.backgroundColor = '';
                });
                
                // UI パネルを整理
                const figureSettings = document.getElementById('figure-settings');
                const imageSettings = document.getElementById('image-settings');
                if (figureSettings) figureSettings.classList.remove('hidden');
                if (imageSettings) imageSettings.classList.add('hidden');
                
                // type-btn の active クラスを設定
                const typeButtons = document.querySelectorAll('.type-btn');
                typeButtons.forEach(b => b.classList.remove('active'));
                const figureBtn = document.querySelector('[data-type="figure"]');
                if (figureBtn) figureBtn.classList.add('active');
                
                // 図形タイプを矩形に
                const figureTypeSelect = document.getElementById('figure-type');
                if (figureTypeSelect) figureTypeSelect.value = 'rectangle';
                
                // 矩形エディタを表示
                const rectEditor = document.getElementById('rectangle-editor-container');
                const polyEditor = document.getElementById('polygon-editor-container');
                if (rectEditor) rectEditor.style.display = 'block';
                if (polyEditor) polyEditor.style.display = 'none';
                
                console.log('[追加ボタン] UI リセット完了 - currentElementType =', currentElementType);
                
                console.log('');
                console.log('========== [追加ボタン] クリック ==========');
                console.log('currentElementType =', currentElementType);
                console.log('currentElementType === "figure" ?', currentElementType === 'figure');
                console.log('currentElementType === "image" ?', currentElementType === 'image');
                console.log('='.repeat(40));
                console.log('');
                
                // 現在選択中のグループIDを取得
                const currentGroupId = localStorage.getItem(CURRENT_GROUP_KEY);
                console.log('[追加ボタン] currentGroupId =', currentGroupId);
                
                if (!currentGroupId) {
                    alert('左側の表からグループを選択してください');
                    return;
                }
                
                const commentInput = document.getElementById('comment');
                const displayTargetInput = document.getElementById('dest');
                
                const comment = commentInput ? commentInput.value : '';
                const displayTarget = displayTargetInput ? displayTargetInput.value : 'monitor';
                
                console.log('[追加ボタン] displayTarget =', displayTarget, ', comment =', comment);
                console.log('[追加ボタン] currentElementType =', currentElementType);
                
                if (currentElementType === 'figure') {
                    // 図形要素を追加
                    const figureTypeSelect = document.getElementById('figure-type');
                    const figureType = figureTypeSelect ? figureTypeSelect.value : 'rectangle';
                    
                    console.log('[追加ボタン] figureType =', figureType);
                    
                    let shapeData = null;
                    let elementData = null;
                    
                    if (figureType === 'rectangle') {
                        // 矩形データを収集
                        const x = parseInt(document.getElementById('rect-x')?.value || 50);
                        const y = parseInt(document.getElementById('rect-y')?.value || 50);
                        const width = parseInt(document.getElementById('rect-width')?.value || 200);
                        const height = parseInt(document.getElementById('rect-height')?.value || 150);
                        const strokeColor = document.getElementById('rect-stroke-color')?.value || '#000000';
                        const fillColor = document.getElementById('rect-fill-color')?.value || '#007BFF';
                        const strokeWidth = parseInt(document.getElementById('rect-stroke-width')?.value || 2);
                        
                        console.log('[矩形] x=', x, ', y=', y, ', width=', width, ', height=', height);
                        
                        shapeData = {
                            type: 'rectangle',
                            rect: { x, y, width, height }
                        };
                        
                        elementData = {
                            group_id: parseInt(currentGroupId),
                            element_type: 'rectangle',
                            display_target: displayTarget,
                            x_position: x,
                            y_position: y,
                            shape_type: 'rectangle',
                            shape_data: JSON.stringify(shapeData),
                            stroke_color: strokeColor,
                            fill_color: fillColor,
                            stroke_width: strokeWidth,
                            element_comment: comment
                        };
                        
                        console.log('[矩形追加] リクエストデータ:', elementData);
                        
                    } else if (figureType === 'polygon') {
                        // 多角形データを収集
                        console.log('[多角形] polygonPointsList =', polygonPointsList);
                        
                        if (polygonPointsList.length < 3) {
                            alert('多角形には最低3つの頂点が必要です');
                            return;
                        }
                        
                        const strokeColor = document.getElementById('polygon-stroke-color')?.value || '#000000';
                        const fillColor = document.getElementById('polygon-fill-color')?.value || '#FF0000';
                        const strokeWidth = parseInt(document.getElementById('polygon-stroke-width')?.value || 2);
                        
                        shapeData = {
                            type: 'polygon',
                            points: polygonPointsList
                        };
                        
                        // 矩形領域を計算（バウンディングボックス）
                        const xs = polygonPointsList.map(p => p[0]);
                        const ys = polygonPointsList.map(p => p[1]);
                        const minX = Math.min(...xs);
                        const minY = Math.min(...ys);
                        
                        elementData = {
                            group_id: parseInt(currentGroupId),
                            element_type: 'polygon',
                            display_target: displayTarget,
                            x_position: minX,
                            y_position: minY,
                            shape_type: 'polygon',
                            shape_data: JSON.stringify(shapeData),
                            stroke_color: strokeColor,
                            fill_color: fillColor,
                            stroke_width: strokeWidth,
                            element_comment: comment
                        };
                        
                        console.log('[多角形追加] リクエストデータ:', elementData);
                    }
                    
                    if (!elementData) {
                        alert('図形タイプが無効です');
                        return;
                    }
                    
                    // DB に登録
                    try {
                        console.log('[追加] POST /mapping/api/group_elements を実行中...');
                        
                        const response = await fetch('/mapping/api/group_elements', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(elementData)
                        });
                        
                        console.log('[追加] HTTP ステータス:', response.status);
                        
                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error('[追加] エラーレスポンス:', errorText);
                            throw new Error(`HTTP ${response.status}: ${errorText}`);
                        }
                        
                        const result = await response.json();
                        console.log('[図形登録成功]:', result);
                        alert(figureType === 'polygon' ? '多角形を追加しました' : '矩形を追加しました');
                        
                        // ストレージをクリアして再読み込み
                        localStorage.removeItem('previewElement');
                        localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
                        
                        // フォームをクリア
                        if (commentInput) commentInput.value = '';
                        
                        // 要素一覧を再読込
                        loadVisualElements();
                        
                    } catch (error) {
                        console.error('[図形登録エラー]:', error);
                        alert('図形の登録に失敗しました: ' + error.message);
                    }
                    
                } else if (currentElementType === 'image') {
                    // 画像要素を追加（既存ロジック）
                    console.log('[画像] 画像機能はまだ実装中です');
                    alert('画像機能はまだ実装中です');
                }
            });
        }

        // 削除ボタン
        const deleteButton = document.getElementById('delete-visual');
        if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
                if (!selectedElementId) {
                    alert('削除する要素を選択してください');
                    return;
                }

                const confirmed = confirm('この要素を削除しますか？');
                if (!confirmed) return;

                try {
                    console.log('[要素削除] ID:', selectedElementId);

                    const response = await fetch(`/mapping/api/elements/${selectedElementId}`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        console.log('[要素削除成功]');
                        alert('要素を削除しました');

                        // 要素一覧を再読み込み
                        const groupId = localStorage.getItem(CURRENT_GROUP_KEY);
                        if (groupId) {
                            loadVisualElements();
                        }

                        // フォームをリセット
                        selectedElementId = null;
                        document.getElementById('add-visual').style.display = 'block';
                        document.getElementById('update-visual').style.display = 'none';
                    } else {
                        const error = await response.json();
                        console.error('[要素削除エラー]:', error);
                        alert('要素の削除に失敗しました: ' + (error.error || error));
                    }
                } catch (error) {
                    console.error('[要素削除リクエストエラー]:', error);
                    alert('要素の削除に失敗しました');
                }
            });
        }
        
        // 更新ボタン
        const updateButton = document.getElementById('update-visual');
        if (updateButton) {
            updateButton.addEventListener('click', async () => {
                if (!selectedElementId) {
                    alert('更新する要素を選択してください');
                    return;
                }

                try {
                    const displayTargetSelect = document.getElementById('dest');
                    const commentInput = document.getElementById('comment');
                    
                    const displayTarget = displayTargetSelect ? displayTargetSelect.value : '';
                    const comment = commentInput ? commentInput.value : '';

                    let updateData = {
                        display_target: displayTarget,
                        element_comment: comment
                    };

                    // 要素タイプ別の更新データ
                    if (currentElementType === 'image') {
                        // 画像の場合
                        const imageX = parseInt(document.getElementById('image-x')?.value || 0);
                        const imageY = parseInt(document.getElementById('image-y')?.value || 0);
                        
                        updateData.x_position = imageX;
                        updateData.y_position = imageY;
                    } else {
                        // 図形の場合
                        const figureType = document.getElementById('figure-type')?.value || 'rectangle';
                        const figureColor = document.getElementById('figure-color')?.value || '#000000';
                        
                        updateData.element_type = figureType;
                        updateData.stroke_color = figureColor;
                    }

                    console.log('[要素更新] ID:', selectedElementId, 'データ:', updateData);

                    const response = await fetch(`/mapping/api/elements/${selectedElementId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updateData)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log('[要素更新成功]:', result);
                        alert('要素を更新しました');

                        // 要素一覧を再読み込み
                        const groupId = localStorage.getItem(CURRENT_GROUP_KEY);
                        if (groupId) {
                            loadVisualElements();
                        }

                        // フォームをリセット
                        selectedElementId = null;
                        document.getElementById('add-visual').style.display = 'block';
                        document.getElementById('update-visual').style.display = 'none';
                    } else {
                        const error = await response.json();
                        console.error('[要素更新エラー]:', error);
                        alert('要素の更新に失敗しました: ' + (error.error || error));
                    }
                } catch (error) {
                    console.error('[要素更新リクエストエラー]:', error);
                    alert('要素の更新に失敗しました');
                }
            });
        }
        
        // クリアボタン（フォームをリセット）
        const clearButton = document.getElementById('clear-visual');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                // フォーム要素をリセット
                document.getElementById('dest').value = 'monitor';
                document.getElementById('comment').value = '';
                document.getElementById('figure-type').value = 'rectangle';
                document.getElementById('figure-color').value = '#007BFF';
                
                // 選択状態を解除
                selectedElementId = null;
                document.querySelectorAll('.visual-element-row').forEach(row => {
                    row.style.backgroundColor = '';
                });
                
                // ボタン状態をリセット
                document.getElementById('add-visual').style.display = 'block';
                document.getElementById('update-visual').style.display = 'none';
                
                console.log('[クリア] フォームと選択状態をリセット');
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
