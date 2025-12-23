/**
 * 要素管理クラス（右ペイン）
 */
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
        this.setupEventListeners();
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
            const onResponse = await fetch(`/api/groups/${groupId}/elements?state=on`);
            if (onResponse.ok) {
                this.elements.on = await onResponse.json();
            }

            // OFF要素を取得
            const offResponse = await fetch(`/api/groups/${groupId}/elements?state=off`);
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
            const response = await fetch(`/api/elements/${this.currentElementId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });
            
            if (response.ok) {
                console.log('要素更新成功');
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
