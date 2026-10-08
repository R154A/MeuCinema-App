"""Meu Cinema - seu Letterboxd + JustWatch pessoal.

Uso:  python app.py            (abre a janela do app)
      python app.py --browser  (abre no navegador, útil para testes)
"""
import sys
import webbrowser
from pathlib import Path

from server import make_server, serve_in_thread
from storage import Store

# A chave do TMDB e colocada por cada pessoa na tela "Ajustes" do app.
DEFAULT_TOKEN = ""
DEFAULT_KEY = ""


def resource_dir():
    base = getattr(sys, "_MEIPASS", None)
    return Path(base) if base else Path(__file__).resolve().parent


def main():
    store = Store()
    srv = make_server(resource_dir() / "web", store, DEFAULT_TOKEN, DEFAULT_KEY)
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
        background_color="#FFF8EE",
    )
    webview.start()


if __name__ == "__main__":
    main()
