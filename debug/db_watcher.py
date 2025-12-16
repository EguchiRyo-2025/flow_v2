
# import sqlite3
# import tkinter as tk
# from tkinter import ttk, filedialog, messagebox
# import csv, os

# class SQLiteViewer(tk.Tk):
#     def __init__(self):
#         super().__init__()
#         self.title("SQLite .db Viewer")
#         self.geometry("900x600")
#         self.conn = None
#         self.current_object = None  # (name, type)
#         self.current_rows = []
#         self.current_columns = []
#         self.create_widgets()

#     def create_widgets(self):
#         top = ttk.Frame(self); top.pack(fill=tk.X, padx=8, pady=8)
#         self.db_label = ttk.Label(top, text="DB: (未選択)")
#         self.db_label.pack(side=tk.LEFT, padx=(0,8))
#         ttk.Button(top, text="DBを開く", command=self.open_db).pack(side=tk.LEFT)

#         self.where_entry = ttk.Entry(top, width=50); self.where_entry.insert(0, "")
#         self.where_entry.pack(side=tk.LEFT, padx=(8,4))
#         ttk.Label(top, text="WHERE条件（例: id > 10 AND status='ok'）").pack(side=tk.LEFT)
#         ttk.Button(top, text="検索/更新", command=self.refresh_rows).pack(side=tk.LEFT, padx=(8,0))
#         ttk.Button(top, text="CSVにエクスポート", command=self.export_csv).pack(side=tk.LEFT, padx=(8,0))

#         panes = ttk.Panedwindow(self, orient=tk.HORIZONTAL); panes.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)
#         left = ttk.Frame(panes); panes.add(left, weight=1)
#         ttk.Label(left, text="オブジェクト一覧（table / view）").pack(anchor="w")
#         self.objects_list = tk.Listbox(left, height=20); self.objects_list.pack(fill=tk.BOTH, expand=True)
#         self.objects_list.bind("<<ListboxSelect>>", self.on_object_select)

#         right = ttk.Frame(panes); panes.add(right, weight=3)
#         ttk.Label(right, text="データ").pack(anchor="w")
#         self.tree = ttk.Treeview(right, show="headings")
#         vsb = ttk.Scrollbar(right, orient="vertical", command=self.tree.yview)
#         hsb = ttk.Scrollbar(right, orient="horizontal", command=self.tree.xview)
#         self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
#         self.tree.pack(fill=tk.BOTH, expand=True); vsb.pack(side=tk.RIGHT, fill=tk.Y); hsb.pack(side=tk.BOTTOM, fill=tk.X)

#         self.status = tk.StringVar(value="準備完了")
#         ttk.Label(self, textvariable=self.status, relief=tk.SUNKEN, anchor="w").pack(fill=tk.X, side=tk.BOTTOM)

#     def open_db(self):
#         path = filedialog.askopenfilename(
#             title="SQLite .dbファイルを選択",
#             filetypes=[("SQLite DB", "*.db *.sqlite *.sqlite3"), ("すべてのファイル", "*.*")]
#         )
#         if not path: return
#         try:
#             if self.conn: self.conn.close()
#             # 読み取り専用にしたい場合は uri=True と mode=ro を使う
#             self.conn = sqlite3.connect(path)
#             self.conn.row_factory = sqlite3.Row
#             self.db_label.config(text=f"DB: {os.path.basename(path)}")
#             self.load_objects()
#             self.status.set("DBを開きました")
#         except Exception as e:
#             messagebox.showerror("エラー", f"DBを開けませんでした: {e}")
#             self.status.set("エラー")

#     def load_objects(self):
#         self.objects_list.delete(0, tk.END)
#         self.current_object = None
#         self.clear_tree()
#         if not self.conn: return
#         cur = self.conn.cursor()
#         # テーブルとビューを両方取得（内部テーブルは除外）
#         cur.execute("""
#             SELECT name, type
#             FROM sqlite_master
#             WHERE (type='table' OR type='view')
#               AND name NOT LIKE 'sqlite_%'
#             ORDER BY type, name;
#         """)
#         rows = cur.fetchall()
#         if not rows:
#             messagebox.showinfo("情報", "ユーザーテーブル／ビューが見つかりませんでした。\nSQLite以外のDBか、空のDBの可能性があります。")
#             self.status.set("オブジェクトがありません")
#             return
#         for name, typ in rows:
#             self.objects_list.insert(tk.END, f"{typ}: {name}")
#         self.status.set(f"{len(rows)}件のオブジェクトを読み込みました")

#     def on_object_select(self, event):
#         sel = self.objects_list.curselection()
#         if not sel: return
#         text = self.objects_list.get(sel[0])  # "type: name"
#         typ, name = text.split(": ", 1)
#         self.current_object = (name, typ)
#         self.refresh_rows()

#     def refresh_rows(self):
#         if not self.conn or not self.current_object: return
#         name, typ = self.current_object
#         where = self.where_entry.get().strip()
#         # viewでもSELECT * は可能（ただし複雑なビューはWHEREで失敗することあり）
#         query = f"SELECT * FROM {name}"
#         if where:
#             query += f" WHERE {where}"
#         query += " LIMIT 100;"
#         try:
#             cur = self.conn.cursor()
#             cur.execute(query)
#             rows = cur.fetchall()
#             columns = [desc[0] for desc in cur.description] if cur.description else []
#             self.current_rows = rows
#             self.current_columns = columns
#             self.populate_tree(columns, rows)
#             self.status.set(f"{typ} {name}: {len(rows)}件を表示（先頭100件）")
#         except Exception as e:
#             messagebox.showerror("クエリエラー", f"{e}\n\nSQL: {query}")
#             self.status.set("クエリエラー")

#     def clear_tree(self):
#         for col in self.tree["columns"]:
#             self.tree.heading(col, text="")
#         self.tree.delete(*self.tree.get_children())
#         self.tree["columns"] = ()

#     def populate_tree(self, columns, rows):
#         self.clear_tree()
#         self.tree["columns"] = columns
#         for col in columns:
#             self.tree.heading(col, text=col)
#             self.tree.column(col, width=140, anchor="w")
#         for r in rows:
#             values = [r[c] if isinstance(r, sqlite3.Row) else r[i] for i, c in enumerate(columns)]
#             values = ["" if v is None else v for v in values]
#             self.tree.insert("", tk.END, values=values)

#     def export_csv(self):
#         if not self.current_rows or not self.current_columns:
#             messagebox.showinfo("情報", "データがありません。先にテーブル/ビューを選んでください。")
#             return
#         path = filedialog.asksaveasfilename(title="CSVとして保存", defaultextension=".csv",
#                                             filetypes=[("CSVファイル", "*.csv")])
#         if not path: return
#         try:
#             import csv
#             with open(path, "w", newline="", encoding="utf-8") as f:
#                 w = csv.writer(f)
#                 w.writerow(self.current_columns)
#                 for r in self.current_rows:
#                     rowvals = [r[c] if isinstance(r, sqlite3.Row) else r[i] for i, c in enumerate(self.current_columns)]
#                     w.writerow(rowvals)
#             self.status.set(f"CSV保存: {path}")
#             messagebox.showinfo("完了", "CSVを書き出しました。")
#         except Exception as e:
#             messagebox.showerror("エラー", f"CSV書き出しに失敗しました: {e}")

# if __name__ == "__main__":
#     app = SQLiteViewer()
#     app.mainloop()


import sqlite3
db = r"C:/Users/4099176/Downloads/flow/modules/mapping/mapping_figure.db"
conn = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
cur = conn.cursor()
cur.execute("SELECT name, type FROM sqlite_master ORDER BY type, name;")
print(cur.fetchall())
