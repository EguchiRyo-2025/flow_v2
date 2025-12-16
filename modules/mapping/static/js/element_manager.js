/**
 * 要素管理クラス（右ペイン）
 */

var CURRENT_GROUP_KEY = 'currentGroupId';
var SELECTED_ELEMENT_KEY = 'selectedElementId';
var MAPPING_SYNC_KEY = 'mappingLastUpdate';

class ElementManager {
    constructor() {
        this.currentGroupId = null;
        this.currentState = 'on'; // 'on' or 'off'
        this.currentElementId = null; // 選択中の要素ID
        this.currentElement = null; // 選択中の要素オブジェクト
        this.elements = { on: [], off: [] };
        this.init();
    }

    init() {
        // localStorageから現在のグループIDを復元
        const storedGroupId = localStorage.getItem(CURRENT_GROUP_KEY);
        if (storedGroupId) {
            this.currentGroupId = parseInt(storedGroupId, 10);
            console.log('[ElementManager] localStorageからグループID復元:', this.currentGroupId);
        }
        
        this.setupEventListeners();
        this.registerStorageListeners();
    }

    registerStorageListeners() {
        window.addEventListener('storage', (event) => {
            if (!event) {
                return;
            }

            if (event.key === MAPPING_SYNC_KEY && this.currentGroupId) {
                this.loadElements(this.currentGroupId);
            }

            if (event.key === SELECTED_ELEMENT_KEY) {
                const parsed = parseInt(event.newValue, 10);
                const elementId = Number.isNaN(parsed) ? null : parsed;
                this.highlightRow(elementId);
            }
        });
    }

    /**
     * 現在選択中のグループIDを取得
     */
    getCurrentGroupId() {
        return this.currentGroupId;
    }

    /**
     * グループの要素を読み込み
     */
    async loadElements(groupId) {
        this.currentGroupId = groupId;

        try {
            // ON要素を取得
            const onResponse = await fetch(`/mapping/api/groups/${groupId}/elements?state=on`);
            if (onResponse.ok) {
                this.elements.on = await onResponse.json();
            }

            // OFF要素を取得
            const offResponse = await fetch(`/mapping/api/groups/${groupId}/elements?state=off`);
            if (offResponse.ok) {
                this.elements.off = await offResponse.json();
            }

            this.renderElements();
        } catch (error) {
            console.error('要素読み込みエラー:', error);
        }
    }

    /**
     * 要素一覧を描画
     */
    renderElements() {
        this.renderElementTable('on');
        this.renderElementTable('off');
        this.highlightRowFromStorage();
    }

    highlightRowFromStorage() {
        const stored = parseInt(localStorage.getItem(SELECTED_ELEMENT_KEY), 10);
        const elementId = Number.isNaN(stored) ? null : stored;
        
        // localStorageに何もなければ選択しない
        if (!elementId) {
            const addBtn = document.getElementById('add-visual');
            const updateBtn = document.getElementById('update-visual');
            if (addBtn) addBtn.style.display = 'inline-block';
            if (updateBtn) updateBtn.style.display = 'none';
            return;
        }
        
        this.highlightRow(elementId);
    }

    highlightRow(elementId) {
        const rows = document.querySelectorAll('.visual-table tbody tr');
        rows.forEach(row => row.classList.remove('selected'));

        if (!elementId) {
            this.currentElementId = null;
            this.currentElement = null;
            const addBtn = document.getElementById('add-visual');
            const updateBtn = document.getElementById('update-visual');
            if (addBtn) addBtn.style.display = 'inline-block';
            if (updateBtn) updateBtn.style.display = 'none';
            return;
        }

        const targetRow = document.querySelector(`.visual-table tbody tr[data-element-id="${elementId}"]`);
        if (!targetRow) {
            this.currentElementId = null;
            this.currentElement = null;
            const addBtn = document.getElementById('add-visual');
            const updateBtn = document.getElementById('update-visual');
            if (addBtn) addBtn.style.display = 'inline-block';
            if (updateBtn) updateBtn.style.display = 'none';
            return;
        }

        targetRow.classList.add('selected');

        const element = this.findElementById(elementId);
        if (element) {
            this.currentElementId = elementId;
            this.currentElement = element;
            this.loadElementToForm(element);

            const addBtn = document.getElementById('add-visual');
            const updateBtn = document.getElementById('update-visual');
            if (addBtn) addBtn.style.display = 'none';
            if (updateBtn) updateBtn.style.display = 'inline-block';
        }
    }

    findElementById(elementId) {
        const normalizedId = parseInt(elementId, 10);
        if (Number.isNaN(normalizedId)) {
            return null;
        }

        const allElements = [
            ...(this.elements.on || []),
            ...(this.elements.off || [])
        ];

        return allElements.find(elem => parseInt(elem.id, 10) === normalizedId) || null;
    }

    notifyDisplayUpdate() {
        try {
            localStorage.setItem(MAPPING_SYNC_KEY, Date.now().toString());
        } catch (error) {
            console.warn('Failed to broadcast mapping update:', error);
        }
    }

    /**
     * 指定状態の要素テーブルを描画
     */
    renderElementTable(state) {
        console.log(`renderElementTable(${state}) 呼び出し`);
        const tbody = document.getElementById(`visual-list-${state}`);
        console.log(`tbody#visual-list-${state}:`, tbody);
        
        if (!tbody) {
            console.error(`tbody#visual-list-${state} が見つかりません！`);
            return;
        }

        tbody.innerHTML = '';
        const elements = this.elements[state] || [];
        console.log(`${state}要素数:`, elements.length);
        
        // テーブルコンテナの空白部分をクリックしたら選択解除
        const tableContainer = tbody.closest('.visual-table-container');
        if (tableContainer) {
            tableContainer.addEventListener('click', (e) => {
                // テーブルの行以外をクリックした場合
                if (e.target === tableContainer || e.target.tagName === 'TABLE' || 
                    e.target.tagName === 'THEAD' || e.target.tagName === 'TBODY') {
                    this.resetForm();
                }
            });
        }

        elements.forEach((elem, index) => {
            const row = tbody.insertRow();
            row.setAttribute('data-element-id', elem.id);
            
            const typeLabel = elem.element_type === 'image' ? '画像' : '図形';
            const fileName = elem.file_path ? elem.file_path.split('/').pop() : '';
            const content = `${fileName} (${elem.x_position}, ${elem.y_position}) ${elem.scale}x`;

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${typeLabel}</td>
                <td>${content}</td>
                <td>${elem.element_comment || ''}</td>
            `;

            // 行クリックで選択
            row.addEventListener('click', () => {
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
                this.currentElementId = elem.id;
                this.currentElement = elem; // 要素オブジェクトを保存
                this.loadElementToForm(elem);
                
                // 選択中の要素IDをlocalStorageに保存（ディスプレイウィンドウで使用）
                localStorage.setItem(SELECTED_ELEMENT_KEY, elem.id);
                
                // 追加ボタンを非表示、更新ボタンを表示
                const addBtn = document.getElementById('add-visual');
                const updateBtn = document.getElementById('update-visual');
                if (addBtn) addBtn.style.display = 'none';
                if (updateBtn) updateBtn.style.display = 'inline-block';
            });
            
            // ダブルクリックでカーソルを要素の位置に移動
            row.addEventListener('dblclick', async () => {
                try {
                    // 要素の中心座標を計算
                    const centerX = (elem.x_position || 0) + ((elem.image_width || elem.width || 200) / 2);
                    const centerY = (elem.y_position || 0) + ((elem.image_height || elem.height || 200) / 2);
                    
                    const response = await fetch('/mapping/api/move_cursor', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            x: centerX,
                            y: centerY,
                            display_target: elem.display_target 
                        })
                    });
                    
                    const result = await response.json();
                    if (result.status === 'ok') {
                        console.log('Cursor moved to element position:', result.moved_to);
                    } else {
                        console.warn('Cursor movement failed:', result.error);
                    }
                } catch (error) {
                    console.error('Cursor movement error:', error);
                }
            });
        });
    }

    /**
     * 要素情報をフォームに読み込む
     */
    loadElementToForm(elem) {
        console.log('要素をフォームに読み込み:', elem);
        
        // currentElementを更新（カーソル移動用）
        this.currentElement = {
            id: elem.id,
            x: elem.x_position || 0,
            y: elem.y_position || 0,
            width: elem.image_width || elem.width || 0,
            height: elem.image_height || elem.height || 0,
            display_target: elem.display_target
        };
        
        // 画像の場合
        if (elem.element_type === 'image' && elem.file_path) {
            // 要素タイプを画像に切り替え
            const imageTypeBtn = document.querySelector('.type-btn[data-type="image"]');
            if (imageTypeBtn) {
                imageTypeBtn.click();
            }
            
            // 座標とスケールを設定
            const xInput = document.getElementById('image-x');
            const yInput = document.getElementById('image-y');
            const scaleSlider = document.getElementById('image-scale');
            const scaleValue = document.getElementById('scale-value');
            const rotationSlider = document.getElementById('image-rotation');
            const rotationValue = document.getElementById('rotation-value');
            const commentInput = document.getElementById('comment');
            const destSelect = document.getElementById('dest');
            
            if (xInput) xInput.value = elem.x_position || 0;
            if (yInput) yInput.value = elem.y_position || 0;
            if (scaleSlider) scaleSlider.value = elem.scale || 1.0;
            if (scaleValue) scaleValue.textContent = (elem.scale || 1.0).toFixed(1);
            if (rotationSlider) rotationSlider.value = elem.rotation || 0;
            if (rotationValue) rotationValue.textContent = elem.rotation || 0;
            if (commentInput) commentInput.value = elem.element_comment || '';
            if (destSelect) destSelect.value = elem.display_target || 'monitor';
            
            // 画像プレビューを表示
            const displayImg = document.getElementById('image-display-img');
            const imageDimensions = document.getElementById('image-dimensions');
            if (displayImg && elem.file_path) {
                displayImg.src = '/' + elem.file_path;
            }
            if (imageDimensions && elem.image_width && elem.image_height) {
                imageDimensions.textContent = `${elem.image_width} × ${elem.image_height} px`;
            }
        }
    }

    /**
     * 現在選択中の要素を削除
     */
    async deleteCurrentElement() {
        if (!this.currentElementId) {
            console.log('要素が選択されていません');
            return false;
        }
        
        try {
            const response = await fetch(`/mapping/api/elements/${this.currentElementId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                console.log('要素削除成功');
                this.currentElementId = null;
                this.currentElement = null;
                // localStorageからも削除
                localStorage.removeItem(SELECTED_ELEMENT_KEY);
                 this.notifyDisplayUpdate();
                // 要素一覧を再読み込み
                await this.loadElements(this.currentGroupId);
                this.resetForm();
                return true;
            } else {
                const error = await response.json();
                console.error('要素削除エラー:', error);
                alert('要素の削除に失敗しました');
            }
        } catch (error) {
            console.error('要素削除エラー:', error);
            alert('要素の削除に失敗しました');
        }
        return false;
    }

    /**
     * 現在選択中の要素を更新
     */
    async updateCurrentElement() {
        if (!this.currentElementId) {
            console.log('要素が選択されていません');
            return false;
        }
        
        const xInput = document.getElementById('image-x');
        const yInput = document.getElementById('image-y');
        const scaleSlider = document.getElementById('image-scale');
        const rotationSlider = document.getElementById('image-rotation');
        const commentInput = document.getElementById('comment');
        const destSelect = document.getElementById('dest');
        
        const updateData = {
            x_position: parseInt(xInput?.value || 0),
            y_position: parseInt(yInput?.value || 0),
            scale: parseFloat(scaleSlider?.value || 1.0),
            rotation: parseFloat(rotationSlider?.value || 0),
            element_comment: commentInput?.value || '',
            display_target: destSelect?.value || 'monitor'
        };
        
        try {
            const response = await fetch(`/mapping/api/elements/${this.currentElementId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                console.log('要素更新成功');
                this.notifyDisplayUpdate();
                // 要素一覧を再読み込み
                await this.loadElements(this.currentGroupId);
                return true;
            }
        } catch (error) {
            console.error('要素更新エラー:', error);
        }
        return false;
    }

    /**
     * 要素一覧をクリア
     */
    clearElements() {
        this.currentGroupId = null;
        this.currentElementId = null;
        this.elements = { on: [], off: [] };
        this.renderElements();
        this.resetForm();
    }
    
    /**
     * フォームをリセット（新規追加モードに戻す）
     */
    resetForm() {
        this.currentElementId = null;
        this.currentElement = null;
        
        // テーブルの選択状態を解除
        const tbody = document.querySelector('#elements-table tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        }
        
        // localStorageから選択状態を削除
        localStorage.removeItem(SELECTED_ELEMENT_KEY);
        
        // フォームの値をクリア
        const xInput = document.getElementById('image-x');
        const yInput = document.getElementById('image-y');
        const scaleSlider = document.getElementById('image-scale');
        const scaleValue = document.getElementById('scale-value');
        const rotationSlider = document.getElementById('image-rotation');
        const rotationValue = document.getElementById('rotation-value');
        const commentInput = document.getElementById('comment');
        const displayImg = document.getElementById('image-display-img');
        
        if (xInput) xInput.value = 0;
        if (yInput) yInput.value = 0;
        if (scaleSlider) scaleSlider.value = 1.0;
        if (scaleValue) scaleValue.textContent = '1.0';
        if (rotationSlider) rotationSlider.value = 0;
        if (rotationValue) rotationValue.textContent = '0';
        if (commentInput) commentInput.value = '';
        if (displayImg) displayImg.src = '';
        
        // ボタンの表示を切り替え（追加ボタンを表示、更新ボタンを非表示）
        const addBtn = document.getElementById('add-visual');
        const updateBtn = document.getElementById('update-visual');
        if (addBtn) addBtn.style.display = 'inline-block';
        if (updateBtn) updateBtn.style.display = 'none';
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // ON/OFFタブ切り替え
        const visualTabs = document.querySelectorAll('.visual-tab');
        visualTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const state = tab.getAttribute('data-state');
                this.currentState = state;

                visualTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const onContainer = document.getElementById('on-visual-container');
                const offContainer = document.getElementById('off-visual-container');

                if (onContainer) onContainer.classList.toggle('hidden', state !== 'on');
                if (offContainer) offContainer.classList.toggle('hidden', state !== 'off');
            });
        });
    }
}

// グローバルに公開
window.ElementManager = ElementManager;
