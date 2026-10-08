"""Cliente da API do TMDB (filmes + séries + listas)."""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.themoviedb.org/3"
BASE4 = "https://api.themoviedb.org/4"
IMG = "https://image.tmdb.org/t/p"
SKIP_TV_GENRES = {10767, 10763}  # talk-show, notícias
SELF_RE = re.compile(r"^(self|himself|herself|themselves|ele mesmo|ela mesma)", re.I)


class TMDBError(Exception):
    pass


class TMDB:
    def __init__(self, token="", api_key="", region="BR", language="pt-BR"):
        self.token = (token or "").strip()
        self.api_key = (api_key or "").strip()
        self.region = region
        self.language = language
        self._cache = {}

    # ---------- rede ----------
    def _get(self, path, v4=False, **params):
        params.setdefault("language", self.language)
        headers = {"Accept": "application/json", "User-Agent": "MeuCinema/2.0"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        elif self.api_key and not v4:
            params["api_key"] = self.api_key
        else:
            raise TMDBError("Nenhuma chave do TMDB configurada. Vá em Ajustes.")
        url = (BASE4 if v4 else BASE) + path + "?" + urllib.parse.urlencode(params)
        hit = self._cache.get(url)
        if hit and time.time() - hit[0] < 600:
            return hit[1]
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 401:
                raise TMDBError("Chave do TMDB inválida. Confira em Ajustes.")
            if e.code == 404:
                raise TMDBError("Não encontrado.")
            raise TMDBError(f"Erro do TMDB ({e.code}).")
        except Exception:
            raise TMDBError("Sem conexão com o TMDB. Verifique sua internet.")
        self._cache[url] = (time.time(), data)
        return data

    @staticmethod
    def img(path, size):
        return f"{IMG}/{size}{path}" if path else None

    # ---------- cartões ----------
    def _card(self, m, kind=None):
        kind = kind or m.get("media_type") or ("tv" if ("name" in m and "title" not in m) else "movie")
        date = m.get("release_date") or m.get("first_air_date") or ""
        return {
            "type": kind,
            "id": m["id"],
            "title": m.get("title") or m.get("name") or m.get("original_title") or m.get("original_name") or "",
            "year": date[:4],
            "poster": self.img(m.get("poster_path"), "w342"),
            "vote": round(m.get("vote_average") or 0, 1),
        }

    # ---------- descoberta ----------
    def genres(self, kind):
        d = self._get(f"/genre/{kind}/list")
        return d.get("genres", [])

    def discover(self, kind="movie", sort="popular", genre="", decade="", page=1):
        kind = "tv" if kind == "tv" else "movie"
        page = max(1, int(page or 1))
        if sort == "trending":
            d = self._get(f"/trending/{kind}/week", page=page)
            res = d.get("results", [])
            if genre:
                res = [r for r in res if int(genre) in r.get("genre_ids", [])]
            if decade:
                lo = int(decade)
                res = [r for r in res if (r.get("release_date") or r.get("first_air_date") or "0000")[:4].isdigit()
                       and lo <= int((r.get("release_date") or r.get("first_air_date"))[:4]) < lo + 10]
        else:
            alpha = "original_title.asc" if kind == "movie" else "original_name.asc"
            sort_by, vc = {
                "popular": ("popularity.desc", 30),
                "alpha": (alpha, 400),
                "rating": ("vote_average.desc", 1500),
            }.get(sort, ("popularity.desc", 30))
            p = {"page": page, "include_adult": "false", "sort_by": sort_by, "vote_count.gte": vc}
            if genre:
                p["with_genres"] = genre
            if decade:
                lo = int(decade)
                key = "primary_release_date" if kind == "movie" else "first_air_date"
                p[key + ".gte"] = f"{lo}-01-01"
                p[key + ".lte"] = f"{lo + 9}-12-31"
            d = self._get(f"/discover/{kind}", **p)
            res = d.get("results", [])
        return {
            "items": [self._card(r, kind) for r in res],
            "page": page,
            "total_pages": min(d.get("total_pages", 1), 500),
        }

    def search(self, q, page=1):
        d = self._get("/search/multi", query=q, page=page, include_adult="false")
        titles, people = [], []
        for r in d.get("results", []):
            t = r.get("media_type")
            if t in ("movie", "tv"):
                titles.append(self._card(r))
            elif t == "person":
                people.append({
                    "id": r["id"],
                    "name": r.get("name", ""),
                    "photo": self.img(r.get("profile_path"), "w185"),
                    "dept": r.get("known_for_department", ""),
                    "known_for": ", ".join(
                        (k.get("title") or k.get("name") or "") for k in r.get("known_for", [])[:3]
                    ),
                })
        return {"movies": titles, "people": people}

    # ---------- detalhes ----------
    def details(self, kind, tid):
        kind = "tv" if kind == "tv" else "movie"
        tid = int(tid)
        if kind == "movie":
            d = self._get(f"/movie/{tid}", append_to_response="credits,watch/providers,videos")
            credits = d.get("credits", {})
            cast_raw = credits.get("cast", [])
            cast = [{"id": p["id"], "name": p.get("name", ""), "character": p.get("character", ""),
                     "photo": self.img(p.get("profile_path"), "w185")} for p in cast_raw[:30]]
            crew = credits.get("crew", [])
            directors = [{"id": p["id"], "name": p["name"], "photo": self.img(p.get("profile_path"), "w185")}
                         for p in crew if p.get("job") == "Director"]
            writers = sorted({p["name"] for p in crew if p.get("job") in ("Screenplay", "Writer", "Story")})[:4]
            runtime = d.get("runtime") or 0
            total = runtime
            date = d.get("release_date") or ""
            title = d.get("title", "")
            orig = d.get("original_title", "")
            seasons = []
            extra = {}
        else:
            d = self._get(f"/tv/{tid}", append_to_response="aggregate_credits,watch/providers,videos")
            cast = []
            for p in d.get("aggregate_credits", {}).get("cast", [])[:30]:
                roles = p.get("roles") or [{}]
                cast.append({"id": p["id"], "name": p.get("name", ""), "character": roles[0].get("character", ""),
                             "photo": self.img(p.get("profile_path"), "w185")})
            directors = [{"id": p["id"], "name": p["name"], "photo": self.img(p.get("profile_path"), "w185")}
                         for p in d.get("created_by", [])]
            writers = []
            ep = d.get("episode_run_time") or []
            runtime = ep[0] if ep else ((d.get("last_episode_to_air") or {}).get("runtime") or 45)
            total = runtime * (d.get("number_of_episodes") or 0)
            date = d.get("first_air_date") or ""
            title = d.get("name", "")
            orig = d.get("original_name", "")
            seasons = [{"n": s.get("season_number"), "name": s.get("name"), "episodes": s.get("episode_count"),
                        "year": (s.get("air_date") or "")[:4], "poster": self.img(s.get("poster_path"), "w185")}
                       for s in d.get("seasons", []) if s.get("season_number")]
            extra = {"seasons_count": d.get("number_of_seasons") or 0, "episodes_count": d.get("number_of_episodes") or 0,
                     "status": d.get("status", "")}

        prov = d.get("watch/providers", {}).get("results", {}).get(self.region, {})
        mk = lambda lst: [{"name": p["provider_name"], "logo": self.img(p.get("logo_path"), "w92")} for p in (lst or [])]
        trailer = None
        vids = d.get("videos", {}).get("results", [])
        if not vids and self.language != "en-US":
            try:
                vids = self._get(f"/{kind}/{tid}/videos", language="en-US").get("results", [])
            except TMDBError:
                vids = []
        for v in vids:
            if v.get("site") == "YouTube" and v.get("type") == "Trailer":
                trailer = "https://www.youtube.com/watch?v=" + v["key"]
                break
        out = {
            "type": kind, "id": d["id"], "title": title, "original_title": orig,
            "tagline": d.get("tagline", ""),
            "overview": d.get("overview", "") or "Sinopse não disponível em português.",
            "year": date[:4], "runtime": runtime, "runtime_total": total,
            "genres": [g["name"] for g in d.get("genres", [])],
            "vote": round(d.get("vote_average") or 0, 1),
            "poster": self.img(d.get("poster_path"), "w500"),
            "poster_small": self.img(d.get("poster_path"), "w342"),
            "backdrop": self.img(d.get("backdrop_path"), "w1280"),
            "cast": cast, "directors": directors,
            "director_label": "Criação" if kind == "tv" else "Direção",
            "writers": writers, "seasons": seasons,
            "providers": {"stream": mk(prov.get("flatrate")), "rent": mk(prov.get("rent")),
                          "buy": mk(prov.get("buy")), "link": prov.get("link")},
            "trailer": trailer,
        }
        out.update(extra)
        return out

    # ---------- pessoa ----------
    def person(self, pid):
        d = self._get(f"/person/{int(pid)}", append_to_response="combined_credits")
        mc = d.get("combined_credits", {})
        films = {}

        def add(item, role):
            kind = item.get("media_type")
            if kind not in ("movie", "tv"):
                return
            date = item.get("release_date") or item.get("first_air_date")
            if not date and not item.get("poster_path"):
                return
            if kind == "tv" and role == "Ator":
                if SKIP_TV_GENRES & set(item.get("genre_ids", [])):
                    return
                if SELF_RE.match(item.get("character") or ""):
                    return
            k = f"{kind}:{item['id']}"
            card = films.setdefault(k, {**self._card(item), "key": k, "roles": [], "pop": item.get("popularity", 0)})
            if role not in card["roles"]:
                card["roles"].append(role)
            ch = item.get("character")
            if ch and role == "Ator":
                card["character"] = ch

        for c in mc.get("cast", []):
            add(c, "Ator")
        job_map = {"Director": "Direção", "Writer": "Roteiro", "Screenplay": "Roteiro", "Producer": "Produção",
                   "Executive Producer": "Produção", "Creator": "Direção"}
        for c in mc.get("crew", []):
            r = job_map.get(c.get("job"))
            if r:
                add(c, r)
        flist = sorted(films.values(), key=lambda f: f["year"] or "0000", reverse=True)
        return {
            "id": d["id"], "name": d.get("name", ""),
            "photo": self.img(d.get("profile_path"), "w500"),
            "bio": d.get("biography", "") or "Biografia não disponível em português.",
            "birthday": d.get("birthday") or "", "deathday": d.get("deathday") or "",
            "place": d.get("place_of_birth") or "", "dept": d.get("known_for_department", ""),
            "films": flist,
        }

    # ---------- listas públicas do TMDB ----------
    @staticmethod
    def parse_list_id(text):
        m = re.search(r"list/(\d+)", text or "") or re.fullmatch(r"\s*(\d+)\s*", text or "")
        if not m:
            raise TMDBError("Link inválido. Cole o endereço da lista (ex.: themoviedb.org/list/8136).")
        return int(m.group(1))

    def tmdb_list(self, lid):
        items, name, desc, by, page, total = [], "", "", "", 1, 1
        while page <= min(total, 10):
            if self.token:
                d = self._get(f"/list/{int(lid)}", v4=True, page=page)
                name, desc = d.get("name", name), d.get("description", desc)
                by = (d.get("created_by") or {}).get("name") or (d.get("created_by") or {}).get("username") or by
                res = d.get("results", [])
                total = d.get("total_pages", 1)
            else:
                d = self._get(f"/list/{int(lid)}")
                name, desc, by = d.get("name", ""), d.get("description", ""), d.get("created_by", "")
                res = d.get("items", [])
                total = 1
            for r in res:
                if r.get("media_type") in ("movie", "tv", None):
                    items.append(self._card(r))
            page += 1
        return {"id": int(lid), "name": name or f"Lista {lid}", "description": desc or "", "by": by or "",
                "items": items}
