// In-stage HUD: Kingsroad-style action bar flanked by glass health/mana orbs, target frame, boss bar, banners,
// enemy health bars, floating combat text and the hit flash.
using Highkeep.Core;
using UnityEngine;

namespace Highkeep
{
    public sealed class Hud
    {
        public Rect PauseRect;
        public Rect[] SlotRects = new Rect[4];

        public void Draw(Game g, GameInput inp, Camera cam, int hoverId, float dt)
        {
            float u = Ui.U;
            float W = Screen.width, H = Screen.height;
            var p = g.P;
            var hero = g.Hero;
            var s = g.Save;

            DrawWorldTexts(g, cam, u);
            DrawEnemyBars(g, inp, cam, hoverId, u);

            // ---- hit flash / low health
            if (p.HitT > 0) Ui.Rect(new Rect(0, 0, W, H), new Color(0.7f, 0, 0, Mathf.Clamp01((float)p.HitT / 0.22f) * 0.25f));
            float hpFrac = (float)(p.Hp / hero.MaxHp);
            if (hpFrac < 0.3f && !p.Dead)
            {
                float a = (0.3f - hpFrac) / 0.3f * (0.35f + 0.15f * Mathf.Sin(Time.time * 6f));
                Ui.Gradient(new Rect(0, 0, W, H * 0.18f), new Color(0.5f, 0, 0, a), new Color(0.5f, 0, 0, 0), 12);
                Ui.Gradient(new Rect(0, H * 0.82f, W, H * 0.18f), new Color(0.5f, 0, 0, 0), new Color(0.5f, 0, 0, a), 12);
            }

            // ---- top left: stage + wave, top right: gold + pause
            var st = g.Stage;
            Ui.Panel(new Rect(10 * u, 10 * u, 300 * u, 54 * u), true, 0.9f);
            Ui.Text(22 * u, 15 * u, st.Name, 17 * u, Ui.Ink, -1, true, 0, true);
            string wave = st.State == "intro" ? "Prepare" : "Wave " + Mathf.Max(1, st.WaveIdx + 1) + " / " + st.Waves.Count;
            Ui.Text(22 * u, 38 * u, wave, 13 * u, Ui.Ember, -1, false);
            Ui.Block(new Rect(10 * u, 10 * u, 300 * u, 54 * u));
            var gr = new Rect(W - 230 * u, 10 * u, 160 * u, 40 * u);
            Ui.Panel(gr, true, 0.9f);
            Ui.Icon("coin", new Rect(gr.x + 8 * u, gr.y + 6 * u, 28 * u, 28 * u));
            Ui.Text(gr.xMax - 12 * u, gr.y + 9 * u, s.Gold.ToString(), 17 * u, Ui.Ink, 1, false, 0, true);
            Ui.Block(gr);
            PauseRect = new Rect(W - 62 * u, 10 * u, 52 * u, 40 * u);

            // ---- boss bar
            Enemy boss = null;
            foreach (var e in g.Enemies) if (e.D.Boss && !e.Dead) boss = e;
            if (boss != null)
            {
                float bw = Mathf.Min(560 * u, W - 40);
                var br = new Rect((W - bw) / 2, 74 * u, bw, 18 * u);
                Ui.Text(W / 2, 50 * u, boss.D.Name, 18 * u, new Color(1f, 0.85f, 0.6f), 0, true, 0, true);
                Ui.Bar(br, (float)(boss.Hp / boss.MaxHp), boss.Enraged ? new Color(1f, 0.4f, 0.1f) : new Color(0.72f, 0.12f, 0.1f));
                Ui.Outline(new Rect(br.x - 3, br.y - 3, br.width + 6, br.height + 6), Ui.Gold);
            }
            else DrawTargetFrame(g, inp, hoverId, u, W);

            // ---- banner
            var bn = g.Banner;
            if (bn != null)
            {
                float a = Mathf.Clamp01((float)System.Math.Min(System.Math.Min(bn.T * 2, (bn.Dur - bn.T) * 4), 1));
                Ui.Text(W / 2, H * 0.2f, bn.Text, 46 * u, new Color(0.98f, 0.9f, 0.72f, a), 0, true, 0, true);
                if (!string.IsNullOrEmpty(bn.Sub)) Ui.Text(W / 2, H * 0.2f + 58 * u, bn.Sub, 19 * u, new Color(Ui.Ember.r, Ui.Ember.g, Ui.Ember.b, a), 0, true);
            }

            DrawActionBar(g, u, W, H);
        }

        void DrawActionBar(Game g, float u, float W, float H)
        {
            var p = g.P;
            var hero = g.Hero;
            var s = g.Save;
            float size = 60 * u, gap = 9 * u, orb = 128 * u;
            float total = 4 * size + 3 * gap;
            float x0 = (W - total) / 2, y0 = H - size - 30 * u;
            var bar = new Rect(x0 - 26 * u, y0 - 16 * u, total + 52 * u, size + 40 * u);
            Ui.Panel(bar);
            Ui.Block(bar);
            // xp strip along the bottom of the bar
            int need = s.Level >= D.MaxLevel ? 1 : D.XpToNext(s.Level);
            float xp = s.Level >= D.MaxLevel ? 1f : (float)s.Xp / need;
            Ui.Bar(new Rect(bar.x + 10 * u, bar.yMax - 12 * u, bar.width - 20 * u, 6 * u), xp, new Color(0.95f, 0.75f, 0.3f));
            // level medallion
            var med = new Rect(W / 2 - 22 * u, bar.y - 30 * u, 44 * u, 34 * u);
            Ui.Panel(med);
            Ui.Text(W / 2, med.y + 5 * u, s.Level.ToString(), 18 * u, Ui.Ember, 0, true, 0, true);

            // orbs
            DrawOrb("hp", new Rect(bar.x - orb - 8 * u, H - orb - 14 * u, orb, orb), (float)(p.Hp / hero.MaxHp), Mathf.CeilToInt((float)p.Hp) + " / " + hero.MaxHp, u);
            DrawOrb("mp", new Rect(bar.xMax + 8 * u, H - orb - 14 * u, orb, orb), (float)(p.Mp / hero.MaxMp), Mathf.FloorToInt((float)p.Mp) + " / " + hero.MaxMp, u, g.MpFlash > 0);

            var cls = D.Classes[s.Cls];
            string[] keys = { "1", "2", "3", "F" };
            for (int i = 0; i < 4; i++)
            {
                var r = new Rect(x0 + i * (size + gap), y0, size, size);
                SlotRects[i] = r;
                Ui.Box(r, new Color(0.07f, 0.05f, 0.04f, 1f), new Color(0.62f, 0.47f, 0.26f), 2);
                if (i < 3)
                {
                    var sk = cls.Skills[i];
                    bool locked = s.Level < sk.Unlock;
                    bool noMana = !locked && p.Mp < sk.Cost;
                    Ui.Icon(sk.Id, new Rect(r.x + 5, r.y + 5, size - 10, size - 10), locked ? new Color(0.35f, 0.35f, 0.35f) : noMana ? new Color(0.55f, 0.6f, 0.95f) : Color.white);
                    double cdmax = sk.Cd * D.SkillCdMul(s.SkillLv[i]) * (1 - System.Math.Min(0.5, hero.Cdr / 100));
                    float frac = locked ? 1f : (float)System.Math.Min(1.0, p.Cd[i] / System.Math.Max(0.01, cdmax));
                    if (frac > 0) Ui.Rect(new Rect(r.x, r.y + r.height * (1 - frac), r.width, r.height * frac), new Color(0, 0, 0, 0.62f));
                    if (locked) Ui.Text(r.center.x, r.center.y - 9 * u, "Lv " + sk.Unlock, 14 * u, Ui.Ink, 0, false, 0, true);
                    else if (p.Cd[i] > 0) Ui.Text(r.center.x, r.center.y - 12 * u, Mathf.CeilToInt((float)p.Cd[i]).ToString(), 22 * u, Ui.Ink, 0, false, 0, true);
                    if (Ui.Hover(r))
                        Tooltip(r, sk.Name, sk.Cost + " MP  -  " + cdmax.ToString("0.#") + "s cooldown\n" + sk.Desc + (locked ? "\nUnlocks at level " + sk.Unlock : ""), u);
                }
                else
                {
                    Ui.Icon("potion", new Rect(r.x + 6, r.y + 6, size - 12, size - 12), s.Potions > 0 ? Color.white : new Color(0.4f, 0.4f, 0.4f));
                    Ui.Text(r.xMax - 5, r.yMax - 22 * u, s.Potions.ToString(), 16 * u, Ui.Ink, 1, false, 0, true);
                    if (Ui.Hover(r)) Tooltip(r, "Healing Tonic", "Restores half your health.", u);
                }
                Ui.Text(r.x + 5, r.y + 2, keys[i], 13 * u, Ui.Ink, -1, false, 0, true);
            }
        }

        static void Tooltip(Rect anchor, string title, string body, float u)
        {
            float w = 260 * u;
            float h = Ui.Measure(title, 15 * u).y + 8 * u;
            var lines = body.Split('\n');
            h += lines.Length * 17 * u + 10 * u;
            var r = new Rect(Mathf.Clamp(anchor.center.x - w / 2, 4, Screen.width - w - 4), anchor.y - h - 10 * u, w, h);
            Ui.Panel(r);
            float y = r.y + 6 * u;
            Ui.Text(r.x + 10 * u, y, title, 15 * u, Ui.Ember, -1, true, 0, true);
            y += 22 * u;
            foreach (var l in lines)
            {
                Ui.Text(r.x + 10 * u, y, l, 13 * u, Ui.Ink, -1, false);
                y += 17 * u;
            }
        }

        static void DrawOrb(string kind, Rect r, float frac, string label, float u, bool flash = false)
        {
            Ui.Texture(r, Ui.Orb("back"));
            Ui.TextureBottom(r, Ui.Orb(kind), frac);
            Ui.Texture(r, Ui.Orb("glass"));
            var ring = new Rect(r.x - 8 * u, r.y - 8 * u, r.width + 16 * u, r.height + 16 * u);
            Ui.Texture(ring, Ui.Orb("ring"), flash ? new Color(0.7f, 0.8f, 1.6f) : Color.white);
            Ui.Text(r.center.x, r.center.y - 9 * u, label, 14 * u, Ui.Ink, 0, false, 0, true);
            Ui.Block(r);
        }

        void DrawTargetFrame(Game g, GameInput inp, int hoverId, float u, float W)
        {
            var e = g.EnemyById(inp.TargetId);
            if (!Game.Targetable(e)) e = g.EnemyById(hoverId);
            if (!Game.Targetable(e)) return;
            float bw = 300 * u;
            var r = new Rect((W - bw) / 2, 16 * u, bw, 52 * u);
            Ui.Panel(r, true, 0.92f);
            Ui.Text(W / 2, r.y + 5 * u, e.D.Name, 16 * u, e.Id == inp.TargetId ? new Color(1f, 0.6f, 0.45f) : Ui.Ink, 0, true, 0, true);
            Ui.Bar(new Rect(r.x + 12 * u, r.y + 30 * u, bw - 24 * u, 11 * u), (float)(e.Hp / e.MaxHp), new Color(0.75f, 0.14f, 0.1f));
        }

        static void DrawEnemyBars(Game g, GameInput inp, Camera cam, int hoverId, float u)
        {
            foreach (var e in g.Enemies)
            {
                if (e.Dead || e.SpawnT > 0 || e.D.Boss) continue;
                bool show = e.Hp < e.MaxHp || e.Id == inp.TargetId || e.Id == hoverId;
                if (!show) continue;
                float hgt = e.Type == "brute" ? 3.4f : 2.4f;
                var sp = cam.WorldToScreenPoint(W3.Pos(e.X, e.Y, hgt));
                if (sp.z < 0) continue;
                float w = (e.Type == "brute" ? 64 : 44) * u;
                var r = new Rect(sp.x - w / 2, Screen.height - sp.y, w, 6 * u);
                Ui.Bar(r, (float)(e.Hp / e.MaxHp), e.Id == inp.TargetId ? new Color(1f, 0.3f, 0.15f) : new Color(0.8f, 0.15f, 0.12f));
            }
        }

        static void DrawWorldTexts(Game g, Camera cam, float u)
        {
            foreach (var t in g.Texts)
            {
                var sp = cam.WorldToScreenPoint(W3.Pos(t.X, t.Y, 1.6f + (float)t.Z * W3.S * 1.6f));
                if (sp.z < 0) continue;
                float k = (float)(t.T / t.Dur);
                float a = k < 0.7f ? 1f : 1f - (k - 0.7f) / 0.3f;
                float pop = t.Crit ? 1f + Mathf.Max(0, 0.25f - (float)t.T) * 2.2f : 1f;
                Ui.Text(sp.x, Screen.height - sp.y, t.Text, t.Size * 1.15f * u * pop, new Color(t.CR, t.CG, t.CB, a), 0, false, 0, true);
            }
        }
    }
}
