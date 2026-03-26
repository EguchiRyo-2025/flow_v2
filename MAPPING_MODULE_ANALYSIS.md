# Mapping Module Implementation Analysis

## 1. DATABASE SCHEMA

### Current Tables (SQLite)

#### `projects`
```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### `groups`
```sql
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    group_number INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
)
```

#### `image_assets`
```sql
CREATE TABLE image_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### `group_elements` (Main data model for projection elements)
```sql
CREATE TABLE group_elements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    image_asset_id INTEGER,
    display_target TEXT NOT NULL,           -- 'monitor', 'parts', 'workbench'
    x_position REAL NOT NULL,               -- Canvas X coordinate
    y_position REAL NOT NULL,               -- Canvas Y coordinate
    scale REAL DEFAULT 1.0,
    rotation REAL DEFAULT 0.0,
    opacity REAL DEFAULT 1.0,
    element_type TEXT DEFAULT 'image',      -- 'image', 'polygon', 'text'
    has_blink_control INTEGER DEFAULT 0,
    blink_on_time REAL DEFAULT 0.5,
    blink_off_time REAL DEFAULT 0.5,
    element_comment TEXT DEFAULT '',
    polygon_points TEXT,                    -- For polygon elements (JSON string)
    text_content TEXT,                      -- For text elements
    text_font_size INTEGER DEFAULT 16,
    text_color TEXT DEFAULT '#000000',
    text_bg_color TEXT DEFAULT '#FFFFFF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (image_asset_id) REFERENCES image_assets(id) ON DELETE CASCADE
)
```

#### `element_states` (For blink control state management)
```sql
CREATE TABLE element_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    element_id INTEGER NOT NULL,
    state TEXT DEFAULT 'hidden',            -- 'on' or 'off' state
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (element_id) REFERENCES group_elements(id) ON DELETE CASCADE
)
```

---

## 2. EXISTING CURSOR MOVEMENT FUNCTIONALITY

### Backend Implementation
**File:** `modules/mapping/app.py` - Line 625-655

```python
@mapping_bp.route('/api/move_cursor', methods=['POST'])
def move_cursor():
    """マウスカーソルを指定座標に移動"""
    try:
        data = request.json
        local_x = data['x']                  # Display-local coordinate
        local_y = data['y']
        display_target = data['display_target']  # 'monitor', 'parts', 'workbench'
        
        # Get display mapping from app config
        display_mapping = current_app.config.get('DISPLAY_MAPPING', {})
        
        # Get monitor info for the display_target
        monitor = display_mapping.get(display_target)
        
        if not monitor:
            return jsonify({'error': f'Display {display_target} not found'}), 404
        
        # Convert local coordinates to absolute/global coordinates
        absolute_x = monitor.x + local_x
        absolute_y = monitor.y + local_y
        
        # Move mouse smoothly over 0.2 seconds
        pyautogui.moveTo(absolute_x, absolute_y, duration=0.2)
        
        return jsonify({
            'status': 'ok',
            'moved_to': {
                'local': {'x': local_x, 'y': local_y},
                'absolute': {'x': absolute_x, 'y': absolute_y}
            }
        })
```

### Frontend Implementation
**File:** `modules/mapping/static/js/window_manager.js` - Line 248-257

```javascript
const cursorMoveBtn = document.getElementById('cursor-move');
if (cursorMoveBtn) {
    cursorMoveBtn.addEventListener('click', () => {
        const xPos = parseInt(xValueInput?.value) || 0;
        const yPos = parseInt(yValueInput?.value) || 0;
        console.log(`カーソル移動: X=${xPos}, Y=${yPos}`);
        // TODO: カーソル移動の実装
    });
}
```

**STATUS:** The backend API is fully implemented with coordinate system conversion, but the frontend integration is **incomplete** (marked as TODO).

### Dependencies
- `pyautogui` library for mouse control (already imported in app.py)
- Requires `DISPLAY_MAPPING` configuration from Flask app config

---

## 3. COORDINATE SYSTEM IMPLEMENTATION

### Display Coordinate System (Frontend - Canvas-based)
**File:** `modules/mapping/static/js/display_window.js`

#### Canvas Rendering System
- Uses HTML Canvas-based positioning with CSS absolute positioning
- Coordinates stored as **pixel values** in `x_position` and `y_position` (real floating-point numbers)
- Element positioning: `style.left` and `style.top` in pixels

#### Canvas Operations
```javascript
// Element dragging (from handleMouseMove)
const dx = e.clientX - this.dragStartX;
const dy = e.clientY - this.dragStartY;
const newX = this.elementStartX + dx;
const newY = this.elementStartY + dy;
this.selectedElement.style.left = `${newX}px`;
this.selectedElement.style.top = `${newY}px`;

// 8-way resize from corners (nw, n, ne, e, se, s, sw, w)
// Minimum size constraint: 20x20 pixels
```

#### Canvas State Management
- LocalStorage-based synchronization between display windows
- Keys:
  - `CURRENT_GROUP_KEY` ('currentGroupId'): Currently displayed group
  - `SELECTED_ELEMENT_KEY` ('selectedElementId'): Selected element for editing
  - `MAPPING_SYNC_KEY` ('mappingLastUpdate'): Last update timestamp
  - `MAPPING_DEBUG_ENDPOINT`: Debug logging endpoint

#### Display Target Mapping
```javascript
var DISPLAY_TARGET = window.DISPLAY_TARGET;  // Set from template variable
// Values: 'monitor', 'parts', 'workbench'
```

---

### Absolute/Physical Coordinate System (Backend - Display Hardware)
**File:** `config/base.py` - Lines 39-77

#### Display Mapping Configuration
```python
DISPLAY_MAPPING = {
    'monitor': monitors[0],      # Primary monitor
    'parts': monitors[1],        # Parts shelf display
    'workbench': monitors[2]     # Workbench display
}
```

#### Monitor Structure (from `screeninfo.get_monitors()`)
Each monitor object contains:
- `x`: Horizontal offset in pixel coordinates
- `y`: Vertical offset in pixel coordinates
- `width`: Monitor width in pixels (e.g., 1920)
- `height`: Monitor height in pixels (e.g., 1080)
- `is_primary`: Boolean flag for primary monitor

#### Coordinate Conversion Formula
```
absolute_x = monitor.x + local_x    # Display-local to absolute
absolute_y = monitor.y + local_y
```

#### Fallback Configuration (when screeninfo fails)
```python
Monitor = namedtuple('Monitor', ['x', 'y', 'width', 'height'])
default_monitor = Monitor(0, 0, 1920, 1080)  # 1920x1080 at origin
# All displays map to same 1920x1080
```

---

## 4. IMAGE/ELEMENT MANAGEMENT APIs

### Image Assets API

#### Upload Image
**Endpoint:** `POST /api/upload/image`
- Stores image files to `modules/mapping/assets/images/`
- Returns: image_id, file_path (relative), width, height, mime_type
- Allowed formats: png, jpg, jpeg, gif, bmp, webp
- Generates unique UUID-based filenames

#### Get Image Assets
**Endpoint:** `GET /api/image_assets`
- Returns all registered images with metadata

### Group Management API

#### Create Group
**Endpoint:** `POST /api/groups`
- Auto-increments `group_number`
- Returns: group_id, group_number

#### Get Groups
**Endpoint:** `GET /api/groups`
- Returns all groups for project_id=1 (hardcoded)
- Ordered by group_number

#### Update Group
**Endpoint:** `PUT /api/groups/<group_id>`
- Updates comment field

#### Delete Group
**Endpoint:** `DELETE /api/groups/<group_id>`
- Cascade deletes all child elements

### Group Elements API

#### Add Element to Group
**Endpoint:** `POST /api/group_elements`
```json
{
    "group_id": number,
    "element_type": "image|polygon|text",
    "image_asset_id": number,
    "display_target": "monitor|parts|workbench",
    "x": number,
    "y": number,
    "scale": number (default: 1.0),
    "rotation": number (default: 0.0),
    "opacity": number (default: 1.0),
    "has_blink_control": boolean,
    "blink_on_time": number,
    "blink_off_time": number,
    "polygon_points": "JSON string",
    "text_content": "string",
    "text_font_size": number,
    "text_color": "#hexcolor"
}
```

#### Get Group Elements
**Endpoint:** `GET /api/groups/<group_id>/elements`
- Query param: `state` ('on' or 'off') for blink states
- Returns: all elements with image metadata

#### Get Group Elements (Table View)
**Endpoint:** `GET /api/groups/<group_id>/elements/list`
- Returns flat list with image paths for table display

#### Update Element
**Endpoint:** `PUT /api/elements/<element_id>`
- Supports dynamic updates to: x_position, y_position, scale, rotation, opacity, display_target, element_comment, polygon_points, text_content, text_font_size, text_color

#### Delete Element
**Endpoint:** `DELETE /api/elements/<element_id>`
- Cascade deletes associated element_states

### Display-Specific APIs

#### Get Display List
**Endpoint:** `GET /api/displays`
- Returns all detected monitors with resolution and position

#### Get Preview Elements
**Endpoint:** `GET /api/preview/elements`
- Query param: `display_target`
- Returns elements filtered by display_target and element_type='image'

#### Get Display Elements
**Endpoint:** `GET /api/display/elements/<display_target>`
- Query param: `group_id`
- Returns elements for specific group on specific display

#### Move Cursor
**Endpoint:** `POST /api/move_cursor`
- Implemented (see section 2 above)

---

## 5. HTML/CANVAS ARCHITECTURE

### display_window.html
```html
<div class="display-label {{ display_target }}">{{ display_target }}</div>
<div id="display-canvas"></div>
<div class="info-panel" id="info-panel">
    <!-- Real-time display info -->
    - Monitor name
    - Element count
    - Current group ID
    - Selected element
    - Window size
</div>
```

### JavaScript Layer
Files:
- `display_window_init.js`: Initialization
- `display_window.js`: Main DisplayWindow class (700+ lines)
  - Canvas rendering
  - Drag/drop functionality
  - Resize handling
  - LocalStorage synchronization
  - Polling for updates

---

## WHAT'S CURRENTLY MISSING FOR PROJECTION MAPPING

### 1. **Incomplete Cursor Move Frontend Integration**
- Backend API fully implemented ✓
- Frontend click handler has TODO comment (window_manager.js:250-257)
- **Missing:** Actual API call to `/api/move_cursor` endpoint
- **Missing:** Error handling and confirmation UI

### 2. **No Real-Time Projector Control**
- Currently only positions elements in the HTML canvas
- **Missing:** Actual HDR/projector output configuration
- **Missing:** Projector resolution settings (assumes 1920x1080 fallback)
- **Missing:** Multi-projector synchronization logic
- **Missing:** Color calibration/mapping data

### 3. **Incomplete Display Configuration**
- Display mapping hardcoded to: 'monitor', 'parts', 'workbench'
- No persistent configuration file for projector settings
- No UI for configuring projector resolution
- No support for custom display names beyond these three

### 4. **No Rendering/Output Module**
- Currently only interactive positioning in HTML Canvas
- **Missing:** Actual image/video output to projectors
- **Missing:** Hardware acceleration (GPU rendering)
- **Missing:** Real-time video streaming to output displays

### 5. **Limited Element Transformation Support**
- Stores: scale, rotation, opacity, blink_control
- **Missing:** Perspective transformation (keystone correction)
- **Missing:** Distortion mapping (for projection surfaces)
- **Missing:** Blend mode support (for multi-projector overlap)
- **Missing:** Pixel mapping for irregular surfaces

### 6. **No Performance Optimization**
- **Missing:** Batching/caching for canvas rendering
- **Missing:** Level-of-detail (LOD) rendering
- **Missing:** Render throttling based on refresh rate
- **Missing:** Profiling/performance monitoring

### 7. **Database Not Yet PostgreSQL-Ready**
- SQLite implementation has PostgreSQL migration comments
- **Missing:** Actual PostgreSQL migrations
- **Missing:** Connection pooling
- **Missing:** Transaction management

### 8. **No Data Persistence for Projector States**
- No history of projector output states
- No undo/redo functionality
- No version control for mapping configurations

### 9. **Limited Coordinate System Features**
- No sub-pixel rendering precision
- No coordinate transformation for non-planar surfaces
- No support for radial/curved projections

### 10. **No Physical Calibration**
- **Missing:** Camera-based automatic alignment
- **Missing:** Feature detection and lockpoint alignment
- **Missing:** Perspective correction from reference images
- **Missing:** Color space/ICC profile management

---

## SUMMARY TABLE

| Feature | Status | Location |
|---------|--------|----------|
| Database Schema | ✓ Complete | modules/mapping/create_default_data.py |
| Image Management API | ✓ Complete | modules/mapping/app.py (lines ~110-170) |
| Group Management API | ✓ Complete | modules/mapping/app.py (lines ~265-330) |
| Element CRUD API | ✓ Complete | modules/mapping/app.py (lines ~335-550) |
| Display Detection | ✓ Complete | config/base.py, modules/mapping/app.py (lines ~606-620) |
| Cursor Move Backend | ✓ Complete | modules/mapping/app.py (lines ~625-655) |
| Canvas Rendering | ✓ Complete | modules/mapping/static/js/display_window.js |
| Element Positioning | ✓ Complete | display_window.html + JS |
| Cursor Move Frontend | ✗ Incomplete (TODO) | modules/mapping/static/js/window_manager.js |
| Projector Output | ✗ Missing | - |
| Display Config File | ✗ Missing | - |
| Calibration System | ✗ Missing | - |
| Real Render Pipeline | ✗ Missing | - |

---

## RECOMMENDED NEXT STEPS

1. **Complete Frontend Cursor Move** - Connect window_manager.js button to `/api/move_cursor` API
2. **Create Projector Config Module** - Add projector resolution/calibration settings
3. **Implement Output Renderer** - Add actual image/video projection output
4. **Add Calibration Workflow** - Camera-based alignment system
5. **PostgreSQL Migration** - Move from SQLite to production DB
