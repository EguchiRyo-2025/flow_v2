import sys
from PyQt5.QtWidgets import QApplication, QWidget, QMenu, QColorDialog
from PyQt5.QtGui import QPainter, QPolygonF, QColor, QCursor
from PyQt5.QtCore import QPointF, Qt

class PolygonEditor(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("多角形描画テスト")
        self.setGeometry(100, 100, 600, 400)
        self.points = [QPointF(100, 100), QPointF(200, 100), QPointF(200, 200), QPointF(100, 200)]
        self.selected_point = None
        self.fill_color = QColor(200, 100, 150, 150)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        polygon = QPolygonF(self.points)
        painter.setBrush(self.fill_color)
        painter.drawPolygon(polygon)

        painter.setBrush(Qt.black)
        for point in self.points:
            painter.drawEllipse(point, 5, 5)

    def mousePressEvent(self, event):
        pos = event.pos()
        if event.button() == Qt.LeftButton:
            for i, point in enumerate(self.points):
                if (point - pos).manhattanLength() < 10:
                    self.selected_point = i
                    break
        elif event.button() == Qt.RightButton:
            self.showContextMenu(event.pos())

    def mouseMoveEvent(self, event):
        pos = event.pos()
        if self.selected_point is not None:
            self.points[self.selected_point] = QPointF(pos)
            self.update()
        else:
            # カーソル変更（制御点に近い場合）
            near_point = any((point - pos).manhattanLength() < 10 for point in self.points)
            self.setCursor(QCursor(Qt.PointingHandCursor if near_point else Qt.ArrowCursor))

    def mouseReleaseEvent(self, event):
        self.selected_point = None

    def showContextMenu(self, pos):
        menu = QMenu(self)
        add_action = menu.addAction("制御点を追加")
        color_action = menu.addAction("塗りつぶし色を変更")
        action = menu.exec_(self.mapToGlobal(pos))

        if action == add_action:
            self.insertPointAtClosestEdge(pos)
        elif action == color_action:
            color = QColorDialog.getColor(self.fill_color, self, "塗りつぶし色を選択")
            if color.isValid():
                self.fill_color = color
                self.update()

    def insertPointAtClosestEdge(self, pos):
        min_dist = float('inf')
        insert_index = 0
        for i in range(len(self.points)):
            p1 = self.points[i]
            p2 = self.points[(i + 1) % len(self.points)]
            dist = self.distanceToSegment(pos, p1, p2)
            if dist < min_dist:
                min_dist = dist
                insert_index = i + 1
        self.points.insert(insert_index, QPointF(pos))
        self.update()

    def distanceToSegment(self, p, a, b):
        # 線分abに対する点pの距離
        ap = p - a
        ab = b - a
        ab_len = ab.manhattanLength()
        if ab_len == 0:
            return ap.manhattanLength()
        t = max(0, min(1, QPointF.dotProduct(ap, ab) / QPointF.dotProduct(ab, ab)))
        projection = a + ab * t
        return (p - projection).manhattanLength()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    editor = PolygonEditor()
    editor.show()
    sys.exit(app.exec_())
