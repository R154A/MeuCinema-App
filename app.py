"""Meu Cinema - seu Letterboxd + JustWatch pessoal.

Uso:  python app.py            (abre a janela do app)
      python app.py --browser  (abre no navegador, útil para testes)
"""
import sys
import webbrowser
from pathlib import Path

from server import make_server, serve_in_thread
from storage import Store

# Chaves do TMDB (podem ser trocadas depois na tela "Ajustes").
DEFAULT_TOKEN = (
    "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1N2VjMDQyZjRlM2I1NjhhZjIxOWY4NjM3MTM1OGIwYiIsIm5iZiI6MTc4NzY5NTYxMC4zMywic3ViIjoiNmE4ZTExZmEzZGRjMWMyZWUwNDYwMTU0Iiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.KIBzu8VMsZYdPXJYa9L0iBnLn5GGQjCftbyKwdXeHAA"
)
DEFAULT_KEY = "57ec042f4e3b568af219f86371358b0b"


def resource_dir():
    base = getattr(sys, "_MEIPASS", None)
    return Path(base) if base else Path(__file__).resolve().parent


def app_folder():
    """Pasta onde o app está instalado (a do .exe; em desenvolvimento, a do projeto)."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


class Dialogs:
    """Abre o Explorador de Arquivos do sistema para salvar / escolher o backup."""

    def __init__(self, store, folder):
        self.store, self.folder = store, folder

    def _start_dir(self):
        d = self.store.config.get("backup_dir")
        return d if d and Path(d).is_dir() else str(self.folder)  # lembra a última pasta; senão, a do app

    @staticmethod
    def _first(r):
        if isinstance(r, (list, tuple)):
            r = r[0] if r else None
        return str(r) if r else None

    @staticmethod
    def _kinds():
        import webview
        FD = getattr(webview, "FileDialog", None)
        return (FD.OPEN, FD.SAVE) if FD else (webview.OPEN_DIALOG, webview.SAVE_DIALOG)

    def save(self, filename):
        import webview
        _, SAVE = self._kinds()
        r = webview.windows[0].create_file_dialog(
            SAVE, directory=self._start_dir(), save_filename=filename,
            file_types=("Backup do Meu Cinema (*.json)",))
        return self._first(r)

    def open(self):
        import webview
        OPEN, _ = self._kinds()
        r = webview.windows[0].create_file_dialog(
            OPEN, directory=self._start_dir(), allow_multiple=False,
            file_types=("Backup do Meu Cinema (*.json)", "Todos os arquivos (*.*)"))
        return self._first(r)


def main():
    store = Store()
    browser = "--browser" in sys.argv
    srv = make_server(resource_dir() / "web", store, DEFAULT_TOKEN, DEFAULT_KEY,
                      dialogs=None if browser else Dialogs(store, app_folder()), app_dir=app_folder())
    serve_in_thread(srv)
    url = f"http://127.0.0.1:{srv.server_address[1]}/"

    if "--browser" in sys.argv:
        print("Abrindo", url)
        webbrowser.open(url)
        try:
            input("Pressione Enter para sair...\n")
        except EOFError:
            import time
            while True:
                time.sleep(3600)
        return

    import webview  # pywebview

    webview.create_window(
        "Meu Cinema", url, width=1280, height=820, min_size=(900, 600),
        background_color="#1C1C20",
    )
    webview.start()


if __name__ == "__main__":
    main()
