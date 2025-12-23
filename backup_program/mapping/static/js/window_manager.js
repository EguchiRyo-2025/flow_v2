/**
 * WindowManager - コンポーネントのレンダリングとタブ管理を行うクラス
 */
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

        const response = await fetch(`/components/${fileName}`);
        
        if (!response.ok) {
            throw new Error(`HTTPエラー: ${response.status}`);
        }

        return await response.text();
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
            cursorMoveBtn.addEventListener('click', () => {
                const xPos = parseInt(xValueInput?.value) || 0;
                const yPos = parseInt(yValueInput?.value) || 0;
                console.log(`カーソル移動: X=${xPos}, Y=${yPos}`);
                // TODO: カーソル移動の実装
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
                // 現在選択中の要素を取得
                const currentElement = window.elementManager?.currentElement;
                
                if (!currentElement) {
                    alert('要素が選択されていません。右側の表から要素をクリックして選択してください。');
                    return;
                }
                
                // 要素の中心座標を計算
                const centerX = currentElement.x + (currentElement.width / 2);
                const centerY = currentElement.y + (currentElement.height / 2);
                const displayTarget = currentElement.display_target;
                
                console.log(`カーソル移動: 要素ID=${currentElement.id}, 中心=(${centerX}, ${centerY}), 表示先=${displayTarget}`);
                
                try {
                    // サーバーのマウス移動APIを呼び出し
                    const response = await fetch('/api/move_cursor', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            x: centerX,
                            y: centerY,
                            display_target: displayTarget
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log('マウス移動成功:', result);
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
                    
                    const response = await fetch('/api/upload/image', {
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
                        console.log(`画像アップロード成功 [${mode}]:`, imageData);
                        
                        // 画像選択時に即座にDBへ登録し、ディスプレイに表示
                        await registerAndDisplayImage(imageData, mode);
                        
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
                const response = await fetch('/api/group_elements', {
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
                    localStorage.setItem('currentGroupId', currentGroupId);
                    
                    // 要素テーブルを再読み込み
                    if (window.elementManager) {
                        await window.elementManager.loadElements(currentGroupId);
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
                } else {
                    // 画像の場合
                    const imageData = uploadedImageData[currentVisualState];
                    
                    if (!imageData) {
                        alert('画像ファイルを選択してください');
                        return;
                    }
                    
                    // DBに登録
                    try {
                        // 座標と拡大縮小の値を取得
                        const xPos = parseInt(document.getElementById('image-x')?.value || 0);
                        const yPos = parseInt(document.getElementById('image-y')?.value || 0);
                        const scale = parseFloat(document.getElementById('image-scale')?.value || 1.0);
                        const rotation = parseFloat(document.getElementById('image-rotation')?.value || 0);
                        
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
                        
                        const response = await fetch('/api/group_elements', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(requestData)
                        });
                        
                        if (!response.ok) {
                            throw new Error('DB登録に失敗しました');
                        }
                        
                        const result = await response.json();
                        console.log('DB登録成功:', result);
                        
                        // 要素一覧を再読み込み
                        if (window.elementManager) {
                            await window.elementManager.loadElements(currentGroupId);
                        }
                        
                        alert('画像を追加しました');
                        
                    } catch (error) {
                        console.error('DB登録エラー:', error);
                        alert('画像の登録に失敗しました');
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
            deleteButton.addEventListener('click', () => {
                const visualListId = currentVisualState === 'on' ? 'visual-list-on' : 'visual-list-off';
                const visualList = document.getElementById(visualListId);
                
                if (visualList) {
                    const selectedRow = visualList.querySelector('tr.selected');
                    if (selectedRow) {
                        const visualId = selectedRow.getAttribute('data-id');
                        selectedRow.remove();
                        console.log(`要素を削除 [${currentVisualState.toUpperCase()}]: ID=${visualId}`);
                    } else {
                        alert('削除する要素を選択してください');
                    }
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
}

// DOMContentLoaded後にWindowManagerを初期化
document.addEventListener('DOMContentLoaded', () => {
    window.windowManager = new WindowManager();
});
