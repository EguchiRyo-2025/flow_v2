// プレビューウィンドウのJavaScript

const displayTarget = window.DISPLAY_TARGET; // HTMLから渡される
const canvas = document.getElementById('preview-canvas');
const cursor = document.getElementById('preview-cursor');
const resolutionEl = document.getElementById('resolution');
const elementCountEl = document.getElementById('element-count');
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');
const hideInfoBtn = document.getElementById('hide-info-btn');
const infoPanel = document.querySelector('.info-panel');

// 画面解像度を表示
resolutionEl.textContent = `${window.screen.width} × ${window.screen.height}`;

// 全画面表示機能（すべての表示先で利用可能）
if (fullscreenToggleBtn) {
    fullscreenToggleBtn.addEventListener('click', () => {
        toggleFullscreen();
    });
}

// 情報パネルの表示/非表示
if (hideInfoBtn) {
    hideInfoBtn.addEventListener('click', () => {
        if (infoPanel.style.display === 'none') {
            infoPanel.style.display = 'block';
            hideInfoBtn.textContent = '情報を非表示';
        } else {
            infoPanel.style.display = 'none';
            hideInfoBtn.textContent = '情報を表示';
        }
    });
}

// postMessageで全画面リクエストを受信
window.addEventListener('message', (event) => {
    if (event.data.type === 'request-fullscreen') {
        requestFullscreen();
    }
});

// 全画面表示のトグル
function toggleFullscreen() {
    if (document.fullscreenElement) {
        exitFullscreen();
    } else {
        requestFullscreen();
    }
}

// 全画面表示を実行
function requestFullscreen() {
    const elem = document.documentElement;
    
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { // Safari
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { // IE11
        elem.msRequestFullscreen();
    }
}

// 全画面解除
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

// 全画面状態の変更を監視
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
document.addEventListener('msfullscreenchange', updateFullscreenButton);

function updateFullscreenButton() {
    if (fullscreenToggleBtn) {
        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        fullscreenToggleBtn.textContent = isFullscreen ? '全画面解除' : '全画面表示';
    }
}

// Escキーで情報パネルを表示（全画面中の操作用）
document.addEventListener('keydown', (e) => {
    if (e.key === 'i' || e.key === 'I') {
        if (infoPanel) {
            if (infoPanel.style.display === 'none') {
                infoPanel.style.display = 'block';
            } else {
                infoPanel.style.display = 'none';
            }
        }
    }
});

let elements = [];
let draggingElement = null;
let dragStartX = 0;
let dragStartY = 0;
let elementStartX = 0;
let elementStartY = 0;

// 多角形エディタを初期化
window.polygonEditor = new PolygonInteractiveEditor(canvas);

// 要素をレンダリング
function renderElements() {
    canvas.innerHTML = '';
    elementCountEl.textContent = elements.length;
    
    elements.forEach(elem => {
        if (elem.element_type === 'polygon') {
            renderPolygonElement(elem);
        } else if (elem.element_type === 'text') {
            renderTextElement(elem);
        } else {
            // デフォルト：画像要素
            renderImageElement(elem);
        }
    });
}

/**
 * 画像要素をレンダリング
 */
function renderImageElement(elem) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-image';
    wrapper.style.left = `${elem.x_position}px`;
    wrapper.style.top = `${elem.y_position}px`;
    wrapper.setAttribute('data-element-id', elem.id);
    
    const img = document.createElement('img');
    // file_pathから'assets/'を削除して'/mapping/media/'を追加
    const imagePath = elem.file_path.replace('assets/', '');
    img.src = `/mapping/media/${imagePath}`;
    img.style.width = `${elem.image_width * elem.scale}px`;
    img.style.height = `${elem.image_height * elem.scale}px`;
    img.style.transform = `rotate(${elem.rotation || 0}deg)`;
    img.style.opacity = elem.opacity || 1;
    img.draggable = false;
    
    wrapper.appendChild(img);
    canvas.appendChild(wrapper);
    
    // マウスイベントを設定
    setupDragAndResize(wrapper, elem);
    
    // 点滅制御
    if (elem.blink_enabled) {
        blinkElement(wrapper, elem.blink_on_time, elem.blink_off_time);
    }
}

/**
 * 多角形要素をレンダリング
 */
function renderPolygonElement(elem) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-image';
    wrapper.style.left = `${elem.x_position}px`;
    wrapper.style.top = `${elem.y_position}px`;
    wrapper.setAttribute('data-element-id', elem.id);
    wrapper.style.cursor = 'move';
    wrapper.style.position = 'absolute';
    
    if (!elem.polygon_points) {
        console.warn('多角形の座標データがありません:', elem.id);
        return;
    }
    
    try {
        const points = JSON.parse(elem.polygon_points);
        
        // SVGを作成
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '400');
        svg.setAttribute('height', '300');
        svg.style.overflow = 'visible';
        svg.style.opacity = elem.opacity || 1;
        svg.style.transform = `scale(${elem.scale || 1})`;
        svg.setAttribute('data-element-id', elem.id);
        
        // 多角形を描画
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = points.map(p => `${p[0]},${p[1]}`).join(' ');
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('fill', elem.element_comment || '#007BFF');
        polygon.setAttribute('fill-opacity', '0.6');
        polygon.setAttribute('stroke', elem.element_comment || '#007BFF');
        polygon.setAttribute('stroke-width', '2');
        polygon.style.pointerEvents = 'none';
        
        svg.appendChild(polygon);

        // 制御点を描画
        points.forEach((point, index) => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point[0]);
            circle.setAttribute('cy', point[1]);
            circle.setAttribute('r', '5');
            circle.setAttribute('fill', 'white');
            circle.setAttribute('stroke', elem.element_comment || '#007BFF');
            circle.setAttribute('stroke-width', '2');
            circle.style.cursor = 'grab';
            circle.style.pointerEvents = 'auto';
            
            // ドラッグ開始
            circle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (window.polygonEditor) {
                    window.polygonEditor.setControlPointDrag(index);
                    window.polygonEditor.draggedElement = elem;
                }
            });

            svg.appendChild(circle);
        });
        
        wrapper.appendChild(svg);
    } catch (error) {
        console.error('多角形描画エラー:', error);
    }
    
    canvas.appendChild(wrapper);
    setupDragAndResize(wrapper, elem);
}

/**
 * テキスト要素をレンダリング
 */
function renderTextElement(elem) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-image';
    wrapper.style.left = `${elem.x_position}px`;
    wrapper.style.top = `${elem.y_position}px`;
    wrapper.setAttribute('data-element-id', elem.id);
    wrapper.style.cursor = 'move';
    wrapper.style.padding = '5px 10px';
    wrapper.style.backgroundColor = elem.text_bg_color || '#FFFFFF';
    wrapper.style.borderRadius = '4px';
    wrapper.style.opacity = elem.opacity || 1;
    
    const textEl = document.createElement('div');
    textEl.textContent = elem.text_content || '';
    textEl.style.color = elem.text_color || '#000000';
    textEl.style.fontSize = `${elem.text_font_size || 16}px`;
    textEl.style.fontWeight = 'normal';
    textEl.style.whiteSpace = 'nowrap';
    textEl.style.userSelect = 'none';
    textEl.draggable = false;
    
    wrapper.appendChild(textEl);
    canvas.appendChild(wrapper);
    
    setupDragAndResize(wrapper, elem);
}

// ドラッグ&リサイズの設定
function setupDragAndResize(element, elemData) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    // マウスダウン（ドラッグ開始）
    element.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        element.classList.add('dragging');
        
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(element.style.left) || 0;
        startTop = parseInt(element.style.top) || 0;
        
        document.body.style.cursor = 'move';
    });
    
    // マウス移動（ドラッグ中）
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || element.classList.contains('dragging') === false) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newX = startLeft + deltaX;
        const newY = startTop + deltaY;
        
        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    });
    
    // マウスアップ（ドラッグ終了）
    document.addEventListener('mouseup', async () => {
        if (!isDragging) return;
        
        isDragging = false;
        element.classList.remove('dragging');
        document.body.style.cursor = 'default';
        
        // 新しい座標をDBに保存
        const newX = parseInt(element.style.left) || 0;
        const newY = parseInt(element.style.top) || 0;
        
        await updateElementPosition(elemData.id, newX, newY);
        
        // 要素データを更新
        elemData.x_position = newX;
        elemData.y_position = newY;
    });
    
    // ホイールで拡大縮小
    element.addEventListener('wheel', async (e) => {
        e.preventDefault();
        
        const img = element.querySelector('img');
        const currentScale = elemData.scale || 1;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.1, Math.min(5.0, currentScale + delta));
        
        img.style.width = `${elemData.image_width * newScale}px`;
        img.style.height = `${elemData.image_height * newScale}px`;
        
        // DBに保存
        await updateElementScale(elemData.id, newScale);
        
        // 要素データを更新
        elemData.scale = newScale;
    });
}

// 要素の位置を更新
async function updateElementPosition(elementId, x, y) {
    try {
        const response = await fetch(`/api/elements/${elementId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                x_position: x,
                y_position: y,
                scale: elements.find(e => e.id === elementId)?.scale || 1,
                rotation: elements.find(e => e.id === elementId)?.rotation || 0
            })
        });
        
        if (response.ok) {
            console.log('位置更新成功:', elementId, x, y);
        }
    } catch (error) {
        console.error('位置更新エラー:', error);
    }
}

// 要素のスケールを更新
async function updateElementScale(elementId, scale) {
    const elem = elements.find(e => e.id === elementId);
    if (!elem) return;
    
    try {
        const response = await fetch(`/api/elements/${elementId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                x_position: elem.x_position,
                y_position: elem.y_position,
                scale: scale,
                rotation: elem.rotation || 0
            })
        });
        
        if (response.ok) {
            console.log('スケール更新成功:', elementId, scale);
        }
    } catch (error) {
        console.error('スケール更新エラー:', error);
    }
}

// 点滅処理
function blinkElement(element, onTime, offTime) {
    let visible = true;
    setInterval(() => {
        visible = !visible;
        element.style.visibility = visible ? 'visible' : 'hidden';
    }, (visible ? onTime : offTime) * 1000);
}

// カーソル位置を表示
window.addEventListener('message', (event) => {
    if (event.data.type === 'show-cursor') {
        cursor.style.left = `${event.data.x}px`;
        cursor.style.top = `${event.data.y}px`;
        cursor.style.display = 'block';
        
        setTimeout(() => {
            cursor.style.display = 'none';
        }, 2000);
    } else if (event.data.type === 'update-elements') {
        elements = event.data.elements;
        renderElements();
    }
});

// ポーリングで要素を取得
async function fetchElements() {
    try {
        const response = await fetch(`/mapping/api/preview/elements?display_target=${encodeURIComponent(displayTarget)}`);
        if (response.ok) {
            elements = await response.json();
            renderElements();
        }
    } catch (error) {
        console.error('要素取得エラー:', error);
    }
}

// 初期ロード
fetchElements();

// 定期的に更新（5秒ごと）
setInterval(fetchElements, 5000);
