// Builds the 3D stage from a Layout (ground, KayKit props, walls, water, lights, fog, grass) and mirrors the
// simulation into it every frame: hero, enemies, projectiles, telegraphs, pickups, effects, click marker.
using System.Collections.Generic;
using Highkeep.Core;
using UnityEngine;

namespace Highkeep
{
    public sealed class StageView
    {
        public readonly GameObject Root;
        public readonly Layout L;
        public readonly Theme Th;
        public readonly bool Town;
        readonly Transform props, dyn;
        readonly List<(Light light, float baseI, float seed)> torches = new List<(Light, float, float)>();
        readonly List<Vector3> lightSpots = new List<Vector3>();
        readonly List<(Transform t, float seed, float baseScale)> flames = new List<(Transform, float, float)>();
        readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();
        public Light Sun;
        float time;

        // dynamic views
        public CharacterView Hero;
        readonly Dictionary<int, CharacterView> foes = new Dictionary<int, CharacterView>();
        readonly Dictionary<object, GameObject> projViews = new Dictionary<object, GameObject>();
        readonly Dictionary<object, GameObject> zoneViews = new Dictionary<object, GameObject>();
        readonly Dictionary<object, GameObject> pickViews = new Dictionary<object, GameObject>();
        readonly Dictionary<object, GameObject> fxViews = new Dictionary<object, GameObject>();
        GameObject clickMarker;
        float clickT = 9f;
        Vector3 clickPos;

        public StageView(Layout layout, string groundName, bool town = false)
        {
            L = layout;
            Town = town;
            Th = Theme.Get(L.Theme);
            Root = new GameObject("Stage_" + L.Theme);
            props = new GameObject("props").transform;
            props.SetParent(Root.transform, false);
            dyn = new GameObject("dynamic").transform;
            dyn.SetParent(Root.transform, false);
            BuildGround(groundName);
            BuildLighting();
            BuildProps();
            if (L.Indoor) BuildHallWalls();
            else BuildPerimeter();
            if (L.HasRiver) BuildRiver();
            foreach (var p in L.Pools) BuildPool(p.x, p.y, p.r);
            BuildGrass();
            BuildMotes();
            StaticBatchingUtility.Combine(props.gameObject);
        }

        readonly List<CharacterView> extraViews = new List<CharacterView>();

        public void Destroy()
        {
            foreach (var v in extraViews) v.Destroy();
            ClearNpcs();
            Hero?.Destroy();
            foreach (var v in foes.Values) v.Destroy();
            Object.Destroy(Root);
        }

        // ---------------------------------------------------------------- ground & lighting
        void BuildGround(string groundName)
        {
            float w = (float)L.W * W3.S, h = (float)L.H * W3.S;
            var mesh = new Mesh { name = "ground" };
            // a grid (not one quad) so per-vertex fog and shadows behave on big maps
            int nx = 32, nz = 24;
            var v = new Vector3[(nx + 1) * (nz + 1)];
            var uv = new Vector2[v.Length];
            for (int z = 0; z <= nz; z++)
                for (int x = 0; x <= nx; x++)
                {
                    float fx = (float)x / nx, fz = (float)z / nz;
                    v[z * (nx + 1) + x] = new Vector3(fx * w, 0, -h + fz * h);
                    uv[z * (nx + 1) + x] = new Vector2(fx, fz);
                }
            var tris = new int[nx * nz * 6];
            int k = 0;
            for (int z = 0; z < nz; z++)
                for (int x = 0; x < nx; x++)
                {
                    int i = z * (nx + 1) + x;
                    tris[k++] = i; tris[k++] = i + nx + 1; tris[k++] = i + 1;
                    tris[k++] = i + 1; tris[k++] = i + nx + 1; tris[k++] = i + nx + 2;
                }
            mesh.vertices = v;
            mesh.uv = uv;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            var mat = new Material(Res.Shader("Highkeep/Ground")) { name = "ground" };
            var tex = Res.Load<Texture2D>("Ground/" + groundName);
            if (tex != null)
            {
                tex.wrapMode = TextureWrapMode.Clamp;
                tex.anisoLevel = 8;
                mat.SetTexture("_MainTex", tex);
            }
            var det = Res.Load<Texture2D>("Textures/detail");
            if (det != null)
            {
                det.wrapMode = TextureWrapMode.Repeat;
                mat.SetTexture("_Detail", det);
            }
            mat.SetFloat("_DetailTiling", L.Indoor ? 18f : 46f);
            mat.SetFloat("_DetailStrength", L.Indoor ? 0.3f : 0.55f);
            var go = new GameObject("ground");
            go.transform.SetParent(Root.transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.receiveShadows = true;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            // dark skirt so the world never ends in a void
            var skirt = GameObject.CreatePrimitive(PrimitiveType.Plane);
            Object.Destroy(skirt.GetComponent<Collider>());
            skirt.name = "skirt";
            skirt.transform.SetParent(Root.transform, false);
            skirt.transform.position = new Vector3(w / 2, -0.05f, -h / 2);
            skirt.transform.localScale = new Vector3(w / 10 * 6, 1, h / 10 * 6);
            skirt.GetComponent<Renderer>().sharedMaterial = Res.LitMaterial(null, Th.Skirt, 0f, 0f);
        }

        void BuildLighting()
        {
            var sunGo = new GameObject("sun");
            sunGo.transform.SetParent(Root.transform, false);
            Sun = sunGo.AddComponent<Light>();
            Sun.type = LightType.Directional;
            Sun.color = Th.Sun;
            Sun.intensity = Th.SunIntensity;
            Sun.shadows = LightShadows.Soft;
            Sun.shadowStrength = Th.Indoor ? 0.6f : 0.85f;
            Sun.shadowBias = 0.04f;
            Sun.shadowNormalBias = 0.3f;
            sunGo.transform.rotation = Quaternion.Euler(Th.SunPitch, Th.SunYaw, 0);
            RenderSettings.sun = Sun;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Th.Sky;
            RenderSettings.ambientEquatorColor = Th.Equator;
            RenderSettings.ambientGroundColor = Th.Ground;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = Th.Fog;
            RenderSettings.fogDensity = Th.FogDensity;
            RenderSettings.skybox = null;
            foreach (var (x, y) in L.Lights) lightSpots.Add(W3.Pos(x, y, 2.2f));
            // a pool of real point lights that follow the nearest torches/braziers
            for (int i = 0; i < 6; i++)
            {
                var lg = new GameObject("torchlight" + i);
                lg.transform.SetParent(Root.transform, false);
                var l = lg.AddComponent<Light>();
                l.type = LightType.Point;
                l.color = Th.TorchColor;
                l.range = 9f;
                l.intensity = 0;
                l.shadows = LightShadows.None;
                l.renderMode = LightRenderMode.ForcePixel;
                torches.Add((l, Th.TorchIntensity, i * 1.7f));
            }
        }

        // ---------------------------------------------------------------- props
        GameObject Place(string kind, double x, double y, double rot, double s, float yOff = 0)
        {
            var spec = ModelCatalog.Pick(kind, x, y);
            if (spec == null) return null;
            return Res.Spawn(spec, props, W3.Pos(x, y, yOff), W3.Yaw(-rot) - 90f, (float)s);
        }

        void BuildProps()
        {
            foreach (var p in L.Props)
            {
                string kind = p.Kind;
                switch (kind)
                {
                    case "grass": case "carpet": continue;
                    case "tree":
                        Place(p.Flag("pine") ? "pine" : "tree", p.X, p.Y, p.Rot, p.S);
                        continue;
                    case "deadtree":
                        var dt = Place("deadtree", p.X, p.Y, p.Rot, p.S);
                        if (dt) Tint(dt, new Color(0.55f, 0.5f, 0.45f));
                        // a gnarled leafless trunk reads better than a stump: stack a dead pine
                        var trunk = Place("pine", p.X, p.Y, p.Rot, p.S * 0.8);
                        if (trunk) Tint(trunk, new Color(0.25f, 0.24f, 0.2f));
                        continue;
                    case "wall":
                        PlaceRow("wall", p.X, p.Y, p.Num("w", 700));
                        continue;
                    case "tower":
                        Place("tower", p.X, p.Y + 10, 0, p.S);
                        continue;
                    case "portcullis":
                        Place("portcullis", p.X, p.Y + 8, 0, 1);
                        continue;
                    case "banner":
                        Place("banner", p.X, Town || L.Indoor ? p.Y - 8 : p.Y, 0, p.S);
                        continue;
                    case "brazier": case "lamp": case "campfire":
                        Place(kind, p.X, p.Y, p.Rot, kind == "campfire" ? p.S : 1);
                        AddFire(p.X, p.Y, kind == "campfire" ? 0.35f : kind == "brazier" ? 2.45f : 2.25f, kind == "campfire" ? 1.6f : 0.9f);
                        if (!L.Lights.Exists(l => System.Math.Abs(l.x - p.X) < 1 && System.Math.Abs(l.y - p.Y) < 1)) lightSpots.Add(W3.Pos(p.X, p.Y, 2.2f));
                        continue;
                    case "bridge":
                        BuildBridge();
                        continue;
                    case "throne":
                        BuildThrone(p.X, p.Y);
                        continue;
                    case "fountain":
                        BuildFountain(p.X, p.Y, p.S);
                        continue;
                    case "crystal":
                        BuildCrystal(p.X, p.Y, p.S);
                        continue;
                    case "tent": case "tent_blue":
                        Place(Town ? "market" : "tent", p.X, p.Y, p.Rot, Town ? 1.0 : p.S);
                        continue;
                    case "cottage":
                        Place("cottage", p.X, p.Y, p.Rot, p.S * 0.85);
                        continue;
                    default:
                        Place(kind, p.X, p.Y, p.Rot, p.S);
                        continue;
                }
            }
            if (Town)
            {
                Place("tavern", 1450, 980, 2.6, 1);
                Place("windmill", 140, 120, 0.4, 1);
                Place("church", 1460, 120, -0.3, 1);
            }
        }

        void Tint(GameObject go, Color c)
        {
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                r.GetPropertyBlock(mpb);
                mpb.SetColor("_Color", c);
                r.SetPropertyBlock(mpb);
            }
        }

        void PlaceRow(string kind, double cx, double cy, double wpx)
        {
            var spec = ModelCatalog.Pick(kind, cx, cy);
            if (spec == null) return;
            var proto = Res.Proto(spec);
            var b = Res.Bounds(proto.transform);
            float seg = Mathf.Max(0.5f, Mathf.Max(b.size.x, b.size.z)) * 0.98f;
            float total = (float)wpx * W3.S;
            int n = Mathf.Max(1, Mathf.CeilToInt(total / seg));
            for (int i = 0; i < n; i++)
            {
                float fx = (float)(cx * W3.S) - total / 2 + seg * (i + 0.5f);
                Res.Spawn(spec, props, new Vector3(fx, 0, -(float)cy * W3.S), b.size.x >= b.size.z ? 0 : 90);
            }
        }

        void AddFire(double x, double y, float h, float size)
        {
            var root = new GameObject("fire");
            root.transform.SetParent(dyn, false);
            root.transform.position = W3.Pos(x, y, h);
            var glow = FxLib.Make("glow", FxLib.Quad, FxLib.Add(FxLib.Glow, Th.TorchColor, 1.2f), root.transform);
            glow.transform.localScale = Vector3.one * (size * 3.2f);
            glow.AddComponent<Billboard>();
            for (int i = 0; i < 2; i++)
            {
                var f = FxLib.Make("flame", FxLib.Quad, FxLib.Add(FxLib.Flame, Color.white, 1.6f), root.transform);
                f.transform.localPosition = new Vector3((i - 0.5f) * 0.12f * size, 0.25f * size, 0);
                f.transform.localScale = new Vector3(0.6f, 1f, 1f) * size;
                f.AddComponent<Billboard>().UprightOnly = true;
                flames.Add((f.transform, Random.value * 10f, size));
            }
        }

        void BuildBridge()
        {
            float x0 = (float)L.BridgeX0 * W3.S, x1 = (float)L.BridgeX1 * W3.S, y = -(float)L.BridgeY * W3.S, w = (float)L.BridgeW * W3.S;
            var wood = Res.LitMaterial("Models/Dungeon/dungeon_texture", new Color(0.55f, 0.4f, 0.28f), 0.05f, 0.05f);
            var stone = Res.LitMaterial(null, new Color(0.45f, 0.43f, 0.4f), 0.05f, 0.05f);
            var deck = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(deck.GetComponent<Collider>());
            deck.transform.SetParent(props, false);
            deck.transform.position = new Vector3((x0 + x1) / 2, 0.08f, y);
            deck.transform.localScale = new Vector3(x1 - x0, 0.25f, w);
            deck.GetComponent<Renderer>().sharedMaterial = wood;
            for (int s = -1; s <= 1; s += 2)
            {
                var rail = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(rail.GetComponent<Collider>());
                rail.transform.SetParent(props, false);
                rail.transform.position = new Vector3((x0 + x1) / 2, 0.9f, y + s * (w / 2 - 0.1f));
                rail.transform.localScale = new Vector3(x1 - x0, 0.14f, 0.18f);
                rail.GetComponent<Renderer>().sharedMaterial = wood;
                for (float px = x0; px <= x1 + 0.01f; px += (x1 - x0) / 5)
                {
                    var post = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    Object.Destroy(post.GetComponent<Collider>());
                    post.transform.SetParent(props, false);
                    post.transform.position = new Vector3(px, 0.5f, y + s * (w / 2 - 0.1f));
                    post.transform.localScale = new Vector3(0.22f, 1.0f, 0.22f);
                    post.GetComponent<Renderer>().sharedMaterial = wood;
                }
                foreach (float px in new[] { x0, x1 })
                {
                    var pier = GameObject.CreatePrimitive(PrimitiveType.Cube);
                    Object.Destroy(pier.GetComponent<Collider>());
                    pier.transform.SetParent(props, false);
                    pier.transform.position = new Vector3(px, 0.4f, y + s * (w / 2 + 0.3f));
                    pier.transform.localScale = new Vector3(1.0f, 1.2f, 0.8f);
                    pier.GetComponent<Renderer>().sharedMaterial = stone;
                }
            }
        }

        void BuildThrone(double x, double y)
        {
            var stone = Res.LitMaterial(null, new Color(0.42f, 0.4f, 0.42f), 0.05f, 0.1f);
            var red = Res.LitMaterial(null, new Color(0.45f, 0.06f, 0.06f), 0.1f, 0.2f);
            for (int i = 0; i < 3; i++)
            {
                var step = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(step.GetComponent<Collider>());
                step.transform.SetParent(props, false);
                step.transform.position = W3.Pos(x, y - 10 - i * 6, 0.2f + i * 0.4f);
                step.transform.localScale = new Vector3(13.6f - i * 3, 0.4f, 5.2f - i * 1.1f);
                step.GetComponent<Renderer>().sharedMaterial = i == 2 ? red : stone;
            }
            Place("throne", x, y - 20, System.Math.PI / 2, 1, 1.2f);
            Place("banner", x - 120, y - 40, System.Math.PI / 2, 1.2);
            Place("banner", x + 120, y - 40, System.Math.PI / 2, 1.2);
            Place("chest", x - 220, y + 10, System.Math.PI / 2, 1);
            Place("keg", x + 220, y + 10, 0, 1);
            var heir = new CharacterView("heir", props);
            extraViews.Add(heir);
            heir.Root.transform.position = W3.Pos(x, y + 32, 1.2f);
            heir.Root.transform.rotation = Quaternion.Euler(0, 180, 0);
            var g = FxLib.Make("heirglow", FxLib.Flat, FxLib.Add(FxLib.Glow, new Color(0.55f, 0.65f, 1f), 0.6f), heir.Root.transform);
            g.transform.localScale = Vector3.one * 3f;
            g.transform.localPosition = new Vector3(0, 0.05f, 0);
        }

        void BuildFountain(double x, double y, double s)
        {
            var stone = Res.LitMaterial(null, new Color(0.62f, 0.6f, 0.56f), 0.05f, 0.15f);
            var c = W3.Pos(x, y);
            float r = 2.6f * (float)s * 0.75f;
            for (int i = 0; i < 16; i++)
            {
                float a = i / 16f * Mathf.PI * 2;
                var seg = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(seg.GetComponent<Collider>());
                seg.transform.SetParent(props, false);
                seg.transform.position = c + new Vector3(Mathf.Cos(a) * r, 0.45f, Mathf.Sin(a) * r);
                seg.transform.rotation = Quaternion.Euler(0, -a * Mathf.Rad2Deg, 0);
                seg.transform.localScale = new Vector3(0.55f, 0.9f, r * 0.42f);
                seg.GetComponent<Renderer>().sharedMaterial = stone;
            }
            var water = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.Destroy(water.GetComponent<Collider>());
            water.transform.SetParent(props, false);
            water.transform.position = c + new Vector3(0, 0.55f, 0);
            water.transform.localScale = new Vector3(r * 2, 0.02f, r * 2);
            water.GetComponent<Renderer>().sharedMaterial = WaterMat();
            var col = ModelCatalog.Props["column"][0];
            Res.Spawn(col, props, c, 0, 1.3f);
            var spray = FxLib.Make("spray", FxLib.Quad, FxLib.Add(FxLib.Glow, new Color(0.6f, 0.8f, 1f), 0.5f), dyn);
            spray.transform.position = c + new Vector3(0, 3.6f, 0);
            spray.transform.localScale = Vector3.one * 2.2f;
            spray.AddComponent<Billboard>();
        }

        void BuildCrystal(double x, double y, double s)
        {
            var mat = Res.FxMaterial("Highkeep/Additive", FxLib.Soft, new Color(0.35f, 0.65f, 1f), 1.4f);
            var core = Res.LitMaterial(null, new Color(0.25f, 0.45f, 0.8f), 1.5f, 0.9f);
            var c = W3.Pos(x, y);
            var rnd = new System.Random((int)(x * 13 + y));
            for (int i = 0; i < 5; i++)
            {
                var sh = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(sh.GetComponent<Collider>());
                sh.transform.SetParent(props, false);
                float a = (float)rnd.NextDouble() * 6.28f, d = i == 0 ? 0 : 0.35f;
                float h = (i == 0 ? 1.8f : 0.8f + (float)rnd.NextDouble() * 0.8f) * (float)s;
                sh.transform.position = c + new Vector3(Mathf.Cos(a) * d, h * 0.4f, Mathf.Sin(a) * d);
                sh.transform.rotation = Quaternion.Euler((float)rnd.NextDouble() * 30 - 15, (float)rnd.NextDouble() * 360, (float)rnd.NextDouble() * 30 - 15);
                sh.transform.localScale = new Vector3(0.28f, h, 0.28f);
                sh.GetComponent<Renderer>().sharedMaterial = core;
            }
            var g = FxLib.Make("crystalglow", FxLib.Quad, mat, dyn);
            g.transform.position = c + new Vector3(0, 1f, 0);
            g.transform.localScale = Vector3.one * 4f * (float)s;
            g.AddComponent<Billboard>();
            lightSpots.Add(c + new Vector3(0, 1.5f, 0));
        }

        Material water;
        Material WaterMat()
        {
            if (water) return water;
            water = new Material(Res.Shader("Highkeep/Water")) { name = "water" };
            var det = Res.Load<Texture2D>("Textures/detail");
            if (det) water.SetTexture("_Ripples", det);
            if (L.Theme == "marsh")
            {
                water.SetColor("_Color", new Color(0.12f, 0.16f, 0.1f, 0.9f));
                water.SetColor("_Shallow", new Color(0.35f, 0.42f, 0.25f, 1f));
            }
            return water;
        }

        void BuildRiver()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
            Object.Destroy(go.GetComponent<Collider>());
            go.name = "river";
            go.transform.SetParent(Root.transform, false);
            float x0 = (float)(L.RiverX0 - 4) * W3.S, x1 = (float)(L.RiverX1 + 4) * W3.S, h = (float)L.H * W3.S;
            go.transform.position = new Vector3((x0 + x1) / 2, 0.04f, -h / 2);
            go.transform.rotation = Quaternion.Euler(90, 0, 0);
            go.transform.localScale = new Vector3(x1 - x0, h * 1.4f, 1);
            go.GetComponent<Renderer>().sharedMaterial = WaterMat();
        }

        void BuildPool(double x, double y, double r)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Object.Destroy(go.GetComponent<Collider>());
            go.name = "pool";
            go.transform.SetParent(Root.transform, false);
            go.transform.position = W3.Pos(x, y, 0.03f);
            float d = (float)r * 2 * W3.S;
            go.transform.localScale = new Vector3(d, 0.01f, d * 0.92f);
            go.GetComponent<Renderer>().sharedMaterial = WaterMat();
            for (int i = 0; i < 6; i++)
            {
                float a = i / 6f * 6.28f + (float)x;
                Place("reeds", x + System.Math.Cos(a) * r * 0.95, y + System.Math.Sin(a) * r * 0.95, a, 1.2);
            }
        }

        void BuildHallWalls()
        {
            var b = L.B;
            double top = b.Y0 - 30, left = b.X0 - 30, right = b.X1 + 30, bottom = b.Y1 + 40;
            var wall = ModelCatalog.Props["hallwall"][0];
            var win = ModelCatalog.Props["hallwindow"][0];
            var proto = Res.Proto(wall);
            float seg = Mathf.Max(Res.Bounds(proto.transform).size.x, 1f) * 0.995f;
            float segPx = seg / W3.S;
            int i = 0;
            for (double x = left; x < right; x += segPx, i++)
            {
                var spec = i % 3 == 1 ? win : wall;
                Res.Spawn(spec, props, W3.Pos(x + segPx / 2, top), 180f);
                if (i % 3 == 2) Res.Spawn(ModelCatalog.Props["torch_wall"][0], props, W3.Pos(x + segPx / 2, top + 12, 2.3f), 180f);
                if (i % 3 == 0 && L.Theme == "hall") Res.Spawn(ModelCatalog.Props["banner"][0], props, W3.Pos(x + segPx / 2, top + 10, 0.4f), 180f);
                if (i % 3 == 2) AddFire(x + segPx / 2, top + 20, 3.0f, 0.6f);
                if (i % 3 == 2) lightSpots.Add(W3.Pos(x + segPx / 2, top + 30, 3f));
            }
            for (double y = top; y < bottom; y += segPx)
            {
                Res.Spawn(wall, props, W3.Pos(left, y + segPx / 2), 90f);
                Res.Spawn(wall, props, W3.Pos(right, y + segPx / 2), -90f);
            }
            if (L.Theme == "vault")
                foreach (var p in L.Of("pillar"))
                {
                    var g = FxLib.Make("pillarglow", FxLib.Flat, FxLib.Add(FxLib.Glow, new Color(0.3f, 0.4f, 1f), 0.5f), dyn);
                    g.transform.position = W3.Pos(p.X, p.Y, 0.05f);
                    g.transform.localScale = Vector3.one * 5f;
                }
        }

        void BuildPerimeter()
        {
            var rnd = new System.Random(L.Seed * 31 + 7);
            double W = L.W, H = L.H;
            // a ring of hills and mountains just outside the playable area, then trees in front of them
            for (int i = 0; i < 26; i++)
            {
                double t = i / 26.0;
                double x, y;
                if (t < 0.4) { x = t / 0.4 * (W + 400) - 200; y = -260 - rnd.NextDouble() * 120; }
                else if (t < 0.7) { x = -260 - rnd.NextDouble() * 140; y = (t - 0.4) / 0.3 * H; }
                else { x = W + 260 + rnd.NextDouble() * 140; y = (t - 0.7) / 0.3 * H; }
                Place("mountain", x, y, rnd.NextDouble() * 6.28, 0.8 + rnd.NextDouble() * 0.5);
            }
            string treeKind = L.Theme == "marsh" ? "deadtree" : "pine";
            for (int i = 0; i < 90; i++)
            {
                double side = rnd.NextDouble(), x, y;
                if (side < 0.4) { x = rnd.NextDouble() * (W + 300) - 150; y = -30 - rnd.NextDouble() * 200; }
                else if (side < 0.7) { x = -30 - rnd.NextDouble() * 200; y = rnd.NextDouble() * (H + 120) - 60; }
                else { x = W + 30 + rnd.NextDouble() * 200; y = rnd.NextDouble() * (H + 120) - 60; }
                if (treeKind == "deadtree")
                {
                    var tr = Place("pine", x, y, rnd.NextDouble() * 6.28, 0.9 + rnd.NextDouble() * 0.6);
                    if (tr) Tint(tr, new Color(0.3f, 0.3f, 0.24f));
                }
                else Place(rnd.NextDouble() < 0.5 ? "pine" : "tree", x, y, rnd.NextDouble() * 6.28, 0.9 + rnd.NextDouble() * 0.6);
            }
        }

        void BuildGrass()
        {
            var tex = Res.Load<Texture2D>("Textures/grass_blade");
            if (tex == null) return;
            var verts = new List<Vector3>();
            var uvs = new List<Vector2>();
            var cols = new List<Color>();
            var tris = new List<int>();
            foreach (var p in L.Of("grass"))
            {
                var c = W3.Pos(p.X, p.Y);
                float s = 0.55f * (float)p.S;
                for (int k = 0; k < 3; k++)
                {
                    float a = (float)p.Rot + k * 1.047f;
                    var d = new Vector3(Mathf.Cos(a), 0, Mathf.Sin(a)) * s;
                    int i0 = verts.Count;
                    verts.Add(c - d); verts.Add(c + d); verts.Add(c + d + Vector3.up * s * 1.6f); verts.Add(c - d + Vector3.up * s * 1.6f);
                    uvs.Add(new Vector2(0, 0)); uvs.Add(new Vector2(1, 0)); uvs.Add(new Vector2(1, 1)); uvs.Add(new Vector2(0, 1));
                    float tone = 0.8f + (float)((p.X * 13 + p.Y * 7) % 40) / 100f;
                    for (int q = 0; q < 4; q++) cols.Add(new Color(tone, tone, tone * 0.9f));
                    tris.Add(i0); tris.Add(i0 + 2); tris.Add(i0 + 1); tris.Add(i0); tris.Add(i0 + 3); tris.Add(i0 + 2);
                }
            }
            if (verts.Count == 0) return;
            var mesh = new Mesh { name = "grass", indexFormat = UnityEngine.Rendering.IndexFormat.UInt32 };
            mesh.SetVertices(verts);
            mesh.SetUVs(0, uvs);
            mesh.SetColors(cols);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            var mat = new Material(Res.Shader("Highkeep/Foliage")) { name = "grass" };
            mat.SetTexture("_MainTex", tex);
            mat.SetColor("_Color", L.Theme == "marsh" ? new Color(0.75f, 0.8f, 0.6f) : new Color(0.95f, 1f, 0.85f));
            var go = new GameObject("grass");
            go.transform.SetParent(Root.transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        readonly List<(Transform t, Vector3 off, float seed)> motes = new List<(Transform, Vector3, float)>();
        void BuildMotes()
        {
            var mat = FxLib.Add(FxLib.Spark, Th.Motes, 1.2f);
            for (int i = 0; i < 40; i++)
            {
                var m = FxLib.Make("mote", FxLib.Quad, mat, dyn);
                m.transform.localScale = Vector3.one * 0.12f;
                m.AddComponent<Billboard>();
                motes.Add((m.transform, new Vector3(Random.Range(-18f, 18f), Random.Range(0.2f, 5f), Random.Range(-14f, 14f)), Random.value * 10));
            }
        }

        // ---------------------------------------------------------------- per frame
        public void Tick(float dt, Vector3 focus)
        {
            time += dt;
            foreach (var f in flames)
            {
                float n = Mathf.Sin(time * 11f + f.seed) * 0.5f + Mathf.Sin(time * 17f + f.seed * 2) * 0.3f;
                f.t.localScale = new Vector3(0.6f + n * 0.08f, 1f + n * 0.18f, 1f) * f.baseScale;
            }
            // move the point-light pool to the torches nearest the action
            lightSpots.Sort((a, b) => (a - focus).sqrMagnitude.CompareTo((b - focus).sqrMagnitude));
            for (int i = 0; i < torches.Count; i++)
            {
                var (l, bi, seed) = torches[i];
                if (i < lightSpots.Count && (lightSpots[i] - focus).sqrMagnitude < 40f * 40f)
                {
                    l.transform.position = lightSpots[i];
                    l.intensity = bi * (0.88f + 0.12f * Mathf.Sin(time * 9f + seed) * Mathf.Sin(time * 5.3f + seed * 2));
                }
                else l.intensity = 0;
            }
            foreach (var m in motes)
            {
                var o = m.off;
                float y = Mathf.Repeat(o.y + time * 0.25f, 5.5f);
                m.t.position = focus + new Vector3(o.x + Mathf.Sin(time * 0.5f + m.seed) * 1.2f, y, o.z + Mathf.Cos(time * 0.4f + m.seed) * 1.2f);
            }
            if (Sun != null)
            {
                // keep the shadow map centred on the action
                Sun.transform.position = focus;
            }
        }

        public void ShowClick(Vector3 p)
        {
            if (clickMarker == null)
            {
                clickMarker = FxLib.Make("click", FxLib.Flat, FxLib.Add(FxLib.Ring, new Color(1f, 0.85f, 0.4f), 1.8f), dyn);
            }
            clickPos = p + new Vector3(0, 0.06f, 0);
            clickT = 0;
        }

        void TickClick(float dt)
        {
            if (clickMarker == null) return;
            clickT += dt;
            bool on = clickT < 0.45f;
            clickMarker.SetActive(on);
            if (!on) return;
            float k = clickT / 0.45f;
            clickMarker.transform.position = clickPos;
            clickMarker.transform.localScale = Vector3.one * Mathf.Lerp(1.6f, 0.4f, k);
            clickMarker.transform.rotation = Quaternion.Euler(0, clickT * 200f, 0);
        }

        public void Sync(Game g, GameInput inp, float dt, int hoverId)
        {
            float t = (float)g.Time;
            if (Hero == null)
            {
                Hero = new CharacterView(g.Save.Cls, dyn);
                Hero.Radius = (float)g.P.R * W3.S;
            }
            Hero.UpdateHero(g.P, g.Save.Cls, dt, t, g.Hero.Speed);
            TickClick(dt);

            // enemies
            var seen = new HashSet<int>();
            foreach (var e in g.Enemies)
            {
                seen.Add(e.Id);
                if (!foes.TryGetValue(e.Id, out var v))
                {
                    v = new CharacterView(e.Type, dyn) { Radius = (float)e.R * W3.S };
                    foes[e.Id] = v;
                }
                v.UpdateEnemy(e, dt, t);
                if (!e.Dead)
                {
                    v.SetTargeted(e.Id == inp.TargetId, t);
                    v.SetHovered(e.Id == hoverId);
                }
            }
            var gone = new List<int>();
            foreach (var kv in foes) if (!seen.Contains(kv.Key)) gone.Add(kv.Key);
            foreach (var id in gone)
            {
                foes[id].Destroy();
                foes.Remove(id);
            }

            SyncProjectiles(g);
            SyncZones(g, t);
            SyncPickups(g, t);
            SyncFx(g);
        }

        public CharacterView FoeView(int id) => foes.TryGetValue(id, out var v) ? v : null;

        static void Prune<T>(Dictionary<object, GameObject> map, List<T> live) where T : class
        {
            if (map.Count == 0) return;
            var set = new HashSet<object>(live);
            var dead = new List<object>();
            foreach (var kv in map) if (!set.Contains(kv.Key)) dead.Add(kv.Key);
            foreach (var k in dead)
            {
                Object.Destroy(map[k]);
                map.Remove(k);
            }
        }

        void SyncProjectiles(Game g)
        {
            foreach (var q in g.Proj)
            {
                if (!projViews.TryGetValue(q, out var go))
                {
                    go = new GameObject("proj_" + q.Kind);
                    go.transform.SetParent(dyn, false);
                    if (q.Kind == "arrow" || q.Kind == "earrow")
                    {
                        var shaft = GameObject.CreatePrimitive(PrimitiveType.Cube);
                        Object.Destroy(shaft.GetComponent<Collider>());
                        shaft.transform.SetParent(go.transform, false);
                        shaft.transform.localScale = new Vector3(0.05f, 0.05f, 0.95f);
                        shaft.GetComponent<Renderer>().sharedMaterial = Res.LitMaterial(null, new Color(0.45f, 0.32f, 0.2f), 0.2f, 0.1f);
                        var tip = FxLib.Make("streak", FxLib.Quad, FxLib.Add(FxLib.Glow, q.Team == "e" ? new Color(1f, 0.4f, 0.15f) : new Color(1f, 0.95f, 0.8f), 0.8f), go.transform);
                        tip.transform.localScale = Vector3.one * 0.5f;
                        tip.AddComponent<Billboard>();
                    }
                    else
                    {
                        var col = q.Kind == "orb" ? new Color(1f, 0.3f, 0.1f) : new Color(1f, 0.5f, 0.15f);
                        var core = FxLib.Make("core", FxLib.Quad, FxLib.Add(FxLib.Glow, Color.white, 2.2f), go.transform);
                        core.transform.localScale = Vector3.one * 0.6f;
                        core.AddComponent<Billboard>();
                        var halo = FxLib.Make("halo", FxLib.Quad, FxLib.Add(FxLib.Glow, col, 1.6f), go.transform);
                        halo.transform.localScale = Vector3.one * 2.2f;
                        halo.AddComponent<Billboard>();
                    }
                    projViews[q] = go;
                }
                go.transform.position = W3.Pos(q.X, q.Y, 1.1f);
                go.transform.rotation = Quaternion.Euler(0, W3.Yaw(System.Math.Atan2(q.Vy, q.Vx)), 0);
            }
            Prune(projViews, g.Proj);
        }

        void SyncZones(Game g, float t)
        {
            foreach (var z in g.Zones)
            {
                if (!zoneViews.TryGetValue(z, out var go))
                {
                    go = new GameObject("zone_" + z.Kind);
                    go.transform.SetParent(dyn, false);
                    Color col = z.Kind == "rain" ? new Color(0.75f, 0.85f, 0.35f) : z.Team == "p" ? new Color(1f, 0.5f, 0.15f) : new Color(1f, 0.12f, 0.08f);
                    if (z.Kind == "line")
                    {
                        var q = FxLib.Make("line", FxLib.Flat, FxLib.Alpha(FxLib.Soft, new Color(1f, 0.15f, 0.08f, 0.45f)), go.transform);
                        q.name = "fill";
                    }
                    else
                    {
                        var ring = FxLib.Make("ring", FxLib.Flat, FxLib.Add(FxLib.Ring, col, 1.4f), go.transform);
                        ring.name = "ring";
                        var fill = FxLib.Make("fill", FxLib.Flat, FxLib.Alpha(FxLib.Disc, new Color(col.r, col.g, col.b, 0.45f)), go.transform);
                        fill.name = "fill";
                        if (z.Kind == "meteor")
                        {
                            var rock = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                            Object.Destroy(rock.GetComponent<Collider>());
                            rock.name = "rock";
                            rock.transform.SetParent(go.transform, false);
                            rock.transform.localScale = Vector3.one * 1.6f;
                            rock.GetComponent<Renderer>().sharedMaterial = Res.LitMaterial(null, new Color(0.25f, 0.12f, 0.06f), 1.5f, 0.1f);
                            var fire = FxLib.Make("fire", FxLib.Quad, FxLib.Add(FxLib.Glow, new Color(1f, 0.45f, 0.12f), 2.5f), rock.transform);
                            fire.transform.localScale = Vector3.one * 3f;
                            fire.AddComponent<Billboard>();
                        }
                        if (z.Kind == "rain")
                        {
                            for (int i = 0; i < 18; i++)
                            {
                                var a = FxLib.Make("arrow", FxLib.Quad, FxLib.Add(FxLib.Spark, new Color(1f, 1f, 0.85f), 1.4f), go.transform);
                                a.name = "rainarrow";
                                a.transform.localScale = new Vector3(0.08f, 1.2f, 1f);
                                a.AddComponent<Billboard>().UprightOnly = true;
                            }
                        }
                    }
                    zoneViews[z] = go;
                }
                float r = (float)z.R * W3.S;
                if (z.Kind == "line")
                {
                    var a = W3.Pos(z.X, z.Y, 0.06f);
                    var b = W3.Pos(z.X2, z.Y2, 0.06f);
                    var fill = go.transform.Find("fill");
                    fill.position = (a + b) / 2;
                    fill.rotation = Quaternion.LookRotation(b - a);
                    float k = Mathf.Clamp01((float)(z.T / System.Math.Max(0.01, z.Delay)));
                    fill.localScale = new Vector3((float)z.W * W3.S, 1, (b - a).magnitude * (0.3f + 0.7f * k));
                    continue;
                }
                go.transform.position = W3.Pos(z.X, z.Y, 0.07f);
                var ringT = go.transform.Find("ring");
                ringT.localScale = new Vector3(r * 2, 1, r * 2);
                ringT.localRotation = Quaternion.Euler(0, t * 30f, 0);
                var fillT = go.transform.Find("fill");
                if (z.Kind == "rain")
                {
                    fillT.localScale = new Vector3(r * 2, 1, r * 2);
                    int i = 0;
                    foreach (Transform c in go.transform)
                    {
                        if (c.name != "rainarrow") continue;
                        float ph = Mathf.Repeat(t * 2.2f + i * 0.37f, 1f);
                        float ang = i * 2.39f, rr = r * Mathf.Sqrt((i * 0.618f) % 1f);
                        c.localPosition = new Vector3(Mathf.Cos(ang) * rr, (1 - ph) * 6f, Mathf.Sin(ang) * rr);
                        i++;
                    }
                }
                else
                {
                    float k = Mathf.Clamp01((float)(z.T / System.Math.Max(0.01, z.Delay)));
                    fillT.localScale = new Vector3(r * 2 * k, 1, r * 2 * k);
                    var rock = go.transform.Find("rock");
                    if (rock) rock.localPosition = new Vector3(-3f * (1 - k), 14f * (1 - k) + 0.4f, 2f * (1 - k));
                    if (rock) rock.gameObject.SetActive(!z.Fired);
                    if (z.Fired)
                    {
                        float f = Mathf.Clamp01((float)((z.T - z.Delay) / 0.35));
                        fillT.gameObject.SetActive(f < 1);
                        ringT.localScale = new Vector3(r * 2 * (1 + f * 0.3f), 1, r * 2 * (1 + f * 0.3f));
                    }
                }
            }
            Prune(zoneViews, g.Zones);
        }

        void SyncPickups(Game g, float t)
        {
            foreach (var pk in g.Pickups)
            {
                if (!pickViews.TryGetValue(pk, out var go))
                {
                    go = new GameObject("pickup_" + pk.Kind);
                    go.transform.SetParent(dyn, false);
                    Color col;
                    if (pk.Kind == "gold") col = new Color(1f, 0.78f, 0.25f);
                    else if (pk.Kind == "potion") col = new Color(1f, 0.25f, 0.35f);
                    else
                    {
                        var rd = Items.RarityOf(pk.Item.Rarity);
                        col = new Color(rd.R, rd.G, rd.B);
                    }
                    var glow = FxLib.Make("glow", FxLib.Quad, FxLib.Add(FxLib.Glow, col, 1.4f), go.transform);
                    glow.transform.localPosition = new Vector3(0, 0.4f, 0);
                    glow.transform.localScale = Vector3.one * (pk.Kind == "item" ? 1.4f : 0.9f);
                    glow.AddComponent<Billboard>();
                    if (pk.Kind == "item")
                    {
                        var beam = FxLib.Make("beam", FxLib.Quad, FxLib.Add(FxLib.Soft, col, 0.9f), go.transform);
                        beam.transform.localPosition = new Vector3(0, 1.6f, 0);
                        beam.transform.localScale = new Vector3(0.35f, 3.2f, 1);
                        beam.AddComponent<Billboard>().UprightOnly = true;
                        var chest = Res.Spawn(ModelCatalog.Props["chest"][0], go.transform, Vector3.zero, 0, 0.55f);
                        chest.name = "spin";
                    }
                    else
                    {
                        var coin = GameObject.CreatePrimitive(pk.Kind == "gold" ? PrimitiveType.Cylinder : PrimitiveType.Sphere);
                        Object.Destroy(coin.GetComponent<Collider>());
                        coin.name = "spin";
                        coin.transform.SetParent(go.transform, false);
                        coin.transform.localScale = pk.Kind == "gold" ? new Vector3(0.38f, 0.04f, 0.38f) : Vector3.one * 0.3f;
                        coin.transform.localPosition = new Vector3(0, 0.35f, 0);
                        coin.GetComponent<Renderer>().sharedMaterial = Res.LitMaterial(null, col, 1.2f, 0.85f);
                    }
                    pickViews[pk] = go;
                }
                float bob = Mathf.Sin(t * 3f + (float)pk.X) * 0.1f;
                go.transform.position = W3.Pos(pk.X, pk.Y, bob + 0.1f);
                var spin = go.transform.Find("spin");
                if (spin) spin.localRotation = Quaternion.Euler(pk.Kind == "gold" ? 90 : 0, t * 120f, 0);
            }
            Prune(pickViews, g.Pickups);
        }

        void SyncFx(Game g)
        {
            foreach (var f in g.Effects)
            {
                if (!fxViews.TryGetValue(f, out var go))
                {
                    var col = new Color(f.CR, f.CG, f.CB);
                    go = new GameObject("fx_" + f.Type);
                    go.transform.SetParent(dyn, false);
                    switch (f.Type)
                    {
                        case "slash":
                        {
                            var m = FxLib.Make("arc", FxLib.Sector((float)(f.Arc * Mathf.Deg2Rad)), FxLib.Add(FxLib.Arc, col, 1.4f), go.transform);
                            m.name = "body";
                            break;
                        }
                        case "ring": case "nova": case "spawn":
                        {
                            var m = FxLib.Make("ring", FxLib.Flat, FxLib.Add(FxLib.Ring, col, f.Type == "nova" ? 2.2f : 1.5f), go.transform);
                            m.name = "body";
                            if (f.Type == "nova")
                            {
                                var d = FxLib.Make("disc", FxLib.Flat, FxLib.Add(FxLib.Glow, col, 1.2f), go.transform);
                                d.name = "disc";
                            }
                            break;
                        }
                        default:
                        {
                            var m = FxLib.Make("glow", FxLib.Quad, FxLib.Add(FxLib.Glow, col, 1.8f), go.transform);
                            m.name = "body";
                            m.AddComponent<Billboard>();
                            break;
                        }
                    }
                    fxViews[f] = go;
                }
                float k = (float)(f.T / f.Dur);
                float fade = 1 - k;
                var body = go.transform.Find("body");
                go.transform.position = W3.Pos(f.X, f.Y, f.Type == "slash" ? 0.9f : f.Type == "ring" || f.Type == "nova" || f.Type == "spawn" ? 0.08f : 1.0f);
                switch (f.Type)
                {
                    case "slash":
                    {
                        float rr = (float)f.Range * W3.S * 1.1f;
                        go.transform.rotation = Quaternion.Euler(0, W3.Yaw(f.Ang), 0);
                        body.localScale = new Vector3(rr, 1, rr) * (0.85f + 0.15f * k);
                        body.localRotation = Quaternion.Euler(0, (k - 0.5f) * 40f, 0);
                        break;
                    }
                    case "ring": case "nova": case "spawn":
                    {
                        float rr = (float)(f.R > 0 ? f.R : 40) * W3.S * 2f * (0.3f + 0.7f * Mathf.Sqrt(k));
                        if (f.Type == "spawn") rr = 2.2f * (1 - k * 0.5f);
                        body.localScale = new Vector3(rr, 1, rr);
                        var d = go.transform.Find("disc");
                        if (d) d.localScale = new Vector3(rr, 1, rr) * 0.9f;
                        break;
                    }
                    case "burst":
                        body.localScale = Vector3.one * (float)(f.R > 0 ? f.R : 30) * W3.S * 2.4f * (0.4f + 0.6f * k);
                        break;
                    default:
                        body.localScale = Vector3.one * (1.2f + k);
                        break;
                }
                foreach (var r in go.GetComponentsInChildren<Renderer>())
                {
                    r.GetPropertyBlock(mpb);
                    mpb.SetColor("_Color", new Color(f.CR * fade, f.CG * fade, f.CB * fade, fade));
                    r.SetPropertyBlock(mpb);
                }
            }
            Prune(fxViews, g.Effects);
        }

        // ---------------------------------------------------------------- town hub NPCs
        readonly List<(CharacterView v, Vector3[] way, int wi, float wait, Vector3 pos, float yaw)> npcs = new List<(CharacterView, Vector3[], int, float, Vector3, float)>();

        public void AddNpc(string kind, params Vector2[] wayPx)
        {
            var v = new CharacterView(kind, dyn);
            var way = new Vector3[wayPx.Length];
            for (int i = 0; i < wayPx.Length; i++) way[i] = W3.Pos(wayPx[i].x, wayPx[i].y);
            npcs.Add((v, way, 0, Random.Range(0f, 3f), way[0], 180f));
        }

        public void TickNpcs(float dt)
        {
            for (int i = 0; i < npcs.Count; i++)
            {
                var n = npcs[i];
                bool moving = false;
                if (n.way.Length > 1)
                {
                    if (n.wait > 0) n.wait -= dt;
                    else
                    {
                        var target = n.way[n.wi];
                        var d = target - n.pos;
                        d.y = 0;
                        if (d.magnitude < 0.15f)
                        {
                            n.wi = (n.wi + 1) % n.way.Length;
                            n.wait = 2.5f + Random.value * 3f;
                        }
                        else
                        {
                            n.pos += d.normalized * Mathf.Min(d.magnitude, 1.4f * dt);
                            n.yaw = Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg;
                            moving = true;
                        }
                    }
                }
                n.v.UpdateNpc(n.pos, n.yaw, moving, dt);
                npcs[i] = n;
            }
        }

        public void ClearNpcs()
        {
            foreach (var n in npcs) n.v.Destroy();
            npcs.Clear();
        }
    }
}
