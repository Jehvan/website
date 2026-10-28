// Resource loading and caches: layouts, painted grounds, icons, fonts, shared materials and normalised model prototypes.
using System.Collections.Generic;
using Highkeep.Core;
using UnityEngine;

namespace Highkeep
{
    /// <summary>World px (x east, y south) -> Unity metres (x east, z north).</summary>
    public static class W3
    {
        public const float S = 1f / 25f;

        public static Vector3 Pos(double x, double y, float h = 0f) => new Vector3((float)x * S, h, -(float)y * S);

        public static Vector2 ToWorld(Vector3 p) => new Vector2(p.x / S, -p.z / S);

        /// <summary>Unity yaw (degrees, 0 = +Z) for a game angle atan2(dy, dx) with y pointing south.</summary>
        public static float Yaw(double ang) => Mathf.Atan2(Mathf.Cos((float)ang), -Mathf.Sin((float)ang)) * Mathf.Rad2Deg;
    }

    public static class Res
    {
        static readonly Dictionary<string, Object> cache = new Dictionary<string, Object>();
        static readonly Dictionary<string, Material> mats = new Dictionary<string, Material>();
        static readonly Dictionary<string, GameObject> protos = new Dictionary<string, GameObject>();
        static readonly Dictionary<string, Dictionary<string, AnimationClip>> clips = new Dictionary<string, Dictionary<string, AnimationClip>>();
        static Transform protoRoot;

        public static T Load<T>(string path) where T : Object
        {
            if (cache.TryGetValue(path, out var o)) return o as T;
            var r = Resources.Load<T>(path);
            if (r == null) Debug.LogWarning("Highkeep: missing resource " + path);
            cache[path] = r;
            return r;
        }

        public static Layout LoadLayout(string theme, int seed, bool boss, int floor)
        {
            string name = theme == "vault" ? "vault" + (((Mathf.Max(1, floor) - 1) % 60) + 1)
                : theme == "town" ? "town" : "stage" + seed;
            var ta = Load<TextAsset>("Layouts/" + name);
            return Layout.FromJson(ta.text);
        }

        public static string GroundName(string layoutName)
        {
            var ta = Load<TextAsset>("Layouts/" + layoutName);
            var d = Json.Obj(Json.Parse(ta.text));
            return Json.Str(d, "ground");
        }

        public static Texture2D Icon(string name) => Load<Texture2D>("Icons/" + name);

        public static Shader Shader(string name)
        {
            var s = UnityEngine.Shader.Find(name);
            if (s == null)
            {
                Debug.LogWarning("Highkeep: shader not found " + name + ", using Standard");
                s = UnityEngine.Shader.Find("Standard");
            }
            return s;
        }

        /// <summary>Shared lit material for a texture atlas (one per KayKit pack / character).</summary>
        public static Material LitMaterial(string texPath, Color tint, float rim = 0.35f, float gloss = 0.12f)
        {
            string key = "lit:" + texPath + ":" + tint + ":" + rim + ":" + gloss;
            if (mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader("Highkeep/Lit")) { name = key };
            var tex = texPath != null ? Load<Texture2D>(texPath) : null;
            if (tex != null) m.SetTexture("_MainTex", tex);
            m.SetColor("_Color", tint);
            m.SetFloat("_Rim", rim);
            m.SetFloat("_Glossiness", gloss);
            m.enableInstancing = true;
            mats[key] = m;
            return m;
        }

        public static Material FxMaterial(string shader, Texture tex, Color color, float intensity = 1f)
        {
            string key = "fx:" + shader + ":" + (tex ? tex.name : "-") + ":" + color + ":" + intensity;
            if (mats.TryGetValue(key, out var m)) return m;
            m = new Material(Shader(shader)) { name = key };
            if (tex != null) m.SetTexture("_MainTex", tex);
            m.SetColor("_Color", color);
            if (m.HasProperty("_Intensity")) m.SetFloat("_Intensity", intensity);
            mats[key] = m;
            return m;
        }

        // ---------------------------------------------------------------- models
        /// <summary>
        /// An inactive, normalised copy of a catalogue model: base on y=0, scaled to its target height, its own
        /// material applied. Instantiate() it to place in the world.
        /// </summary>
        public static GameObject Proto(ModelSpec spec)
        {
            if (protos.TryGetValue(spec.Key, out var p)) return p;
            if (protoRoot == null)
            {
                var go = new GameObject("_protos");
                go.SetActive(false);
                Object.DontDestroyOnLoad(go);
                protoRoot = go.transform;
            }
            var holder = new GameObject(spec.Key);
            holder.transform.SetParent(protoRoot, false);
            var src = Load<GameObject>(spec.Path);
            if (src == null)
            {
                var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
                Object.Destroy(cube.GetComponent<Collider>());
                cube.transform.SetParent(holder.transform, false);
                cube.transform.localPosition = new Vector3(0, 0.5f, 0);
                protos[spec.Key] = holder;
                return holder;
            }
            var inst = Object.Instantiate(src, holder.transform, false);
            inst.name = "model";
            inst.transform.localRotation = Quaternion.Euler(0, spec.Yaw, 0) * inst.transform.localRotation;
            var mat = spec.Texture != null || spec.Tint != Color.white ? LitMaterial(spec.Texture, spec.Tint, spec.Rim) : null;
            foreach (var r in inst.GetComponentsInChildren<Renderer>(true))
            {
                if (mat != null)
                {
                    var arr = r.sharedMaterials;
                    for (int i = 0; i < arr.Length; i++) arr[i] = mat;
                    r.sharedMaterials = arr;
                }
                r.shadowCastingMode = spec.CastShadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            foreach (var c in inst.GetComponentsInChildren<Collider>(true)) Object.Destroy(c);
            Normalise(holder.transform, inst.transform, spec);
            protos[spec.Key] = holder;
            return holder;
        }

        static void Normalise(Transform holder, Transform model, ModelSpec spec)
        {
            var b = Bounds(model);
            if (b.size.y < 1e-4f) return;
            float k = spec.Height > 0 ? spec.Height / b.size.y : spec.Scale;
            model.localScale *= k;
            b = Bounds(model);
            model.localPosition += new Vector3(-b.center.x * (spec.Center ? 1 : 0), -b.min.y + spec.Sink, -b.center.z * (spec.Center ? 1 : 0));
        }

        /// <summary>
        /// World-space bounds from the meshes themselves (Renderer.bounds is empty on inactive objects, and the
        /// prototype root is kept inactive).
        /// </summary>
        public static UnityEngine.Bounds Bounds(Transform t)
        {
            bool any = false;
            var b = new UnityEngine.Bounds(t.position, Vector3.zero);
            void Add(Mesh m, Matrix4x4 mx)
            {
                if (m == null) return;
                var mb = m.bounds;
                for (int i = 0; i < 8; i++)
                {
                    var c = mb.center + Vector3.Scale(mb.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1));
                    var w = mx.MultiplyPoint3x4(c);
                    if (!any) { b = new UnityEngine.Bounds(w, Vector3.zero); any = true; }
                    else b.Encapsulate(w);
                }
            }
            foreach (var mf in t.GetComponentsInChildren<MeshFilter>(true)) Add(mf.sharedMesh, mf.transform.localToWorldMatrix);
            foreach (var sk in t.GetComponentsInChildren<SkinnedMeshRenderer>(true)) Add(sk.sharedMesh, sk.transform.localToWorldMatrix);
            return b;
        }

        public static GameObject Spawn(ModelSpec spec, Transform parent, Vector3 pos, float yaw, float scale = 1f)
        {
            var go = Object.Instantiate(Proto(spec), parent, false);
            go.name = spec.Key;
            go.transform.localPosition = pos;
            go.transform.localRotation = Quaternion.Euler(0, yaw, 0);
            go.transform.localScale = Vector3.one * scale;
            go.SetActive(true);
            return go;
        }

        /// <summary>Animation clips stored inside a character FBX, keyed by their short name ("Idle", "Running_A"...).</summary>
        public static Dictionary<string, AnimationClip> Clips(string modelPath)
        {
            if (clips.TryGetValue(modelPath, out var d)) return d;
            d = new Dictionary<string, AnimationClip>();
            foreach (var c in Resources.LoadAll<AnimationClip>(modelPath))
            {
                if (c == null || c.name.StartsWith("__preview__")) continue;
                string n = c.name;
                int bar = n.LastIndexOf('|');
                if (bar >= 0) n = n.Substring(bar + 1);
                d[n] = c;
            }
            if (d.Count == 0) Debug.LogWarning("Highkeep: no animation clips found in " + modelPath);
            clips[modelPath] = d;
            return d;
        }
    }
}
