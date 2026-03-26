/**
 * ベクター図形描画マネージャー
 * display_windowで矩形、多角形、矢印を描画
 */

class ShapeDrawingMode {
    constructor(displayWindow) {
        this.displayWindow = displayWindow;
        this.svgLayer = document.getElementById('svg-layer');
        this.isEnabled = false;
        this.drawingMode = null; // 'rectangle', 'polygon', 'arrow'
        this.currentPoints = [];
        this.currentShape = null;
        this.isDrawing = false;
        this.shapeData = {};
        
        if (this.svgLayer) {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        // 右クリック: 多角形頂点追加（drawingMode === 'polygon'の場合）
        this.svgLayer.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        
        // ダブルクリック: 描画完了
        this.svgLayer.addEventListener('dblclick', (e) => this.completeDrawing(e));
        
        // マウスムーブ: プレビュー更新
        this.svgLayer.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // マウスダウン: 矩形描画開始
        this.svgLayer.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        
        // マウスアップ: ドラッグ終了
        this.svgLayer.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    /**
     * 図形描画モードを開始
     */
    startDrawing(shapeType, properties = {}) {
        this.isEnabled = true;
        this.drawingMode = shapeType; // 'rectangle', 'polygon', 'arrow'
        this.currentPoints = [];
        this.isDrawing = false;
        this.shapeData = {
            type: shapeType,
            strokeColor: properties.stroke_color || '#000000',
            fillColor: properties.fill_color || '#FFFFFF',
            strokeWidth: properties.stroke_width || 2,
            ...properties
        };
        
        // SVGレイヤーをクリア
        this.clearSVG();
        
        console.log(`[ShapeDrawing] 図形描画開始: type=${shapeType}`, this.shapeData);
    }

    /**
     * 図形描画モードを終了
     */
    stopDrawing() {
        this.isEnabled = false;
        this.drawingMode = null;
        this.currentPoints = [];
        this.isDrawing = false;
        this.clearSVG();
    }

    /**
     * 右クリック: 多角形頂点追加
     */
    handleRightClick(e) {
        if (!this.isEnabled || this.drawingMode !== 'polygon') {
            return;
        }

        e.preventDefault();

        const rect = this.svgLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 頂点を追加
        this.currentPoints.push([x, y]);
        
        // 多角形を描画
        this.drawPolygon();
        
        console.log(`[ShapeDrawing] 頂点追加: (${Math.round(x)}, ${Math.round(y)}), 現在の頂点数=${this.currentPoints.length}`);
    }

    /**
     * マウスダウン: 矩形描画開始
     */
    handleMouseDown(e) {
        if (!this.isEnabled) {
            return;
        }

        if (this.drawingMode === 'rectangle') {
            const rect = this.svgLayer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.isDrawing = true;
            this.currentPoints = [[x, y]];
        } else if (this.drawingMode === 'arrow') {
            const rect = this.svgLayer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (this.currentPoints.length === 0) {
                this.isDrawing = true;
                this.currentPoints = [[x, y]];
            }
        }
    }

    /**
     * マウスムーブ: プレビュー更新
     */
    handleMouseMove(e) {
        if (!this.isEnabled || !this.isDrawing) {
            return;
        }

        const rect = this.svgLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.drawingMode === 'rectangle' && this.currentPoints.length === 1) {
            // 矩形プレビュー
            const [x1, y1] = this.currentPoints[0];
            this.clearSVG();
            this.drawRectanglePreview(x1, y1, x, y);
        } else if (this.drawingMode === 'arrow' && this.currentPoints.length === 1) {
            // 矢印プレビュー
            const [x1, y1] = this.currentPoints[0];
            this.clearSVG();
            this.drawArrowPreview(x1, y1, x, y);
        }
    }

    /**
     * マウスアップ: ドラッグ終了
     */
    handleMouseUp(e) {
        if (!this.isEnabled || !this.isDrawing) {
            return;
        }

        const rect = this.svgLayer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.drawingMode === 'rectangle') {
            this.isDrawing = false;
            const [x1, y1] = this.currentPoints[0];
            this.currentPoints.push([x, y]);
            this.drawRectangle();
        } else if (this.drawingMode === 'arrow') {
            this.isDrawing = false;
            const [x1, y1] = this.currentPoints[0];
            this.currentPoints.push([x, y]);
            this.drawArrow();
        }
    }

    /**
     * ダブルクリック: 描画完了
     */
    completeDrawing(e) {
        if (!this.isEnabled || this.currentPoints.length === 0) {
            return;
        }

        if (this.drawingMode === 'polygon' && this.currentPoints.length >= 3) {
            // 多角形完了
            this.drawPolygon();
            console.log(`[ShapeDrawing] 多角形完了: 頂点数=${this.currentPoints.length}`);
            this.saveToDB();
        } else if (this.drawingMode === 'rectangle' && this.currentPoints.length === 2) {
            // 矩形完了
            this.drawRectangle();
            console.log(`[ShapeDrawing] 矩形完了`);
            this.saveToDB();
        } else if (this.drawingMode === 'arrow' && this.currentPoints.length === 2) {
            // 矢印完了
            this.drawArrow();
            console.log(`[ShapeDrawing] 矢印完了`);
            this.saveToDB();
        }
    }

    /**
     * 矩形を描画
     */
    drawRectangle() {
        if (this.currentPoints.length < 2) return;

        const [x1, y1] = this.currentPoints[0];
        const [x2, y2] = this.currentPoints[1];

        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        this.clearSVG();

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('stroke', this.shapeData.strokeColor);
        rect.setAttribute('stroke-width', this.shapeData.strokeWidth);
        rect.setAttribute('fill', this.shapeData.fillColor);
        rect.setAttribute('opacity', '0.7');

        this.svgLayer.appendChild(rect);

        // 矩形データを保存
        this.shapeData.top_left = [x, y];
        this.shapeData.width = width;
        this.shapeData.height = height;
    }

    /**
     * 矩形プレビュー
     */
    drawRectanglePreview(x1, y1, x2, y2) {
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('stroke', this.shapeData.strokeColor);
        rect.setAttribute('stroke-width', this.shapeData.strokeWidth);
        rect.setAttribute('fill', this.shapeData.fillColor);
        rect.setAttribute('opacity', '0.5');
        rect.setAttribute('stroke-dasharray', '5,5');

        this.svgLayer.appendChild(rect);
    }

    /**
     * 多角形を描画
     */
    drawPolygon() {
        if (this.currentPoints.length < 3) return;

        this.clearSVG();

        // ポリゴンを描画
        const pointsStr = this.currentPoints.map(p => `${p[0]},${p[1]}`).join(' ');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('stroke', this.shapeData.strokeColor);
        polygon.setAttribute('stroke-width', this.shapeData.strokeWidth);
        polygon.setAttribute('fill', this.shapeData.fillColor);
        polygon.setAttribute('opacity', '0.7');

        this.svgLayer.appendChild(polygon);

        // 制御点を描画
        this.currentPoints.forEach((point, index) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point[0]);
            circle.setAttribute('cy', point[1]);
            circle.setAttribute('r', '5');
            circle.setAttribute('fill', this.shapeData.strokeColor);
            circle.setAttribute('class', 'control-point');
            circle.setAttribute('data-index', index);

            this.svgLayer.appendChild(circle);
        });

        // 多角形データを保存
        this.shapeData.points = this.currentPoints;
    }

    /**
     * 矢印を描画
     */
    drawArrow() {
        if (this.currentPoints.length < 2) return;

        const [x1, y1] = this.currentPoints[0];
        const [x2, y2] = this.currentPoints[1];

        this.clearSVG();

        // 矢印本体（線）
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', this.shapeData.strokeColor);
        line.setAttribute('stroke-width', this.shapeData.strokeWidth);

        this.svgLayer.appendChild(line);

        // 矢印頭を描画
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLength = 15;

        const points = [
            [x2, y2],
            [x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6)],
            [x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6)]
        ];

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', points.map(p => `${p[0]},${p[1]}`).join(' '));
        polygon.setAttribute('fill', this.shapeData.strokeColor);

        this.svgLayer.appendChild(polygon);

        // 矢印データを保存
        this.shapeData.start = [x1, y1];
        this.shapeData.end = [x2, y2];
    }

    /**
     * 矢印プレビュー
     */
    drawArrowPreview(x1, y1, x2, y2) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', this.shapeData.strokeColor);
        line.setAttribute('stroke-width', this.shapeData.strokeWidth);
        line.setAttribute('stroke-dasharray', '5,5');

        this.svgLayer.appendChild(line);
    }

    /**
     * SVGレイヤーをクリア
     */
    clearSVG() {
        while (this.svgLayer.firstChild) {
            this.svgLayer.removeChild(this.svgLayer.firstChild);
        }
    }

    /**
     * DBに図形を保存
     */
    async saveToDB() {
        if (!this.displayWindow.currentGroupId) {
            alert('グループが選択されていません');
            return;
        }

        try {
            const response = await fetch('/mapping/api/group_elements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: this.displayWindow.currentGroupId,
                    element_type: 'shape',
                    display_target: this.displayWindow.displayTarget,
                    x_position: 0,
                    y_position: 0,
                    shape_type: this.drawingMode,
                    shape_data: this.shapeData,
                    stroke_color: this.shapeData.strokeColor,
                    fill_color: this.shapeData.fillColor,
                    stroke_width: this.shapeData.strokeWidth,
                    element_comment: `${this.drawingMode} 図形`
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[ShapeDrawing] DB保存成功:', result);
                alert('図形を保存しました');
                this.stopDrawing();
                
                // 表示を更新
                this.displayWindow.fetchElements(true);
            } else {
                const error = await response.json();
                console.error('[ShapeDrawing] DB保存エラー:', error);
                alert('図形の保存に失敗しました: ' + error.error);
            }
        } catch (error) {
            console.error('[ShapeDrawing] 保存リクエストエラー:', error);
            alert('図形の保存に失敗しました');
        }
    }
}

// グローバルから呼び出せるようにする
window.ShapeDrawingMode = ShapeDrawingMode;
