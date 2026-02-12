/**
 * 多角形インタラクティブエディタ
 * ディスプレイウィンドウで右クリックで頂点追加、ドラッグで制御点移動
 */

class PolygonInteractiveEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.isEnabled = false;
        this.draggedPointIndex = null;
        this.draggedElement = null;
        this.offsetX = 0;
        this.offsetY = 0;
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    /**
     * 多角形編集モードを有効化
     */
    enablePolygonEditing(element) {
        this.isEnabled = true;
        this.draggedElement = element;
        console.log('[PolygonEditor] 多角形編集モード有効:', element);
    }

    /**
     * 多角形編集モードを無効化
     */
    disablePolygonEditing() {
        this.isEnabled = false;
        this.draggedElement = null;
        this.draggedPointIndex = null;
        console.log('[PolygonEditor] 多角形編集モード無効');
    }

    /**
     * 右クリックメニュー処理
     */
    handleContextMenu(e) {
        if (!this.isEnabled || !this.draggedElement) {
            return;
        }

        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // コンテキストメニューを表示
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            padding: 0;
            min-width: 150px;
        `;

        // メニューアイテム
        const items = [
            { label: '頂点を追加', action: () => this.addPointAtPosition(x, y) },
            { label: 'キャンセル', action: () => {} }
        ];

        items.forEach(item => {
            const div = document.createElement('div');
            div.textContent = item.label;
            div.style.cssText = `
                padding: 8px 15px;
                cursor: pointer;
                user-select: none;
                border-bottom: 1px solid #f0f0f0;
            `;
            div.addEventListener('mouseover', () => {
                div.style.backgroundColor = '#f0f0f0';
            });
            div.addEventListener('mouseout', () => {
                div.style.backgroundColor = 'transparent';
            });
            div.addEventListener('click', () => {
                item.action();
                document.body.removeChild(menu);
            });
            menu.appendChild(div);
        });

        document.body.appendChild(menu);

        // クリック以外で閉じる
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                if (menu.parentElement) {
                    document.body.removeChild(menu);
                }
                document.removeEventListener('click', closeMenu);
            });
        }, 0);
    }

    /**
     * 位置に頂点を追加
     */
    addPointAtPosition(x, y) {
        if (!window.vectorShapeDrawer) {
            console.warn('vectorShapeDrawer が見つかりません');
            return;
        }

        window.vectorShapeDrawer.addPolygonPoint(x, y);
        console.log('[PolygonEditor] 頂点追加:', [x, y]);
    }

    /**
     * マウス移動（制御点ドラッグ）
     */
    handleMouseMove(e) {
        if (this.draggedPointIndex === null || !this.draggedElement) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 制御点座標を更新
        if (window.vectorShapeDrawer) {
            window.vectorShapeDrawer.updatePolygonPoint(this.draggedPointIndex, x, y);
        }
    }

    /**
     * マウスアップ（ドラッグ終了）
     */
    handleMouseUp(e) {
        this.draggedPointIndex = null;
    }

    /**
     * 制御点の MouseDown をセット
     */
    setControlPointDrag(pointIndex) {
        this.draggedPointIndex = pointIndex;
    }
}

// グローバルインスタンス
window.polygonEditor = null;  // preview_window.js で初期化
