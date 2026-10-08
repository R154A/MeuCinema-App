"""Armazenamento local (JSON): biblioteca, listas, perfil e configurações."""
import json
import os
import sys
import threading
import time
import uuid
from pathlib import Path

ENTRY_KEYS = ("type", "title", "year", "poster", "runtime", "genres", "cast", "directors",
              "watched", "watchlist", "rating", "review", "liked", "watched_on", "tags")


def data_dir():
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA") or str(Path.home())
    elif sys.platform == "darwin":
        base = str(Path.home() / "Library" / "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    p = Path(base) / "MeuCinema"
    p.mkdir(parents=True, exist_ok=True)
    return p


class Store:
    def __init__(self, folder=None):
        self.dir = Path(folder) if folder else data_dir()
        self.dir.mkdir(parents=True, exist_ok=True)
        self.lib_file = self.dir / "biblioteca.json"
        self.cfg_file = self.dir / "config.json"
        self.lists_file = self.dir / "listas.json"
        self.lock = threading.Lock()
        self.library = self._migrate(self._read(self.lib_file, {}))
        self.config = self._read(self.cfg_file, {})
        self.lists = self._read(self.lists_file, {"mine": [], "tmdb": []})
        self.lists.setdefault("mine", [])
        self.lists.setdefault("tmdb", [])

    @staticmethod
    def _migrate(lib):
        """Versão 1 guardava só filmes com chave numérica; agora é 'movie:ID' / 'tv:ID'."""
        out = {}
        for k, v in lib.items():
            if ":" not in str(k):
                k = f"movie:{k}"
            v.setdefault("type", k.split(":")[0])
            v["key"] = k
            out[k] = v
        return out

    @staticmethod
    def _read(path, default):
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default

    @staticmethod
    def _write(path, data):
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, path)

    def _save_lib(self):
        self._write(self.lib_file, self.library)

    def _save_lists(self):
        self._write(self.lists_file, self.lists)

    # ---- config / perfil ----
    def set_config(self, **kw):
        with self.lock:
            self.config.update(kw)
            self._write(self.cfg_file, self.config)

    def get_profile(self):
        return self.config.get("profile", {})

    def set_profile(self, patch):
        with self.lock:
            p = self.config.setdefault("profile", {})
            for k in ("name", "birthdate", "bio", "photo", "goal", "favorites"):
                if k in patch:
                    p[k] = patch[k]
            self._write(self.cfg_file, self.config)
            return p

    # ---- biblioteca ----
    def get(self, key):
        return self.library.get(key)

    def update(self, key, patch):
        kind, _, mid = key.partition(":")
        with self.lock:
            e = self.library.get(key) or {
                "key": key, "id": int(mid), "type": kind, "watched": False, "watchlist": False,
                "rating": 0, "review": "", "liked": False, "tags": [],
                "watched_on": None, "added_on": int(time.time()),
            }
            for k in ENTRY_KEYS:
                if k in patch:
                    e[k] = patch[k]
            tg = list(e.get("tags") or [])
            if patch.get("tags_add") and patch["tags_add"] not in tg:
                tg.append(patch["tags_add"])
            if patch.get("tags_remove") in tg:
                tg.remove(patch["tags_remove"])
            e["tags"] = tg
            if patch.get("watched") is True:
                e["watchlist"] = False
                if not e.get("watched_on"):
                    e["watched_on"] = time.strftime("%Y-%m-%d")
            if patch.get("watched") is False:
                e["watched_on"] = None
            e["updated"] = int(time.time())
            if not (e["watched"] or e["watchlist"] or e["rating"] or e["review"] or e["liked"] or e.get("tags")):
                self.library.pop(key, None)
                e = None
            else:
                self.library[key] = e
            self._save_lib()
            return e

    # ---- listas próprias ----
    def _find(self, lid):
        for l in self.lists["mine"]:
            if l["id"] == lid:
                return l
        return None

    def create_list(self, name, desc="", items=None):
        with self.lock:
            l = {"id": uuid.uuid4().hex[:8], "name": (name or "Nova lista").strip()[:80],
                 "desc": (desc or "").strip()[:500], "items": items or [], "created": int(time.time())}
            self.lists["mine"].append(l)
            self._save_lists()
            return l

    def get_list(self, lid):
        return self._find(lid)

    def edit_list(self, lid, patch):
        with self.lock:
            l = self._find(lid)
            if not l:
                raise ValueError("Lista não encontrada.")
            if "name" in patch and patch["name"].strip():
                l["name"] = patch["name"].strip()[:80]
            if "desc" in patch:
                l["desc"] = patch["desc"].strip()[:500]
            if "add" in patch:
                a = patch["add"]
                if not any(i["key"] == a["key"] for i in l["items"]):
                    l["items"].append({k: a.get(k) for k in ("key", "type", "id", "title", "year", "poster")})
            if "remove" in patch:
                l["items"] = [i for i in l["items"] if i["key"] != patch["remove"]]
            self._save_lists()
            return l

    def delete_list(self, lid):
        with self.lock:
            self.lists["mine"] = [l for l in self.lists["mine"] if l["id"] != lid]
            self._save_lists()

    def add_tmdb_ref(self, lid, name):
        with self.lock:
            if not any(r["id"] == lid for r in self.lists["tmdb"]):
                self.lists["tmdb"].append({"id": lid, "name": name})
                self._save_lists()

    def remove_tmdb_ref(self, lid):
        with self.lock:
            self.lists["tmdb"] = [r for r in self.lists["tmdb"] if r["id"] != lid]
            self._save_lists()

    # ---- backup ----
    def export(self):
        return {"app": "MeuCinema", "version": 2, "library": self.library, "lists": self.lists,
                "profile": self.get_profile()}

    def import_(self, data, merge=True):
        lib = data.get("library") if isinstance(data, dict) else None
        if not isinstance(lib, dict):
            raise ValueError("Arquivo de backup inválido.")
        lib = self._migrate(lib)
        with self.lock:
            if merge:
                for k, v in lib.items():
                    cur = self.library.get(k)
                    if not cur or v.get("updated", 0) >= cur.get("updated", 0):
                        self.library[k] = v
                have = {l["id"] for l in self.lists["mine"]}
                for l in (data.get("lists") or {}).get("mine", []):
                    if l.get("id") not in have:
                        self.lists["mine"].append(l)
                have_t = {r["id"] for r in self.lists["tmdb"]}
                for r in (data.get("lists") or {}).get("tmdb", []):
                    if r.get("id") not in have_t:
                        self.lists["tmdb"].append(r)
                if data.get("profile") and not self.config.get("profile"):
                    self.config["profile"] = data["profile"]
                    self._write(self.cfg_file, self.config)
            else:
                self.library = lib
                self.lists = data.get("lists") or {"mine": [], "tmdb": []}
                if data.get("profile"):
                    self.config["profile"] = data["profile"]
                    self._write(self.cfg_file, self.config)
            self._save_lib()
            self._save_lists()
        return len(lib)
