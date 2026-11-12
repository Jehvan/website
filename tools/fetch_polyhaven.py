"""Download CC0 Poly Haven textures / HDRIs into public/assets (1k JPG maps: diffuse, GL normal, ARM)."""
import json, os, sys, urllib.request

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "highkeep-road-asset-fetch"})
    return urllib.request.urlopen(req, timeout=120).read()

def texture(tid, res="1k"):
    d = os.path.join(OUT, "tex", tid)
    os.makedirs(d, exist_ok=True)
    files = json.loads(get(f"https://api.polyhaven.com/files/{tid}"))
    for key, short in (("Diffuse", "diff"), ("nor_gl", "nor"), ("arm", "arm")):
        if key not in files:
            print("  missing", key, "for", tid); continue
        path = os.path.join(d, short + ".jpg")
        if os.path.exists(path): continue
        open(path, "wb").write(get(files[key][res]["jpg"]["url"]))
    print("tex", tid)

def hdri(hid, res="1k"):
    d = os.path.join(OUT, "hdri"); os.makedirs(d, exist_ok=True)
    path = os.path.join(d, hid + ".hdr")
    if not os.path.exists(path):
        files = json.loads(get(f"https://api.polyhaven.com/files/{hid}"))
        open(path, "wb").write(get(files["hdri"][res]["hdr"]["url"]))
    print("hdri", hid)

if __name__ == "__main__":
    kind = sys.argv[1]
    for a in sys.argv[2:]:
        (texture if kind == "tex" else hdri)(a)
