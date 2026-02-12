/**
 * ベクター図形描画マネージャー
 * 矩形初期化 → 右クリックで頂点追加 → ドラッグで制御点移動
 */

class VectorShapeDrawer {
    constructor() {
        this.currentFigureType = 'rectangle';
        this.currentColor = '#007BFF';
        this.polygonPoints = null;  // 多角形の頂点座標
        this.isEditing = false;
        
        this.init();
    }

    init() {
        // 図形タイプ変更時のイベントリスナー
        const figureTypeSelect = document.getElementById('figure-type');
        if (figureTypeSelect) {
            figureTypeSelect.addEventListener('change', (e) => {
                this.currentFigureType = e.target.value;
                this.updateUIForFigureType();
            });
        }

        // 色変更
        const colorInput = document.getElementById('figure-color');
        if (colorInput) {
            colorInput.addEventListener('change', (e) => {
                this.currentColor = e.target.value;
            });
        }
    }

    /**
     * 図形タイプに応じてUIを更新
     */
    updateUIForFigureType() {
        const polygonContainer = document.getElementById('polygon-editor-container');
        const textContainer = document.getElementById('text-editor-container');
        const colorContainer = document.getElementById('figure-color-container');
        
        if (!polygonContainer || !textContainer) return;

        // すべて非表示
        polygonContainer.style.display = 'none';
        textContainer.style.display = 'none';

        if (this.currentFigureType === 'polygon') {
            polygonContainer.style.display = 'block';
            // 多角形の初期化（四角形）
            this.initializePolygon();
        } else if (this.currentFigureType === 'text') {
            textContainer.style.display = 'block';
        } else {
            // rectangle, circle, triangle は色設定のみ
            if (colorContainer) colorContainer.style.display = 'block';
        }
    }

    /**
     * 多角形を初期化（四角形として作成）
     */
    initializePolygon() {
        const defaultRect = [
            [50, 50],
            [200, 50],
            [200, 150],
            [50, 150]
        ];
        
        this.polygonPoints = defaultRect;
        this.updatePolygonDisplay();
    }

    /**
     * 多角形の頂点表示を更新
     */
    updatePolygonDisplay() {
        const display = document.getElementById('polygon-points-display');
        const textarea = document.getElementById('polygon-points');
        
        if (!display || !this.polygonPoints) return;

        // 頂点一覧を表示
        let html = `<strong>頂点数: ${this.polygonPoints.length}</strong><br/>`;
        this.polygonPoints.forEach((point, index) => {
            html += `<div style="padding: 4px 0; border-bottom: 1px solid #eee;">
                点${index}: (${Math.round(point[0])}, ${Math.round(point[1])})
                <button type="button" style="margin-left: 10px; padding: 2px 6px; font-size: 11px;" 
                    onclick="window.vectorShapeDrawer.removePolygonPoint(${index})">削除</button>
            </div>`;
        });
        
        display.innerHTML = html;
        
        // JSONテキストエリアも更新
        if (textarea) {
            textarea.value = JSON.stringify(this.polygonPoints);
        }
    }

    /**
     * 多角形に頂点を追加
     */
    addPolygonPoint(x, y) {
        if (!this.polygonPoints) {
            this.initializePolygon();
        }

        // 最後の頂点の近くに新しい頂点を挿入
        this.polygonPoints.push([x, y]);
        this.updatePolygonDisplay();
        console.log('[VectorShapeDrawer] 頂点追加:', [x, y], '現在の頂点数:', this.polygonPoints.length);
    }

    /**
     * 多角形から頂点を削除
     */
    removePolygonPoint(index) {
        if (!this.polygonPoints || this.polygonPoints.length <= 3) {
            alert('多角形は最少3個の頂点が必要です');
            return;
        }

        this.polygonPoints.splice(index, 1);
        this.updatePolygonDisplay();
        console.log('[VectorShapeDrawer] 頂点削除:', index);
    }

    /**
     * 多角形の頂点を更新（ドラッグで移動した時）
     */
    updatePolygonPoint(index, x, y) {
        if (!this.polygonPoints || index < 0 || index >= this.polygonPoints.length) {
            return;
        }

        this.polygonPoints[index] = [x, y];
        this.updatePolygonDisplay();
    }

    /**
     * フォームから図形データを取得
     */
    getShapeDataFromForm(elementType) {
        if (elementType === 'figure') {
            const figureType = document.getElementById('figure-type').value;
            
            if (figureType === 'polygon') {
                if (!this.polygonPoints || this.polygonPoints.length < 3) {
                    alert('多角形の頂点が3個以上必要です');
                    return null;
                }
                
                return {
                    element_type: 'polygon',
                    polygon_points: JSON.stringify(this.polygonPoints),
                    x_position: 0,
                    y_position: 0,
                    scale: 1.0,
                    opacity: 1.0
                };
            } else if (figureType === 'text') {
                const content = document.getElementById('figure-text-content').value;
                const fontSize = parseInt(document.getElementById('figure-text-font-size').value);
                const textColor = document.getElementById('figure-text-color').value;
                const bgColor = document.getElementById('figure-text-bg-color').value;
                
                if (!content.trim()) {
                    alert('テキストを入力してください');
                    return null;
                }
                
                return {
                    element_type: 'text',
                    text_content: content,
                    text_font_size: fontSize,
                    text_color: textColor,
                    text_bg_color: bgColor,
                    x_position: 0,
                    y_position: 0,
                    scale: 1.0,
                    opacity: 1.0
                };
            } else {
                // rectangle, circle, triangle
                const color = document.getElementById('figure-color').value;
                return {
                    element_type: figureType,
                    x_position: 0,
                    y_position: 0,
                    scale: 1.0,
                    opacity: 1.0,
                    element_comment: color  // 色を保存
                };
            }
        }
        
        return null;
    }

    /**
     * JSONから多角形座標を読み込み
     */
    loadPolygonPoints(jsonString) {
        try {
            const points = JSON.parse(jsonString);
            if (Array.isArray(points) && points.length >= 3) {
                this.polygonPoints = points;
                this.updatePolygonDisplay();
                return true;
            }
        } catch (error) {
            console.error('多角形座標読み込みエラー:', error);
        }
        return false;
    }
}

// グローバルインスタンス
window.vectorShapeDrawer = new VectorShapeDrawer();

