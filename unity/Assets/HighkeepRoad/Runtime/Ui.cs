// Immediate-mode UI kit on top of Unity's IMGUI: painted panels, buttons, bars, icons, text with shadows and the
// glass orbs for the HUD. Everything is generated at runtime; the only assets are two OFL fonts and the icons.
using System.Collections.Generic;
using UnityEngine;

namespace Highkeep
{
    public enum Btn { Normal, Primary, On, Tab, Danger }

    public static class Ui
    {
        public static readonly Color Ink = new Color(0.95f, 0.9f, 0.78f);
        public static readonly Color Dim = new Color(0.66f, 0.6f, 0.5f);
        public static readonly Color Ember = new Color(1f, 0.66f, 0.28f);
        public static readonly Color EmberDark = new Color(0.62f, 0.36f, 0.14f);
        public static readonly Color Good = new Color(0.52f, 0.9f, 0.5f);
        public static readonly Color Bad = new Color(1f, 0.42f, 0.36f);
        public static readonly Color Steel = new Color(0.62f, 0.71f, 0.78f);
        public static readonly Color LineCol = new Color(0.32f, 0.25f, 0.17f);
        public static readonly Color Gold = new Color(0.78f, 0.6f, 0.3f);

        public static float U = 1f;
        static Font serif, serifBold, sans, sansBold;
        static Texture2D white, panelTex, panelDarkTex, btnTex, btnHotTex, btnOnTex, btnPrimTex, btnPrimHotTex, frameTex, parchment;
        static readonly Dictionary<string, Texture2D> orbTex = new Dictionary<string, Texture2D>();
        static GUIStyle label, blank, frame;
        static bool ready;

        public static void Init()
        {
            if (ready) return;
            serif = Res.Load<Font>("Fonts/Cinzel-Regular");
            serifBold = Res.Load<Font>("Fonts/Cinzel-Bold");
            sans = Res.Load<Font>("Fonts/AlegreyaSans-Medium");
            sansBold = Res.Load<Font>("Fonts/AlegreyaSans-Bold");
            white = Texture2D.whiteTexture;
            panelTex = Panel(new Color(0.16f, 0.125f, 0.095f), new Color(0.09f, 0.07f, 0.055f), Gold, "panel");
            panelDarkTex = Panel(new Color(0.11f, 0.085f, 0.065f), new Color(0.06f, 0.045f, 0.035f), new Color(0.45f, 0.34f, 0.2f), "paneldark");
            btnTex = Panel(new Color(0.3f, 0.22f, 0.15f), new Color(0.17f, 0.12f, 0.08f), new Color(0.6f, 0.46f, 0.26f), "btn", 24);
            btnHotTex = Panel(new Color(0.42f, 0.31f, 0.2f), new Color(0.24f, 0.17f, 0.11f), new Color(0.85f, 0.66f, 0.36f), "btnhot", 24);
            btnOnTex = Panel(new Color(0.5f, 0.32f, 0.14f), new Color(0.3f, 0.18f, 0.08f), new Color(1f, 0.75f, 0.4f), "btnon", 24);
            btnPrimTex = Panel(new Color(0.78f, 0.42f, 0.14f), new Color(0.48f, 0.22f, 0.07f), new Color(1f, 0.82f, 0.48f), "btnprim", 24);
            btnPrimHotTex = Panel(new Color(0.92f, 0.55f, 0.2f), new Color(0.58f, 0.28f, 0.09f), new Color(1f, 0.9f, 0.6f), "btnprimhot", 24);
            frameTex = Frame();
            parchment = Parchment();
            label = new GUIStyle { richText = false, clipping = TextClipping.Overflow };
            blank = new GUIStyle();
            frame = new GUIStyle { border = new RectOffset(10, 10, 10, 10) };
            ready = true;
        }

        // ---------------------------------------------------------------- generated art
        static Texture2D Panel(Color top, Color bottom, Color edge, string name, int size = 48)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = name, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var rnd = new System.Random(size + name.Length);
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float fy = (float)y / (size - 1);
                    var c = Color.Lerp(bottom, top, fy);
                    float n = (float)rnd.NextDouble() * 0.04f - 0.02f;
                    c = new Color(c.r + n, c.g + n, c.b + n, 1);
                    int d = Mathf.Min(Mathf.Min(x, size - 1 - x), Mathf.Min(y, size - 1 - y));
                    if (d == 0) c = Color.Lerp(edge, Color.black, 0.5f);
                    else if (d == 1) c = edge;
                    else if (d == 2) c = Color.Lerp(edge, c, 0.55f);
                    else if (d == 3) c = Color.Lerp(Color.black, c, 0.75f);
                    t.SetPixel(x, y, c);
                }
            t.Apply();
            return t;
        }

        static Texture2D Frame()
        {
            int size = 32;
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "frame", wrapMode = TextureWrapMode.Clamp };
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    int d = Mathf.Min(Mathf.Min(x, size - 1 - x), Mathf.Min(y, size - 1 - y));
                    Color c = d == 0 ? new Color(0, 0, 0, 0.9f) : d == 1 ? new Color(1, 1, 1, 1) : d == 2 ? new Color(1, 1, 1, 0.6f) : d == 3 ? new Color(0, 0, 0, 0.5f) : new Color(0, 0, 0, 0);
                    t.SetPixel(x, y, c);
                }
            t.Apply();
            return t;
        }

        static Texture2D Parchment()
        {
            int w = 256, h = 160;
            var t = new Texture2D(w, h, TextureFormat.RGBA32, true) { name = "parchment", wrapMode = TextureWrapMode.Clamp };
            var rnd = new System.Random(5);
            float[] blot = new float[12 * 4];
            for (int i = 0; i < blot.Length; i++) blot[i] = (float)rnd.NextDouble();
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    float fx = (float)x / w, fy = (float)y / h;
                    float n = Mathf.PerlinNoise(fx * 6, fy * 4) * 0.6f + Mathf.PerlinNoise(fx * 22, fy * 16) * 0.4f;
                    float edge = Mathf.Min(Mathf.Min(fx, 1 - fx), Mathf.Min(fy, 1 - fy));
                    float burn = Mathf.Clamp01(1 - edge * 9f);
                    var c = Color.Lerp(new Color(0.86f, 0.77f, 0.58f), new Color(0.7f, 0.57f, 0.36f), n);
                    c = Color.Lerp(c, new Color(0.38f, 0.25f, 0.12f), burn * 0.8f);
                    t.SetPixel(x, y, c);
                }
            t.Apply(true);
            return t;
        }

        /// <summary>Glass orb: fill colour for "hp"/"mp", plus "back", "glass" and "ring" layers.</summary>
        public static Texture2D Orb(string kind)
        {
            if (orbTex.TryGetValue(kind, out var t)) return t;
            int S = 128;
            t = new Texture2D(S, S, TextureFormat.RGBA32, true) { name = "orb_" + kind, wrapMode = TextureWrapMode.Clamp };
            float c = (S - 1) / 2f;
            Color baseCol = kind == "hp" ? new Color(0.82f, 0.08f, 0.06f) : new Color(0.12f, 0.32f, 0.95f);
            for (int y = 0; y < S; y++)
                for (int x = 0; x < S; x++)
                {
                    float nx = (x - c) / c, ny = (c - y) / c;   // ny up
                    float r = Mathf.Sqrt(nx * nx + ny * ny);
                    Color col = new Color(0, 0, 0, 0);
                    if (kind == "ring")
                    {
                        const float inner = 0.86f;
                        if (r <= 1f && r >= inner - 0.02f)
                        {
                            float tt = Mathf.Clamp01((r - inner) / (1 - inner));
                            float bevel = Mathf.Sin(tt * Mathf.PI);
                            float light = 0.5f + 0.5f * (-nx * 0.5f + ny * 0.8f) / Mathf.Max(r, 1e-3f);
                            float k = 0.25f + 0.6f * bevel * (0.45f + 0.7f * light);
                            float a = Mathf.Clamp01(Mathf.Min((1 - r) * c, (r - (inner - 0.02f)) * c));
                            col = new Color(0.85f * k + 0.1f, 0.62f * k + 0.07f, 0.25f * k + 0.03f, a);
                        }
                    }
                    else if (r <= 1f)
                    {
                        float nz = Mathf.Sqrt(Mathf.Max(0, 1 - r * r));
                        float edge = Mathf.Clamp01((1 - r) * c * 0.9f);
                        if (kind == "back")
                        {
                            float k = 0.04f + 0.1f * nz;
                            col = new Color(k * 0.9f, k * 0.8f, k * 0.8f, 0.96f * edge);
                        }
                        else if (kind == "glass")
                        {
                            float hx = nx + 0.38f, hy = -ny + 0.45f;
                            float spec = Mathf.Pow(Mathf.Max(0, 1 - Mathf.Sqrt(hx * hx * 2.25f + hy * hy * 5.76f)), 2);
                            float shade = Mathf.Pow(Mathf.Max(0, r - 0.55f), 1.5f) * 0.55f;
                            col = spec > shade ? new Color(1, 1, 1, Mathf.Min(0.75f, spec) * edge) : new Color(0, 0, 0, Mathf.Min(0.6f, shade) * edge);
                        }
                        else
                        {
                            float lam = Mathf.Max(0, nx * -0.35f + ny * 0.5f + nz * 0.8f);
                            float k = 0.28f + 0.95f * lam;
                            float swirl = 0.06f * Mathf.Sin(nx * 9 + ny * 5) * Mathf.Sin(ny * 7 - nx * 3);
                            float rim = r * r * r * 0.35f;
                            col = new Color(Mathf.Min(1, baseCol.r * (k + swirl) + rim * baseCol.r), Mathf.Min(1, baseCol.g * (k + swirl) + rim * 0.3f * baseCol.g),
                                            Mathf.Min(1, baseCol.b * (k + swirl) + rim * baseCol.b), edge);
                        }
                    }
                    t.SetPixel(x, y, col);
                }
            t.Apply(true);
            orbTex[kind] = t;
            return t;
        }

        // ---------------------------------------------------------------- primitives
        public static void Rect(Rect r, Color c)
        {
            var old = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(r, white);
            GUI.color = old;
        }

        public static void Box(Rect r, Color fill, Color? border = null, float bw = 1.5f)
        {
            if (border.HasValue)
            {
                var b = border.Value;
                Rect(new Rect(r.x - bw, r.y - bw, r.width + 2 * bw, bw), b);
                Rect(new Rect(r.x - bw, r.yMax, r.width + 2 * bw, bw), b);
                Rect(new Rect(r.x - bw, r.y, bw, r.height), b);
                Rect(new Rect(r.xMax, r.y, bw, r.height), b);
            }
            Rect(r, fill);
        }

        public static void Panel(Rect r, bool dark = false, float alpha = 1f)
        {
            var old = GUI.color;
            GUI.color = new Color(1, 1, 1, alpha);
            frame.normal.background = dark ? panelDarkTex : panelTex;
            frame.border = new RectOffset(8, 8, 8, 8);
            if (Event.current.type == EventType.Repaint) frame.Draw(r, false, false, false, false);
            GUI.color = old;
        }

        public static void Parchment(Rect r)
        {
            GUI.DrawTexture(r, parchment, ScaleMode.StretchToFill);
        }

        public static void Outline(Rect r, Color c)
        {
            var old = GUI.color;
            GUI.color = c;
            frame.normal.background = frameTex;
            frame.border = new RectOffset(5, 5, 5, 5);
            if (Event.current.type == EventType.Repaint) frame.Draw(r, false, false, false, false);
            GUI.color = old;
        }

        public static Font F(bool serifFont, bool bold) => serifFont ? (bold ? serifBold : serif) : (bold ? sansBold : sans);

        public static Vector2 Measure(string s, float size, bool serifFont = true, bool bold = false)
        {
            label.font = F(serifFont, bold);
            label.fontSize = Mathf.Max(6, Mathf.RoundToInt(size));
            label.wordWrap = false;
            return label.CalcSize(new GUIContent(s));
        }

        /// <summary>Draw text; returns its height. align: -1 left, 0 centre, 1 right (x is the anchor).</summary>
        public static float Text(float x, float y, string s, float size, Color col, int align = -1, bool serifFont = true, float wrap = 0, bool bold = false, bool shadow = true)
        {
            if (string.IsNullOrEmpty(s)) return 0;
            label.font = F(serifFont, bold);
            label.fontSize = Mathf.Max(6, Mathf.RoundToInt(size));
            label.wordWrap = wrap > 0;
            label.alignment = align < 0 ? TextAnchor.UpperLeft : align == 0 ? TextAnchor.UpperCenter : TextAnchor.UpperRight;
            var content = new GUIContent(s);
            float w = wrap > 0 ? wrap : label.CalcSize(content).x + 4;
            float h = wrap > 0 ? label.CalcHeight(content, w) : label.CalcSize(content).y;
            float rx = align < 0 ? x : align == 0 ? x - w / 2 : x - w;
            var r = new Rect(rx, y, w, h);
            if (shadow)
            {
                label.normal.textColor = new Color(0, 0, 0, 0.75f * col.a);
                GUI.Label(new Rect(r.x + 1.2f, r.y + 1.4f, r.width, r.height), content, label);
            }
            label.normal.textColor = col;
            GUI.Label(r, content, label);
            return h;
        }

        public static void Icon(string name, Rect r, Color? tint = null)
        {
            var t = Res.Icon(name);
            if (t == null) return;
            var old = GUI.color;
            GUI.color = tint ?? Color.white;
            GUI.DrawTexture(r, t, ScaleMode.ScaleToFit);
            GUI.color = old;
        }

        public static void Bar(Rect r, float frac, Color col, Color? back = null)
        {
            Box(r, back ?? new Color(0.04f, 0.03f, 0.02f, 0.9f), new Color(0, 0, 0, 0.9f), 1);
            Rect(new Rect(r.x, r.y, r.width * Mathf.Clamp01(frac), r.height), col);
            Rect(new Rect(r.x, r.y, r.width * Mathf.Clamp01(frac), Mathf.Max(1, r.height * 0.35f)), new Color(1, 1, 1, 0.18f));
        }

        public static bool Hover(Rect r) => r.Contains(Event.current.mousePosition);

        /// <summary>Invisible click area.</summary>
        public static bool Hot(Rect r, bool enabled = true)
        {
            if (!enabled) return false;
            return GUI.Button(r, GUIContent.none, blank);
        }

        /// <summary>Swallow clicks on decorative panels so they do not reach the game world.</summary>
        public static void Block(Rect r)
        {
            var e = Event.current;
            if ((e.type == EventType.MouseDown || e.type == EventType.MouseUp) && r.Contains(e.mousePosition)) e.Use();
        }

        public static bool Button(Rect r, string text, Btn kind = Btn.Normal, bool enabled = true, float size = 15f)
        {
            bool hot = enabled && Hover(r);
            Texture2D bg = kind == Btn.Primary ? (hot ? btnPrimHotTex : btnPrimTex) : kind == Btn.On ? btnOnTex : hot ? btnHotTex : btnTex;
            var old = GUI.color;
            GUI.color = enabled ? Color.white : new Color(0.6f, 0.6f, 0.6f, 0.7f);
            frame.normal.background = bg;
            frame.border = new RectOffset(6, 6, 6, 6);
            if (Event.current.type == EventType.Repaint) frame.Draw(r, false, false, false, false);
            GUI.color = old;
            var col = enabled ? (kind == Btn.Primary ? new Color(1f, 0.96f, 0.86f) : kind == Btn.On ? new Color(1f, 0.9f, 0.7f) : Ink) : Dim;
            var lines = text.Split('\n');
            float lh = size * 1.25f;
            float y0 = r.y + (r.height - lh * lines.Length) / 2 + size * 0.05f;
            for (int i = 0; i < lines.Length; i++)
                Text(r.center.x, y0 + i * lh, lines[i], i == 0 ? size : size * 0.82f, col, 0, i == 0, 0, i == 0, true);
            bool prev = GUI.enabled;
            GUI.enabled = enabled;
            bool clicked = GUI.Button(r, GUIContent.none, blank);
            GUI.enabled = prev;
            return clicked && enabled;
        }

        public static void Gradient(Rect r, Color top, Color bottom, int steps = 24)
        {
            for (int i = 0; i < steps; i++)
            {
                float y0 = Mathf.Round(r.y + r.height * i / steps), y1 = Mathf.Round(r.y + r.height * (i + 1) / steps);
                if (y1 > y0) Rect(new Rect(r.x, y0, r.width, y1 - y0), Color.Lerp(top, bottom, (float)i / (steps - 1)));
            }
        }

        public static void Line(Vector2 a, Vector2 b, Color c, float width)
        {
            var d = b - a;
            float len = d.magnitude;
            if (len < 0.01f) return;
            var m = GUI.matrix;
            float ang = Mathf.Atan2(d.y, d.x) * Mathf.Rad2Deg;
            GUIUtility.RotateAroundPivot(ang, a);
            Rect(new Rect(a.x, a.y - width / 2, len, width), c);
            GUI.matrix = m;
        }

        public static void Texture(Rect r, Texture t, Color? tint = null)
        {
            if (t == null) return;
            var old = GUI.color;
            GUI.color = tint ?? Color.white;
            GUI.DrawTexture(r, t, ScaleMode.StretchToFill);
            GUI.color = old;
        }

        /// <summary>Draw the bottom part of a texture only (orb fill level).</summary>
        public static void TextureBottom(Rect r, Texture t, float frac)
        {
            frac = Mathf.Clamp01(frac);
            if (frac <= 0) return;
            var dst = new Rect(r.x, r.yMax - r.height * frac, r.width, r.height * frac);
            GUI.DrawTextureWithTexCoords(dst, t, new Rect(0, 0, 1, frac));
        }

        public static Color RarityColor(string rarity)
        {
            var r = Core.Items.RarityOf(rarity);
            return new Color(r.R, r.G, r.B);
        }
    }
}
