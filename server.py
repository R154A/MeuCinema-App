"""Servidor HTTP local (só 127.0.0.1) que liga a interface ao TMDB e ao armazenamento."""
import json
import mimetypes
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from tmdb import TMDB, TMDBError


def make_server(web_dir, store, default_token="", default_key="", tmdb_factory=None, port=0):
    web_dir = Path(web_dir)

    def build_tmdb():
        if tmdb_factory:
            return tmdb_factory()
        return TMDB(
            token=store.config.get("token", default_token),
            api_key=store.config.get("api_key", default_key),
        )

    state = {"tmdb": build_tmdb()}

    class H(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *a):
            pass

        def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
            if not isinstance(body, (bytes, bytearray)):
                body = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _body(self):
            n = int(self.headers.get("Content-Length") or 0)
            if not n:
                return {}
            return json.loads(self.rfile.read(n).decode("utf-8"))

        def _api(self, method):
            u = urlparse(self.path)
            p, q = u.path, parse_qs(u.query)
            g = lambda k, d="": q.get(k, [d])[0]
            t = state["tmdb"]
            try:
                if method == "GET":
                    if p == "/api/discover":
                        return self._send(200, t.discover(g("type", "movie"), g("sort", "popular"),
                                                          g("genre"), g("decade"), g("page", "1")))
                    if p == "/api/genres":
                        return self._send(200, t.genres(g("type", "movie")))
                    if p == "/api/search":
                        return self._send(200, t.search(g("q")))
                    m = re.fullmatch(r"/api/(movie|tv)/(\d+)", p)
                    if m:
                        d = t.details(m.group(1), m.group(2))
                        d["mine"] = store.get(f"{m.group(1)}:{m.group(2)}")
                        return self._send(200, d)
                    m = re.fullmatch(r"/api/person/(\d+)", p)
                    if m:
                        d = t.person(m.group(1))
                        for f in d["films"]:
                            f["watched"] = bool(store.library.get(f["key"], {}).get("watched"))
                        return self._send(200, d)
                    if p == "/api/library":
                        return self._send(200, list(store.library.values()))
                    if p == "/api/lists":
                        return self._send(200, store.lists)
                    m = re.fullmatch(r"/api/lists/(\w+)", p)
                    if m:
                        l = store.get_list(m.group(1))
                        return self._send(200, l) if l else self._send(404, {"error": "Lista não encontrada."})
                    m = re.fullmatch(r"/api/tmdblist/(\d+)", p)
                    if m:
                        return self._send(200, t.tmdb_list(m.group(1)))
                    if p == "/api/profile":
                        return self._send(200, store.get_profile())
                    if p == "/api/export":
                        return self._send(
                            200, store.export(),
                            extra={"Content-Disposition": 'attachment; filename="meucinema-backup.json"'},
                        )
                    if p == "/api/settings":
                        c = store.config
                        has = bool(c.get("token") or c.get("api_key") or t.token or t.api_key)
                        return self._send(200, {"configured": has, "folder": str(store.dir),
                                                "transparency": c.get("transparency", True),
                                                "theme": c.get("theme", "dark")})
                else:
                    body = self._body()
                    m = re.fullmatch(r"/api/library/(movie|tv)/(\d+)", p)
                    if m:
                        return self._send(200, {"entry": store.update(f"{m.group(1)}:{m.group(2)}", body)})
                    if p == "/api/import":
                        return self._send(200, {"imported": store.import_(body, merge=True)})
                    if p == "/api/profile":
                        return self._send(200, store.set_profile(body))
                    if p == "/api/lists":
                        return self._send(200, store.create_list(body.get("name"), body.get("desc", "")))
                    m = re.fullmatch(r"/api/lists/(\w+)/delete", p)
                    if m:
                        store.delete_list(m.group(1))
                        return self._send(200, {"ok": True})
                    m = re.fullmatch(r"/api/lists/(\w+)", p)
                    if m:
                        return self._send(200, store.edit_list(m.group(1), body))
                    if p == "/api/tmdblists":
                        lid = t.parse_list_id(body.get("url", ""))
                        data = t.tmdb_list(lid)
                        store.add_tmdb_ref(lid, data["name"])
                        return self._send(200, {"id": lid, "name": data["name"]})
                    m = re.fullmatch(r"/api/tmdblists/(\d+)/remove", p)
                    if m:
                        store.remove_tmdb_ref(int(m.group(1)))
                        return self._send(200, {"ok": True})
                    m = re.fullmatch(r"/api/tmdblists/(\d+)/copy", p)
                    if m:
                        data = t.tmdb_list(m.group(1))
                        items = [{"key": f"{i['type']}:{i['id']}", **{k: i[k] for k in ("type", "id", "title", "year", "poster")}}
                                 for i in data["items"]]
                        return self._send(200, store.create_list(data["name"], data["description"], items))
                    if p == "/api/settings":
                        if "transparency" in body:
                            store.set_config(transparency=bool(body["transparency"]))
                        if body.get("theme") in ("dark", "light"):
                            store.set_config(theme=body["theme"])
                        tok = (body.get("token") or "").strip()
                        if tok:
                            if len(tok) > 60:
                                store.set_config(token=tok, api_key="")
                            else:
                                store.set_config(api_key=tok, token="")
                            state["tmdb"] = build_tmdb()
                        return self._send(200, {"ok": True})
                return self._send(404, {"error": "Rota não encontrada"})
            except TMDBError as e:
                return self._send(502, {"error": str(e)})
            except (ValueError, KeyError, json.JSONDecodeError) as e:
                return self._send(400, {"error": f"Pedido inválido: {e}"})
            except Exception as e:  # noqa
                return self._send(500, {"error": f"Erro interno: {e}"})

        def do_GET(self):
            path = urlparse(self.path).path
            if path.startswith("/api/"):
                return self._api("GET")
            rel = "index.html" if path in ("", "/") else path.lstrip("/")
            f = (web_dir / rel).resolve()
            if web_dir.resolve() not in f.parents or not f.is_file():
                return self._send(404, b"not found", "text/plain")
            ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype.endswith("javascript"):
                ctype += "; charset=utf-8"
            self._send(200, f.read_bytes(), ctype)

        def do_POST(self):
            self._api("POST")

    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    srv.daemon_threads = True
    return srv


def serve_in_thread(srv):
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    return th
