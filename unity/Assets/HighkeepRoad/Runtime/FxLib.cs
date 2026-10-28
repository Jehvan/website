// Procedural effect textures and meshes: glows, rings, discs, flames, slash arcs, blob shadows.
using UnityEngine;

namespace Highkeep
{
    public static class FxLib
    {
        static Texture2D glow, ring, disc, shadow, flame, spark, soft, arc;
        static Mesh quad, flat;

        static Texture2D Make(int size, System.Func<float, float, Color> f, string name)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, true) { name = name, wrapMode = TextureWrapMode.Clamp };
            var px = new Color[size * size];
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float u = (x + 0.5f) / size * 2 - 1, v = (y + 0.5f) / size * 2 - 1;
                    px[y * size + x] = f(u, v);
                }
            t.SetPixels(px);
            t.Apply(true, true);
            return t;
        }

        public static Texture2D Glow => glow ? glow : glow = Make(64, (u, v) =>
        {
            float d = Mathf.Sqrt(u * u + v * v);
            float a = Mathf.Pow(Mathf.Max(0, 1 - d), 2.2f);
            return new Color(1, 1, 1, a);
        }, "glow");

        public static Texture2D Soft => soft ? soft : soft = Make(64, (u, v) =>
        {
            float d = Mathf.Sqrt(u * u + v * v);
            return new Color(1, 1, 1, Mathf.SmoothStep(1, 0, d));
        }, "soft");

        public static Texture2D Ring => ring ? ring : ring = Make(128, (u, v) =>
        {
            float d = Mathf.Sqrt(u * u + v * v);
            float a = Mathf.Exp(-Mathf.Pow((d - 0.86f) / 0.06f, 2)) + 0.18f * Mathf.Clamp01(1 - Mathf.Abs(d - 0.6f) / 0.3f) * (d < 0.92f ? 1 : 0);
            return new Color(1, 1, 1, Mathf.Clamp01(a));
        }, "ring");

        public static Texture2D Disc => disc ? disc : disc = Make(128, (u, v) =>
        {
            float d = Mathf.Sqrt(u * u + v * v);
            float edge = Mathf.Clamp01((1 - d) * 18);
            float rim = Mathf.Exp(-Mathf.Pow((d - 0.93f) / 0.05f, 2));
            return new Color(1, 1, 1, Mathf.Clamp01(edge * 0.35f + rim));
        }, "disc");

        public static Texture2D Shadow => shadow ? shadow : shadow = Make(64, (u, v) =>
        {
            float d = Mathf.Sqrt(u * u + v * v);
            return new Color(0, 0, 0, Mathf.Pow(Mathf.Max(0, 1 - d), 1.4f) * 0.6f);
        }, "shadow");

        public static Texture2D Flame => flame ? flame : flame = Make(64, (u, v) =>
        {
            float y = (v + 1) * 0.5f;
            float w = (1 - y) * 0.75f + 0.05f;
            float a = Mathf.Clamp01(1 - Mathf.Abs(u) / w) * Mathf.Clamp01(y * 6) * Mathf.Pow(1 - y, 0.6f);
            var c = Color.Lerp(new Color(1f, 0.85f, 0.45f), new Color(1f, 0.35f, 0.08f), y);
            c.a = a;
            return c;
        }, "flame");

        public static Texture2D Spark => spark ? spark : spark = Make(32, (u, v) =>
        {
            float d = Mathf.Sqrt(u * u + v * v);
            float a = Mathf.Pow(Mathf.Max(0, 1 - d), 3f) + Mathf.Max(0, 1 - Mathf.Abs(u) * 8) * Mathf.Max(0, 1 - Mathf.Abs(v)) * 0.4f;
            return new Color(1, 1, 1, Mathf.Clamp01(a));
        }, "spark");

        /// <summary>A crescent used for melee swings: opaque near the outer edge, fading inwards.</summary>
        public static Texture2D Arc => arc ? arc : arc = Make(128, (u, v) =>
        {
            float d = Mathf.Sqrt(u * u + v * v);
            float a = Mathf.Clamp01((d - 0.45f) / 0.5f) * Mathf.Clamp01((1 - d) * 20);
            return new Color(1, 1, 1, a * a);
        }, "arc");

        /// <summary>Unit quad in XY (billboards) centred on the origin.</summary>
        public static Mesh Quad
        {
            get
            {
                if (quad) return quad;
                quad = new Mesh { name = "fxquad" };
                quad.vertices = new[] { new Vector3(-0.5f, -0.5f, 0), new Vector3(0.5f, -0.5f, 0), new Vector3(0.5f, 0.5f, 0), new Vector3(-0.5f, 0.5f, 0) };
                quad.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) };
                quad.triangles = new[] { 0, 2, 1, 0, 3, 2 };
                quad.RecalculateNormals();
                quad.RecalculateBounds();
                return quad;
            }
        }

        /// <summary>Unit quad lying on the ground (XZ), centred.</summary>
        public static Mesh Flat
        {
            get
            {
                if (flat) return flat;
                flat = new Mesh { name = "fxflat" };
                flat.vertices = new[] { new Vector3(-0.5f, 0, -0.5f), new Vector3(0.5f, 0, -0.5f), new Vector3(0.5f, 0, 0.5f), new Vector3(-0.5f, 0, 0.5f) };
                flat.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) };
                flat.triangles = new[] { 0, 2, 1, 0, 3, 2 };
                flat.RecalculateNormals();
                flat.RecalculateBounds();
                return flat;
            }
        }

        /// <summary>Flat pie-slice mesh (for melee arcs and cone telegraphs), angles in radians around +Z.</summary>
        public static Mesh Sector(float arc, int seg = 18)
        {
            var m = new Mesh { name = "sector" };
            var v = new Vector3[seg + 2];
            var uv = new Vector2[seg + 2];
            v[0] = Vector3.zero;
            uv[0] = new Vector2(0.5f, 0.5f);
            for (int i = 0; i <= seg; i++)
            {
                float a = -arc / 2 + arc * i / seg;
                var d = new Vector3(Mathf.Sin(a), 0, Mathf.Cos(a));
                v[i + 1] = d;
                uv[i + 1] = new Vector2(0.5f + d.x * 0.5f, 0.5f + d.z * 0.5f);
            }
            var t = new int[seg * 3];
            for (int i = 0; i < seg; i++)
            {
                t[i * 3] = 0;
                t[i * 3 + 1] = i + 1;
                t[i * 3 + 2] = i + 2;
            }
            m.vertices = v;
            m.uv = uv;
            m.triangles = t;
            m.RecalculateNormals();
            m.RecalculateBounds();
            return m;
        }

        public static GameObject Make(string name, Mesh mesh, Material mat, Transform parent)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return go;
        }

        public static Material Add(Texture t, Color c, float k = 1f) => Res.FxMaterial("Highkeep/Additive", t, c, k);
        public static Material Alpha(Texture t, Color c) => Res.FxMaterial("Highkeep/AlphaFx", t, c);

        /// <summary>Per-instance colour without new materials.</summary>
        public static void Tint(Renderer r, Color c, MaterialPropertyBlock mpb)
        {
            r.GetPropertyBlock(mpb);
            mpb.SetColor("_Color", c);
            r.SetPropertyBlock(mpb);
        }
    }

    /// <summary>Camera-facing quad.</summary>
    public sealed class Billboard : MonoBehaviour
    {
        public bool UprightOnly;
        void LateUpdate()
        {
            var cam = Camera.main;
            if (!cam) return;
            if (UprightOnly)
            {
                var f = cam.transform.forward;
                f.y = 0;
                if (f.sqrMagnitude > 1e-4f) transform.rotation = Quaternion.LookRotation(f);
            }
            else transform.rotation = cam.transform.rotation;
        }
    }
}
