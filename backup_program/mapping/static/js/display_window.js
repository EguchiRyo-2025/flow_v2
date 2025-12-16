/**
 * ディスプレイウィンドウ用スクリプト
 * 部品棚・作業台に表示される画像を管理
 */

class DisplayWindow {
    constructor() {
        this.displayTarget = window.DISPLAY_TARGET;
        this.canvas = document.getElementById('display-canvas');
        this.currentGroupId = null;
        this.elements = [];
        this.selectedElement = null;
        this.isDragging = false;
        this.isResizing = false;
        this.resizeCorner = null; // 'nw', 'ne', 'sw', 'se'
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.elementStartX = 0;
        this.elementStartY = 0;
        this.elementStartWidth = 0;
        this.elementStartHeight = 0;
        
        this.init();
    }
    
    init() {
        console.log(`DisplayWindow initialized for: ${this.displayTarget}`);
        
        // イベントリスナーを設定
        this.setupEventListeners();
        
        // ポーリング開始
        this.startPolling();
        
        // 情報パネルの切り替えボタン
        document.getElementById('toggle-info-btn').addEventListener('click', () => {
            const panel = document.getElementById('info-panel');
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                event.target.textContent = '情報パネルを隠す';
            } else {
                panel.style.display = 'none';
                event.target.textContent = '情報パネルを表示';
            }
        });
    }
    
    setupEventListeners() {
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
            const response = await fetch(`/api/elements/${elementId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y, scale })
            });
            
            if (response.ok) {
                console.log(`Element ${elementId} updated: (${x}, ${y}), scale: ${scale.toFixed(2)}`);
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
        
        if (this.selectedElement) {
            this.selectedElement.classList.add('selected');
            const elementId = this.selectedElement.dataset.elementId;
            document.getElementById('selected-element').textContent = `ID: ${elementId}`;
            
            // リサイズハンドルを作成
            this.createResizeHandles();
        } else {
            document.getElementById('selected-element').textContent = 'なし';
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
    
    async startPolling() {
        // 0.5秒ごとに要素を更新
        setInterval(async () => {
            await this.fetchElements();
        }, 500);
    }
    
    async fetchElements() {
        try {
            // 現在のグループIDを取得（localStorageまたはURL）
            const params = new URLSearchParams(window.location.search);
            const groupId = params.get('group_id') || localStorage.getItem('currentGroupId');
            
            if (!groupId) {
                // グループが選択されていない場合は空にする
                if (this.elements.length > 0) {
                    this.clearCanvas();
                }
                return;
            }
            
            // グループIDが変わった場合
            if (this.currentGroupId !== groupId) {
                this.currentGroupId = groupId;
                document.getElementById('current-group').textContent = groupId;
            }
            
            const response = await fetch(
                `/api/display/elements/${this.displayTarget}?group_id=${groupId}`
            );
            
            if (!response.ok) {
                console.error('Failed to fetch elements');
                return;
            }
            
            const elements = await response.json();
            
            // 要素が変更された場合のみ再描画
            if (JSON.stringify(elements) !== JSON.stringify(this.elements)) {
                this.elements = elements;
                this.renderElements();
            }
            
        } catch (error) {
            console.error('Error fetching elements:', error);
        }
    }
    
    clearCanvas() {
        this.canvas.innerHTML = '';
        this.elements = [];
        this.selectedElement = null;
        document.getElementById('element-count').textContent = '0';
        document.getElementById('current-group').textContent = '未選択';
    }
    
    renderElements() {
        console.log(`Rendering ${this.elements.length} elements for ${this.displayTarget}`);
        
        // 既存の要素をクリア
        this.canvas.innerHTML = '';
        
        // 要素を描画
        this.elements.forEach(elem => {
            const img = document.createElement('img');
            
            // 画像パスを正規化
            const imagePath = elem.file_path.replace('assets/', '');
            img.src = `/media/${imagePath}`;
            
            img.className = 'display-image';
            img.dataset.elementId = elem.id;
            img.dataset.originalWidth = elem.width;
            img.dataset.originalHeight = elem.height;
            
            // スケールを適用
            const scale = elem.scale || 1.0;
            const displayWidth = elem.width * scale;
            const displayHeight = elem.height * scale;
            
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
            
            this.canvas.appendChild(img);
        });
        
        // 要素数を更新
        document.getElementById('element-count').textContent = this.elements.length;
    }
}

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    window.displayWindow = new DisplayWindow();
});
