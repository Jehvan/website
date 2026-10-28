// Title, camp (road map + Hero / Bag / Forge / Advance / Shop), results and pause screens.
using System;
using System.Collections.Generic;
using System.Linq;
using Highkeep.Core;
using UnityEngine;

namespace Highkeep
{
    public sealed class Screens
    {
        readonly HighkeepApp app;
        public string Tab = "hero", Adv = "skills", Sel = null, BagSel, EqSel, ForgeSel, Msg = "";
        public bool MsgOk = true;
        public int ReforgeIdx, Floor = 1;
        string expRoute = "patrol";
        readonly List<string> expCrew = new List<string>();
        Vector2 scroll;
        float contentH = 600;

        static readonly (string id, string name)[] Tabs = { ("hero", "Hero"), ("bag", "Bag"), ("forge", "Forge"), ("adv", "Advance"), ("shop", "Shop") };

        public Screens(HighkeepApp app) { this.app = app; }

        SaveData S => app.Save;
        float U => Ui.U;

        static Color PowerCol(int mine, int need) => mine >= need * 1.1 ? Ui.Good : mine >= need * 0.9 ? Ui.Ember : Ui.Bad;

        static string SlotIcon(Item it) => it.Slot == "weapon" ? (it.Cls == "ranger" ? "bow" : it.Cls == "mage" ? "staff" : "sword") : it.Slot;

        void Persist() => app.Persist();

        void Say(string m, bool ok = true)
        {
            Msg = m;
            MsgOk = ok;
        }

        // ================================================================ TITLE
        public void Title()
        {
            float W = Screen.width, H = Screen.height, u = U;
            Ui.Gradient(new Rect(0, 0, W, H), new Color(0.04f, 0.03f, 0.02f, 0.55f), new Color(0.03f, 0.02f, 0.015f, 0.88f), 30);
            float cx = W / 2;
            Ui.Text(cx, 26 * u, "AN ORIGINAL TALE OF THE ROAD", 13 * u, Ui.Dim, 0, false);
            Ui.Text(cx, 46 * u, "HIGHKEEP", 78 * u, new Color(0.97f, 0.87f, 0.62f), 0, true, 0, true);
            Ui.Text(cx, 132 * u, "R O A D", 34 * u, Ui.Ember, 0, true, 0, true);
            float y = 190 * u;
            y += Ui.Text(cx, y, D.IntroText, 17 * u, new Color(0.88f, 0.8f, 0.64f), 0, false, Mathf.Min(720 * u, W - 80)) + 22 * u;
            if (S != null)
            {
                var hs = Items.HeroStats(S);
                if (Ui.Button(new Rect(cx - 200 * u, y, 400 * u, 56 * u), "Continue  -  Lv " + S.Level + " " + D.Classes[S.Cls].Name + "  -  Power " + hs.Power, Btn.Primary, true, 18 * u))
                    app.ContinueGame();
                y += 72 * u;
            }
            Ui.Text(cx, y, S != null ? "Or begin a new hero" : "Choose your class", 14 * u, Ui.Dim, 0, false);
            y += 28 * u;
            float cw = Mathf.Min(300 * u, (W - 80) / 3 - 14), gap = 16 * u;
            float x0 = cx - (3 * cw + 2 * gap) / 2;
            float ch = Mathf.Max(220 * u, H - y - 60 * u);
            for (int i = 0; i < 3; i++)
            {
                var c = D.Classes[D.ClassOrder[i]];
                var r = new Rect(x0 + i * (cw + gap), y, cw, ch);
                Ui.Panel(r, false, Ui.Hover(r) ? 1f : 0.94f);
                Ui.Icon(c.Id, new Rect(r.x + 14, r.y + 14, 64 * u, 64 * u));
                Ui.Text(r.x + 90 * u, r.y + 16, c.Name, 24 * u, Ui.Ink, -1, true, 0, true);
                Ui.Text(r.x + 90 * u, r.y + 50 * u, "HP " + c.Hp + "  MP " + c.Mp + "  Dmg " + c.Damage + "  Spd " + c.Speed, 13 * u, Ui.Dim, -1, false);
                Ui.Text(r.x + 16, r.y + 92 * u, c.Blurb, 15 * u, new Color(0.84f, 0.77f, 0.62f), -1, false, cw - 32);
                for (int j = 0; j < 3; j++) Ui.Icon(c.Skills[j].Id, new Rect(r.x + 16 + j * 46 * u, r.yMax - 58 * u, 40 * u, 40 * u));
                if (Ui.Button(new Rect(r.x + 16, r.yMax - 106 * u, cw - 32, 36 * u), "Choose", Btn.Normal, true, 15 * u)) app.PickClass(c.Id);
            }
            Ui.Text(cx, H - 30 * u, "Click the ground to move  -  click a foe to attack  -  1 2 3 skills  -  F potion  -  Esc pause  -  scroll to zoom", 13 * u, Ui.Dim, 0, false);
        }

        // ================================================================ CAMP
        public void Camp()
        {
            float W = Screen.width, H = Screen.height, u = U;
            var s = S;
            var hero = Items.HeroStats(s);
            // header
            Ui.Gradient(new Rect(0, 0, W, 64 * u), new Color(0.03f, 0.02f, 0.015f, 0.85f), new Color(0.03f, 0.02f, 0.015f, 0f), 10);
            Ui.Text(18, 12 * u, "Highkeep Road", 26 * u, new Color(0.97f, 0.87f, 0.62f), -1, true, 0, true);
            float rx = W - 18;
            if (Ui.Button(new Rect(rx - 86 * u, 10 * u, 86 * u, 36 * u), "Menu", Btn.Normal, true, 14 * u)) app.ToTitle();
            float x = rx - 104 * u;
            void Stat(string txt, Color col, string icon)
            {
                float w = Ui.Measure(txt, 17 * u, false, true).x;
                Ui.Text(x, 17 * u, txt, 17 * u, col, 1, false, 0, true);
                x -= w + 8;
                if (icon != null)
                {
                    Ui.Icon(icon, new Rect(x - 26 * u, 12 * u, 28 * u, 28 * u));
                    x -= 36 * u;
                }
                x -= 16 * u;
            }
            Stat("Power " + hero.Power, Ui.Ember, null);
            Stat(s.Steel + " steel", Ui.Steel, "steel");
            Stat(s.Potions + "/" + D.MaxPotions, Ui.Ink, "potion");
            Stat(s.Gold.ToString(), Ui.Ink, "coin");

            float top = 66 * u;
            float lw = Mathf.Min(W * 0.42f, 600 * u);
            DrawMap(14, top, lw, s, hero);
            float sx = W - Mathf.Min(W * 0.4f, 560 * u) - 14;
            DrawSide(sx, top, W - sx - 14, H - top - 14, s, hero);
        }

        // --- map
        void DrawMap(float x, float y, float w, SaveData s, HeroStats hero)
        {
            float u = U;
            float mw = w, mh = Mathf.Min(w * 0.6f, (Screen.height - y) * 0.46f);
            mw = mh / 0.6f;
            var r = new Rect(x, y, mw, mh);
            Ui.Parchment(r);
            Ui.Outline(new Rect(r.x - 4, r.y - 4, r.width + 8, r.height + 8), Ui.Gold);
            Ui.Block(r);
            var rnd = new System.Random(7);
            var nodes = new List<Vector2>();
            foreach (var st in D.Stages) nodes.Add(new Vector2(x + st.NodeX * mw, y + st.NodeY * mh));
            nodes.Add(new Vector2(x + D.Vault.NodeX * mw, y + D.Vault.NodeY * mh));
            // little painted mountains and trees
            for (int i = 0; i < 46; i++)
            {
                float px = x + (float)rnd.NextDouble() * mw, py = y + (float)rnd.NextDouble() * mh;
                if (nodes.Any(n => (n - new Vector2(px, py)).magnitude < 50 * u)) continue;
                float sz = (5 + (float)rnd.NextDouble() * 8) * u;
                var col = i % 3 == 0 ? new Color(0.42f, 0.36f, 0.26f, 0.85f) : new Color(0.3f, 0.4f, 0.2f, 0.75f);
                Ui.Line(new Vector2(px, py - sz), new Vector2(px - sz * 0.7f, py + sz * 0.6f), col, 2 * u);
                Ui.Line(new Vector2(px, py - sz), new Vector2(px + sz * 0.7f, py + sz * 0.6f), col, 2 * u);
            }
            // road (Catmull-Rom through the stage nodes)
            var road = new List<Vector2> { new Vector2(x - 6, nodes[0].y + 30 * u) };
            road.AddRange(nodes.Take(6));
            Vector2 prev = road[0];
            for (int i = 0; i < road.Count - 1; i++)
            {
                Vector2 p0 = road[Mathf.Max(0, i - 1)], p1 = road[i], p2 = road[i + 1], p3 = road[Mathf.Min(road.Count - 1, i + 2)];
                for (int j = 1; j <= 10; j++)
                {
                    float t = j / 10f;
                    var pt = 0.5f * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
                    Ui.Line(prev, pt, new Color(0.42f, 0.29f, 0.15f), 9 * u);
                    Ui.Line(prev, pt, new Color(0.78f, 0.62f, 0.37f), 5 * u);
                    prev = pt;
                }
            }
            Ui.Line(nodes[5], nodes[6], new Color(0.45f, 0.32f, 0.2f), 3 * u);
            if (Sel == null) Sel = Math.Min(6, s.Cleared + 1).ToString();
            for (int i = 0; i < nodes.Count; i++)
            {
                bool vault = i == 6;
                string sid = vault ? "vault" : (i + 1).ToString();
                bool unlocked = vault ? s.Cleared >= 6 : i + 1 <= s.Cleared + 1;
                bool done = !vault && s.Cleared >= i + 1;
                bool cur = !vault && i + 1 == s.Cleared + 1;
                bool sel = Sel == sid;
                float rr = 17 * u;
                var n = nodes[i];
                var nr = new Rect(n.x - rr, n.y - rr, rr * 2, rr * 2);
                if (sel) Ui.Box(new Rect(nr.x - 6, nr.y - 6, nr.width + 12, nr.height + 12), new Color(1, 1, 1, 0.25f), new Color(1, 1, 1, 0.95f), 2);
                else if (cur) Ui.Box(new Rect(nr.x - 5, nr.y - 5, nr.width + 10, nr.height + 10), new Color(0.9f, 0.5f, 0.2f, 0.25f + 0.15f * Mathf.Sin(Time.time * 4)), Ui.Ember, 2);
                var col = done ? new Color(0.25f, 0.42f, 0.22f) : unlocked ? new Color(0.58f, 0.15f, 0.12f) : new Color(0.35f, 0.33f, 0.29f);
                if (vault) col = unlocked ? new Color(0.1f, 0.08f, 0.07f) : new Color(0.3f, 0.28f, 0.26f);
                Ui.Box(nr, col, new Color(0.2f, 0.1f, 0.04f), 2);
                string label = vault && unlocked ? "v" + (s.VaultBest > 0 ? s.VaultBest.ToString() : "-") : !unlocked ? "?" : (i + 1).ToString();
                Ui.Text(n.x, n.y - 11 * u, label, 17 * u, new Color(1f, 0.95f, 0.8f), 0, true, 0, true);
                Ui.Text(n.x, n.y + rr + 3, vault ? D.Vault.Name : D.Stages[i].Name, 12 * u, new Color(0.22f, 0.14f, 0.06f), 0, true, 0, true, false);
                if (Ui.Hot(new Rect(nr.x - 6, nr.y - 6, nr.width + 12, nr.height + 12))) Sel = sid;
            }
            // info panel under the map
            float iy = y + mh + 14 * u, ih = 182 * u;
            var ir = new Rect(x, iy, mw, ih);
            Ui.Panel(ir, false, 0.95f);
            Ui.Block(ir);
            float ix = x + 16 * u, ty = iy + 12 * u;
            if (Sel == "vault")
            {
                bool un = s.Cleared >= 6;
                Ui.Text(ix, ty, D.Vault.Name, 22 * u, Ui.Ink, -1, true, 0, true);
                ty += 32 * u;
                ty += Ui.Text(ix, ty, D.Vault.Blurb, 14 * u, new Color(0.84f, 0.77f, 0.62f), -1, false, mw - 32 * u) + 8 * u;
                if (un)
                {
                    Floor = Mathf.Clamp(Floor, 1, s.VaultBest + 1);
                    int need = D.Vault.Power + 25 * Floor;
                    Ui.Text(ix, ty, "Best floor " + (s.VaultBest > 0 ? s.VaultBest.ToString() : "-") + "   Suggested power " + need + "   Yours ", 14 * u, Ui.Ink, -1, false);
                    Ui.Text(ix + Ui.Measure("Best floor 00   Suggested power 000   Yours ", 14 * u, false).x + 10 * u, ty, hero.Power.ToString(), 14 * u, PowerCol(hero.Power, need), -1, false, 0, true);
                    ty += 26 * u;
                    Ui.Text(ix, ty + 4 * u, "Start at floor", 14 * u, Ui.Ink, -1, false);
                    if (Ui.Button(new Rect(ix + 120 * u, ty, 30 * u, 28 * u), "-", Btn.Normal, true, 16 * u)) Floor = Mathf.Max(1, Floor - 1);
                    Ui.Text(ix + 175 * u, ty + 2 * u, Floor.ToString(), 18 * u, Ui.Ember, 0, true, 0, true);
                    if (Ui.Button(new Rect(ix + 200 * u, ty, 30 * u, 28 * u), "+", Btn.Normal, true, 16 * u)) Floor = Mathf.Min(s.VaultBest + 1, Floor + 1);
                    if (Ui.Button(new Rect(ix, iy + ih - 50 * u, mw - 32 * u, 40 * u), "Descend", Btn.Primary, true, 18 * u)) app.March("vault", Floor);
                }
                else Ui.Text(ix, ty, "Defeat the Ashen Regent to unlock the Vaults.", 14 * u, Ui.Dim, -1, false);
            }
            else
            {
                int sid = int.Parse(Sel);
                var d = D.Stages[sid - 1];
                bool locked = sid > s.Cleared + 1;
                Ui.Text(ix, ty, sid + ". " + d.Name, 22 * u, Ui.Ink, -1, true, 0, true);
                ty += 32 * u;
                ty += Ui.Text(ix, ty, d.Blurb, 14 * u, new Color(0.84f, 0.77f, 0.62f), -1, false, mw - 32 * u) + 8 * u;
                string line = "Waves " + d.Waves.Count + "   Suggested power " + d.Power + "   Yours ";
                Ui.Text(ix, ty, line, 14 * u, Ui.Ink, -1, false);
                Ui.Text(ix + Ui.Measure(line, 14 * u, false).x, ty, hero.Power.ToString(), 14 * u, PowerCol(hero.Power, d.Power), -1, false, 0, true);
                ty += 22 * u;
                string msg = hero.Power >= d.Power * 1.1 ? "You outmatch this road." : hero.Power >= d.Power * 0.9 ? "A fair fight." : "Dangerous: you are underpowered.";
                Ui.Text(ix, ty, msg, 13 * u, Ui.Dim, -1, false);
                if (locked) Ui.Text(ix, iy + ih - 40 * u, "Clear the previous stage first.", 14 * u, Ui.Dim, -1, false);
                else if (Ui.Button(new Rect(ix, iy + ih - 50 * u, mw - 32 * u, 40 * u), s.Cleared >= sid ? "Replay" : "March", Btn.Primary, true, 18 * u))
                    app.March(Sel, 0);
            }
        }

        // --- side panel with tabs and a scroll area
        void DrawSide(float x, float y, float w, float h, SaveData s, HeroStats hero)
        {
            float u = U;
            float tw = w / Tabs.Length;
            for (int i = 0; i < Tabs.Length; i++)
            {
                var (id, name) = Tabs[i];
                string lab = name + (id == "bag" && s.Bag.Count > 0 ? " " + s.Bag.Count : "");
                if (Ui.Button(new Rect(x + i * tw, y, tw - 4, 36 * u), lab, Tab == id ? Btn.On : Btn.Normal, true, 15 * u) && Tab != id)
                {
                    Tab = id;
                    Msg = "";
                    scroll = Vector2.zero;
                }
            }
            var pr = new Rect(x, y + 40 * u, w, h - 40 * u);
            Ui.Panel(pr, false, 0.97f);
            Ui.Block(pr);
            var view = new Rect(pr.x + 12 * u, pr.y + 12 * u, pr.width - 24 * u, pr.height - 24 * u);
            scroll = GUI.BeginScrollView(view, scroll, new Rect(0, 0, view.width - 18, Mathf.Max(view.height, contentH)), false, false, GUIStyle.none, GUI.skin.verticalScrollbar);
            float cw = view.width - 18;
            float end = 0;
            switch (Tab)
            {
                case "hero": end = TabHero(0, 0, cw, s, hero); break;
                case "bag": end = TabBag(0, 0, cw, s, hero); break;
                case "forge": end = TabForge(0, 0, cw, s, hero); break;
                case "adv": end = TabAdv(0, 0, cw, s, hero); break;
                case "shop": end = TabShop(0, 0, cw, s, hero); break;
            }
            GUI.EndScrollView();
            if (Event.current.type == EventType.Repaint) contentH = end + 20;
        }

        float MsgBar(float x, float y, float w)
        {
            if (string.IsNullOrEmpty(Msg)) return 0;
            float u = U;
            Ui.Box(new Rect(x, y, w, 28 * u), MsgOk ? new Color(0.2f, 0.32f, 0.2f, 0.85f) : new Color(0.35f, 0.15f, 0.12f, 0.85f), MsgOk ? Ui.Good : Ui.Bad, 1);
            Ui.Text(x + 8, y + 5 * u, Msg, 13 * u, Ui.Ink, -1, false);
            return 34 * u;
        }

        void Tile(Rect r, Item it, bool selected, Action onClick = null)
        {
            float u = U;
            if (it == null)
            {
                Ui.Box(r, new Color(0.08f, 0.06f, 0.05f), Ui.LineCol, 1);
                return;
            }
            var col = Ui.RarityColor(it.Rarity);
            Ui.Box(r, new Color(0.13f, 0.1f, 0.075f), selected ? Color.white : col, selected ? 2.5f : 1.8f);
            Ui.Rect(new Rect(r.x, r.y, r.width, r.height * 0.5f), new Color(col.r, col.g, col.b, 0.08f));
            Ui.Icon(SlotIcon(it), new Rect(r.x + r.width * 0.1f, r.y + r.height * 0.1f, r.width * 0.8f, r.height * 0.8f));
            if (it.Plus > 0) Ui.Text(r.x + 3, r.y, "+" + it.Plus, r.width * 0.28f, Ui.Ember, -1, false, 0, true);
            Ui.Text(r.xMax - 3, r.yMax - r.height * 0.32f, it.Ilvl.ToString(), r.width * 0.25f, Ui.Ink, 1, false);
            if (it.Set.HasValue) Ui.Rect(new Rect(r.xMax - 9, r.y + 3, 6, 6), new Color(0.35f, 0.88f, 0.66f));
            if (it.Lock) Ui.Text(r.x + 3, r.yMax - r.height * 0.32f, "L", r.width * 0.24f, Ui.Ink, -1, false, 0, true);
            if (onClick != null && Ui.Hot(r)) onClick();
        }

        List<(string, Color)> ItemLines(Item it)
        {
            var t = Items.ItemTotals(it);
            var l = new List<(string, Color)>();
            if (it.Slot == "weapon") l.Add((t["damage"].ToString("0.0") + " Damage", Ui.Ink));
            if (it.Slot == "armor") l.Add((t["armor"].ToString("0") + " Armor", Ui.Ink));
            double m = Items.ForgeMul(it);
            foreach (var a in it.Aff) l.Add((Items.DescribeAffix(a, m), new Color(0.54f, 0.72f, 1f)));
            return l;
        }

        float ItemCard(float x, float y, float w, Item it, Item compare = null, bool showCmp = false)
        {
            float u = U;
            var r = Items.RarityOf(it.Rarity);
            float y0 = y;
            Ui.Box(new Rect(x, y, w, 4), Ui.RarityColor(it.Rarity));
            y += 8 * u;
            Ui.Text(x + 8, y, it.Name + (it.Plus > 0 ? "  +" + it.Plus : ""), 18 * u, Ui.RarityColor(it.Rarity), -1, true, 0, true);
            y += 26 * u;
            Ui.Text(x + 8, y, r.Name + " " + it.Kind + " - " + D.SlotLabel[it.Slot] + " - ilvl " + it.Ilvl, 12 * u, Ui.Dim, -1, false);
            y += 20 * u;
            foreach (var (s, c) in ItemLines(it))
            {
                Ui.Text(x + 8, y, s, 14 * u, c, -1, false);
                y += 19 * u;
            }
            if (it.Set.HasValue)
            {
                int have = Items.SetCounts(S.Equip).TryGetValue(it.Set.Value, out var n) ? n : 0;
                double tier = 1 + 0.35 * it.Set.Value;
                Ui.Text(x + 8, y + 2, D.SetNames[it.Set.Value] + " Set (" + have + "/3 worn)", 13 * u, new Color(0.36f, 0.88f, 0.66f), -1, true);
                y += 22 * u;
                foreach (int need in new[] { 2, 3 })
                {
                    var bonus = string.Join(", ", D.SetBonus(need, tier).Select(kv => "+" + kv.Value + " " + (D.Affixes.TryGetValue(kv.Key, out var ad) ? ad.Label : kv.Key)));
                    Ui.Text(x + 8, y, "(" + need + ") " + bonus, 12 * u, have >= need ? new Color(0.6f, 0.94f, 0.8f) : Ui.Dim, -1, false);
                    y += 17 * u;
                }
            }
            if (showCmp)
            {
                var tot = Items.ItemTotals(it);
                var cur = Items.ItemTotals(compare);
                var labels = new (string k, string l)[] { ("hp", "Health"), ("mp", "Mana"), ("damage", "Damage"), ("armor", "Armor"), ("crit", "Crit %"), ("speed", "Speed %"), ("regen", "Mana/s") };
                Ui.Text(x + 8, y + 4, compare != null ? "vs equipped " + compare.Name : "vs empty slot", 11 * u, Ui.Dim, -1, false);
                y += 22 * u;
                float cx = x + 8;
                foreach (var (k, lab) in labels)
                {
                    double d = Math.Round(tot[k] - cur[k], 2);
                    if (d == 0) continue;
                    string s = (d > 0 ? "+" : "") + d.ToString("0.##") + " " + lab;
                    Ui.Text(cx, y, s, 12 * u, d > 0 ? Ui.Good : Ui.Bad, -1, false);
                    cx += Ui.Measure(s, 12 * u, false).x + 12;
                    if (cx > x + w - 90)
                    {
                        cx = x + 8;
                        y += 16 * u;
                    }
                }
                y += 18 * u;
                int now = Items.HeroStats(S).Power;
                var eq = new Dictionary<string, Item>(S.Equip) { [it.Slot] = it };
                int nw = Items.HeroStats(S, eq).Power;
                Ui.Text(x + 8, y, "Power " + now + " -> " + nw + " (" + (nw - now >= 0 ? "+" : "") + (nw - now) + ")", 14 * u, nw > now ? Ui.Good : nw < now ? Ui.Bad : Ui.Ink, -1, true, 0, true);
                y += 24 * u;
            }
            return y - y0 + 6;
        }

        // --- hero tab
        float TabHero(float x, float y, float w, SaveData s, HeroStats hero)
        {
            float u = U;
            var c = D.Classes[s.Cls];
            int need = s.Level >= D.MaxLevel ? 0 : D.XpToNext(s.Level);
            Ui.Box(new Rect(x, y, 56 * u, 56 * u), new Color(0.1f, 0.075f, 0.055f), Ui.LineCol);
            Ui.Icon(c.Id, new Rect(x + 4, y + 4, 48 * u, 48 * u));
            Ui.Text(x + 66 * u, y, c.Name, 22 * u, Ui.Ink, -1, true, 0, true);
            Ui.Bar(new Rect(x + 66 * u, y + 32 * u, w - 66 * u - 110 * u, 9 * u), need > 0 ? (float)s.Xp / need : 1f, new Color(0.95f, 0.75f, 0.3f));
            Ui.Text(x + 66 * u, y + 43 * u, "Level " + s.Level + (need > 0 ? "  -  " + s.Xp + " / " + need + " XP" : "  (max)"), 12 * u, Ui.Dim, -1, false);
            Ui.Box(new Rect(x + w - 96 * u, y, 96 * u, 56 * u), new Color(0.1f, 0.075f, 0.055f), Ui.EmberDark);
            Ui.Text(x + w - 48 * u, y + 3, "POWER", 10 * u, Ui.Dim, 0, false);
            Ui.Text(x + w - 48 * u, y + 17 * u, hero.Power.ToString(), 28 * u, Ui.Ember, 0, true, 0, true);
            y += 70 * u;
            var stats = new (string, string)[]
            {
                ("Health", hero.MaxHp.ToString()), ("Mana", hero.MaxMp.ToString()), ("Damage", hero.Damage.ToString("0.#")), ("Armor", hero.Armor.ToString()),
                ("Crit", hero.Crit.ToString("0.#") + "%"), ("Speed", Math.Round(hero.Speed).ToString()), ("Mana regen", hero.Regen.ToString("0.##") + "/s"),
                ("Reduction", Math.Round(100 - 12000.0 / (120 + hero.Armor)) + "%"),
            };
            for (int i = 0; i < stats.Length; i++)
            {
                float cx = x + (i % 2) * (w / 2 + 6), cy = y + (i / 2) * 22 * u;
                Ui.Text(cx, cy, stats[i].Item1, 14 * u, Ui.Dim, -1, false);
                Ui.Text(cx + w / 2 - 14, cy, stats[i].Item2, 14 * u, Ui.Ink, 1, false);
            }
            y += 4 * 22 * u + 10;
            Ui.Text(x, y, "EQUIPMENT", 13 * u, Ui.Ember, -1, true, 0, true);
            y += 22 * u;
            foreach (var sl in D.Slots)
            {
                var it = s.Eq(sl);
                var row = new Rect(x, y, w, 44 * u);
                Tile(new Rect(x, y, 44 * u, 44 * u), it, EqSel == sl);
                Ui.Text(x + 54 * u, y + 2, D.SlotLabel[sl].ToUpper(), 10 * u, Ui.Dim, -1, false);
                Ui.Text(x + 54 * u, y + 15 * u, it != null ? it.Name : "Empty", 15 * u, it != null ? Ui.RarityColor(it.Rarity) : Ui.Dim, -1, true);
                if (it != null && Ui.Hot(row)) EqSel = EqSel == sl ? null : sl;
                y += 50 * u;
            }
            if (EqSel != null && s.Eq(EqSel) != null)
            {
                var it = s.Eq(EqSel);
                float hh = ItemCard(x, y, w, it);
                if (Ui.Button(new Rect(x + w - 110 * u, y + 8, 100 * u, 28 * u), "Unequip", Btn.Normal, s.Bag.Count < s.BagSize, 13 * u))
                {
                    s.Bag.Add(it);
                    s.Equip[EqSel] = null;
                    EqSel = null;
                    Persist();
                }
                y += hh + 6;
            }
            Ui.Text(x, y, "SKILLS", 13 * u, Ui.Ember, -1, true, 0, true);
            y += 22 * u;
            for (int i = 0; i < 3; i++)
            {
                var sk = c.Skills[i];
                bool locked = s.Level < sk.Unlock;
                Ui.Icon(sk.Id, new Rect(x, y, 34 * u, 34 * u), locked ? new Color(0.4f, 0.4f, 0.4f) : Color.white);
                Ui.Text(x + 42 * u, y - 2, sk.Name, 14 * u, locked ? Ui.Dim : Ui.Ink, -1, true, 0, true);
                string sub = locked ? "Unlocks at Lv " + sk.Unlock : sk.Cost + " MP  -  " + sk.Cd + "s  -  Lv " + s.SkillLv[i] + "  " + sk.Desc;
                Ui.Text(x + 42 * u, y + 17 * u, sub, 11 * u, Ui.Dim, -1, false, w - 42 * u);
                y += 42 * u;
            }
            return y;
        }

        // --- bag tab
        float TabBag(float x, float y, float w, SaveData s, HeroStats hero)
        {
            float u = U;
            Ui.Text(x, y, "Bag " + s.Bag.Count + " / " + s.BagSize, 16 * u, Ui.Ink, -1, true, 0, true);
            var commons = s.Bag.Where(it => it.Rarity == "common" && !it.Lock).ToList();
            if (Ui.Button(new Rect(x + w - 222 * u, y - 4, 66 * u, 28 * u), "Sort", Btn.Normal, true, 13 * u))
            {
                s.Bag = s.Bag.OrderBy(it => -Items.RarityIndex(it)).ThenBy(it => -it.Plus).ThenBy(it => -it.Ilvl).ThenBy(it => it.Slot).ToList();
                Persist();
            }
            if (Ui.Button(new Rect(x + w - 150 * u, y - 4, 150 * u, 28 * u), "Sell Common (" + commons.Sum(Items.SellValue) + "g)", Btn.Normal, commons.Count > 0, 12 * u))
            {
                s.Gold += commons.Sum(Items.SellValue);
                s.Bag.RemoveAll(it => it.Rarity == "common" && !it.Lock);
                BagSel = null;
                Persist();
            }
            y += 32 * u;
            int cols = 6, size = s.BagSize, rows = Mathf.CeilToInt(size / (float)cols);
            float ts = Mathf.Min(50 * u, (w - (cols - 1) * 6) / cols);
            Item sel = s.Bag.FirstOrDefault(it => it.Id == BagSel);
            for (int i = 0; i < size; i++)
            {
                var r = new Rect(x + (i % cols) * (ts + 6), y + (i / cols) * (ts + 6), ts, ts);
                var it = i < s.Bag.Count ? s.Bag[i] : null;
                Tile(r, it, it != null && it.Id == BagSel, it != null ? () => BagSel = it.Id : (Action)null);
            }
            y += rows * (ts + 6) + 8;
            if (sel != null)
            {
                float hh = ItemCard(x, y, w, sel, s.Eq(sel.Slot), true);
                float by = y + hh + 4;
                if (Ui.Button(new Rect(x, by, 96 * u, 32 * u), "Equip", Btn.Primary, true, 14 * u))
                {
                    int idx = s.Bag.IndexOf(sel);
                    var old = s.Eq(sel.Slot);
                    s.Equip[sel.Slot] = sel;
                    if (old != null)
                    {
                        s.Bag[idx] = old;
                        BagSel = old.Id;
                    }
                    else
                    {
                        s.Bag.RemoveAt(idx);
                        BagSel = null;
                    }
                    Persist();
                }
                if (Ui.Button(new Rect(x + 102 * u, by, 84 * u, 32 * u), "Forge", Btn.Normal, true, 14 * u))
                {
                    ForgeSel = sel.Id;
                    Tab = "forge";
                    Msg = "";
                }
                if (Ui.Button(new Rect(x + 192 * u, by, 84 * u, 32 * u), sel.Lock ? "Unlock" : "Lock", Btn.Normal, true, 14 * u))
                {
                    sel.Lock = !sel.Lock;
                    Persist();
                }
                if (Ui.Button(new Rect(x, by + 38 * u, 210 * u, 28 * u), "Dismantle +" + Items.DismantleValue(sel) + " steel", Btn.Normal, !sel.Lock, 12 * u))
                {
                    s.Steel += Items.DismantleValue(sel);
                    s.Bag.Remove(sel);
                    BagSel = null;
                    Persist();
                }
                if (Ui.Button(new Rect(x + 216 * u, by + 38 * u, 110 * u, 28 * u), "Sell " + Items.SellValue(sel) + "g", Btn.Normal, !sel.Lock, 12 * u))
                {
                    s.Gold += Items.SellValue(sel);
                    s.Bag.Remove(sel);
                    BagSel = null;
                    Persist();
                }
                y = by + 72 * u;
            }
            else y += Ui.Text(x, y, "Select an item to compare it with what you are wearing. Lock items you want to keep.", 13 * u, Ui.Dim, -1, false, w);
            return y;
        }

        (Item it, string where) Find(string id)
        {
            if (id == null) return (null, null);
            foreach (var sl in D.Slots)
            {
                var e = S.Eq(sl);
                if (e != null && e.Id == id) return (e, sl);
            }
            var b = S.Bag.FirstOrDefault(i => i.Id == id);
            return b != null ? (b, "bag") : (null, null);
        }

        // --- forge tab
        float TabForge(float x, float y, float w, SaveData s, HeroStats hero)
        {
            float u = U;
            var all = D.Slots.Select(sl => s.Eq(sl)).Where(i => i != null).Concat(s.Bag).ToList();
            if (ForgeSel == null || Find(ForgeSel).it == null) ForgeSel = all.Count > 0 ? all[0].Id : null;
            Ui.Text(x, y, "Steel " + s.Steel, 15 * u, Ui.Steel, -1, true, 0, true);
            Ui.Text(x + w, y, "Gold " + s.Gold, 15 * u, Ui.Ember, 1, true, 0, true);
            y += 26 * u;
            y += MsgBar(x, y, w);
            int cols = 8;
            float ts = Mathf.Min(42 * u, (w - (cols - 1) * 5) / cols);
            for (int i = 0; i < all.Count; i++)
            {
                var it = all[i];
                Tile(new Rect(x + (i % cols) * (ts + 5), y + (i / cols) * (ts + 5), ts, ts), it, ForgeSel == it.Id, () => { ForgeSel = it.Id; Msg = ""; });
            }
            y += Mathf.Ceil(Mathf.Max(1, all.Count) / (float)cols) * (ts + 5) + 8;
            var (sel, where) = Find(ForgeSel);
            if (sel != null)
            {
                y += ItemCard(x, y, w, sel) + 2;
                Ui.Text(x, y, "Forge pity " + sel.Fp + " / 100  (at 100 the next forge cannot fail)", 11 * u, Ui.Dim, -1, false);
                Ui.Bar(new Rect(x, y + 17 * u, w, 6 * u), sel.Fp / 100f, new Color(0.95f, 0.75f, 0.3f));
                y += 32 * u;
                var info = Items.GetForgeInfo(sel);
                if (info != null)
                {
                    Ui.Text(x, y, "Forge +" + (sel.Plus + 1) + "   success " + Math.Round(info.Chance * 100) + "%" + (info.Guaranteed ? "  (guaranteed)" : ""), 15 * u, Ui.Ink, -1, true, 0, true);
                    Ui.Text(x, y + 21 * u, "+10% to every stat on the item. A failure never lowers it.", 11 * u, Ui.Dim, -1, false);
                    bool ok = s.Gold >= info.Gold && s.Steel >= info.Steel;
                    if (Ui.Button(new Rect(x, y + 42 * u, 270 * u, 34 * u), "Forge  -  " + info.Gold + "g  -  " + info.Steel + " steel", Btn.Primary, ok, 14 * u))
                    {
                        s.Gold -= info.Gold;
                        s.Steel -= info.Steel;
                        bool res = Items.ForgeAttempt(sel);
                        Say(res ? "Forged to +" + sel.Plus + "!" : "The forge failed (pity " + sel.Fp + "/100). Only the materials were lost.", res);
                        Persist();
                    }
                    y += 84 * u;
                }
                else
                {
                    Ui.Text(x, y, "Fully forged (+" + D.MaxPlus + ")", 15 * u, Ui.Ember, -1, true);
                    y += 28 * u;
                }
                if (Items.CanReforge(sel))
                {
                    var rc = Items.ReforgeCost(sel);
                    var fodder = s.Bag.FirstOrDefault(o => o.Id != sel.Id && !o.Lock && o.Slot == sel.Slot && o.Rarity == sel.Rarity);
                    ReforgeIdx = Mathf.Min(ReforgeIdx, sel.Aff.Count - 1);
                    Ui.Text(x, y, "Reforge: replace one effect (consumes a spare matching item)", 13 * u, Ui.Ink, -1, false);
                    y += 22 * u;
                    float cx = x;
                    for (int i = 0; i < sel.Aff.Count; i++)
                    {
                        string lab = Items.DescribeAffix(sel.Aff[i], Items.ForgeMul(sel));
                        float bw = Ui.Measure(lab, 12 * u, false).x + 24 * u;
                        if (Ui.Button(new Rect(cx, y, bw, 28 * u), lab, ReforgeIdx == i ? Btn.On : Btn.Normal, true, 11 * u)) ReforgeIdx = i;
                        cx += bw + 6;
                        if (cx > x + w - 100)
                        {
                            cx = x;
                            y += 32 * u;
                        }
                    }
                    y += 34 * u;
                    bool can = fodder != null && s.Gold >= rc.gold && s.Steel >= rc.steel;
                    if (Ui.Button(new Rect(x, y, 280 * u, 32 * u), fodder != null ? "Reforge  -  " + rc.gold + "g  -  " + rc.steel + " steel" : "Needs a matching spare item", Btn.Normal, can, 13 * u))
                    {
                        s.Bag.Remove(fodder);
                        s.Gold -= rc.gold;
                        s.Steel -= rc.steel;
                        Items.ReforgeAffix(sel, ReforgeIdx);
                        Say("Reforged: " + Items.DescribeAffix(sel.Aff[ReforgeIdx]));
                        Persist();
                    }
                    y += 42 * u;
                }
                if (where == "bag" && sel.Set.HasValue)
                {
                    Ui.Text(x, y, "Set research: study to add " + Items.StudyValue(sel) + " to " + D.SetNames[sel.Set.Value], 13 * u, Ui.Ink, -1, false);
                    if (Ui.Button(new Rect(x, y + 22 * u, 230 * u, 30 * u), "Study (consumes item)", Btn.Normal, !sel.Lock, 13 * u))
                    {
                        string key = sel.Set.Value.ToString();
                        int before = Items.ResearchLevel(s.Research.TryGetValue(key, out var xp0) ? xp0 : 0);
                        s.Research[key] = (s.Research.TryGetValue(key, out var xp1) ? xp1 : 0) + Items.StudyValue(sel);
                        s.Bag.Remove(sel);
                        ForgeSel = null;
                        int after = Items.ResearchLevel(s.Research[key]);
                        Say(after > before ? D.SetNames[sel.Set.Value] + " research reached level " + after + "!" : "Research gained.");
                        Persist();
                    }
                    y += 60 * u;
                }
            }
            Ui.Text(x, y, "SET RESEARCH", 13 * u, Ui.Ember, -1, true, 0, true);
            y += 22 * u;
            for (int i = 0; i < D.SetNames.Length; i++)
            {
                int xp = s.Research.TryGetValue(i.ToString(), out var v) ? v : 0;
                int L = Items.ResearchLevel(xp);
                int pv = Items.ResearchNeed(L), nx = Items.ResearchNeed(L + 1);
                Ui.Text(x, y, D.SetNames[i], 13 * u, Ui.Ink, -1, false);
                Ui.Text(x + w, y, "Lv " + L + (L >= D.ResearchMax ? " (max)" : ""), 13 * u, Ui.Ember, 1, false);
                Ui.Bar(new Rect(x, y + 18 * u, w, 5 * u), L >= D.ResearchMax ? 1f : (float)(xp - pv) / Mathf.Max(1, nx - pv), new Color(0.95f, 0.75f, 0.3f));
                y += 30 * u;
            }
            return y;
        }

        // --- advance tab
        float TabAdv(float x, float y, float w, SaveData s, HeroStats hero)
        {
            float u = U;
            Ui.Text(x, y, "Steel " + s.Steel, 15 * u, Ui.Steel, -1, true, 0, true);
            Ui.Text(x + w, y, "Gold " + s.Gold, 15 * u, Ui.Ember, 1, true, 0, true);
            y += 26 * u;
            y += MsgBar(x, y, w);
            var subs = new (string, string)[] { ("skills", "Skills"), ("traits", "Traits"), ("sigil", "Sigil"), ("arts", "Relics"), ("exped", "Lodge") };
            float sw = w / subs.Length;
            for (int i = 0; i < subs.Length; i++)
                if (Ui.Button(new Rect(x + i * sw, y, sw - 3, 30 * u), subs[i].Item2, Adv == subs[i].Item1 ? Btn.On : Btn.Normal, true, 13 * u) && Adv != subs[i].Item1)
                {
                    Adv = subs[i].Item1;
                    Msg = "";
                }
            y += 40 * u;
            switch (Adv)
            {
                case "skills": return AdvSkills(x, y, w, s);
                case "traits": return AdvTraits(x, y, w, s);
                case "sigil": return AdvSigil(x, y, w, s);
                case "arts": return AdvArts(x, y, w, s);
                default: return AdvExped(x, y, w, s);
            }
        }

        float AdvSkills(float x, float y, float w, SaveData s)
        {
            float u = U;
            var c = D.Classes[s.Cls];
            Ui.Text(x, y, "Each level: +10% skill power and 3% faster cooldown.", 12 * u, Ui.Dim, -1, false);
            y += 24 * u;
            for (int i = 0; i < 3; i++)
            {
                var sk = c.Skills[i];
                int lv = s.SkillLv[i];
                bool locked = s.Level < sk.Unlock;
                var cost = D.SkillUpCost(lv);
                Ui.Box(new Rect(x, y, w, 56 * u), new Color(0.1f, 0.08f, 0.06f, 0.9f), Ui.LineCol);
                Ui.Icon(sk.Id, new Rect(x + 8, y + 8, 40 * u, 40 * u), locked ? new Color(0.4f, 0.4f, 0.4f) : Color.white);
                Ui.Text(x + 58 * u, y + 5, sk.Name + "   Lv " + lv + "/" + D.SkillMax, 15 * u, locked ? Ui.Dim : Ui.Ink, -1, true, 0, true);
                Ui.Text(x + 58 * u, y + 29 * u, "power x" + D.SkillMul(lv).ToString("0.0") + "  -  cooldown " + (sk.Cd * D.SkillCdMul(lv)).ToString("0.0") + "s", 12 * u, Ui.Dim, -1, false);
                if (locked) Ui.Text(x + w - 12, y + 18 * u, "Lv " + sk.Unlock, 14 * u, Ui.Dim, 1, true);
                else if (lv < D.SkillMax && Ui.Button(new Rect(x + w - 132 * u, y + 12 * u, 122 * u, 32 * u), cost.gold + "g " + cost.steel + " steel", Btn.Normal, s.Gold >= cost.gold && s.Steel >= cost.steel, 12 * u))
                {
                    s.Gold -= cost.gold;
                    s.Steel -= cost.steel;
                    s.SkillLv[i] = lv + 1;
                    Persist();
                }
                y += 62 * u;
            }
            return y;
        }

        float AdvTraits(float x, float y, float w, SaveData s)
        {
            float u = U;
            int left = D.TraitPoints(s) - D.TraitSpent(s);
            Ui.Text(x, y, "Trait points " + left, 15 * u, Ui.Ember, -1, true, 0, true);
            if (Ui.Button(new Rect(x + w - 136 * u, y - 4, 136 * u, 28 * u), "Reset " + D.TraitResetCost(s) + "g", Btn.Normal, D.TraitSpent(s) > 0 && s.Gold >= D.TraitResetCost(s), 12 * u))
            {
                s.Gold -= D.TraitResetCost(s);
                s.Traits.Clear();
                Persist();
            }
            y += 28 * u;
            Ui.Text(x, y, "One point per level after the first. Deeper nodes need 3 points above.", 11 * u, Ui.Dim, -1, false);
            y += 22 * u;
            foreach (var br in D.Traits)
            {
                Ui.Text(x, y, br.Name, 13 * u, Ui.Ember, -1, true, 0, true);
                y += 20 * u;
                float nw = (w - 6) / 2;
                for (int i = 0; i < br.Nodes.Length; i++)
                {
                    var n = br.Nodes[i];
                    int rank = s.Traits.TryGetValue(n.Id, out var rk) ? rk : 0;
                    bool open = Items.TraitUnlocked(s, br, i);
                    float cx = x + (i % 2) * (nw + 6), cy = y + (i / 2) * 48 * u;
                    bool can = open && left > 0 && rank < D.TraitMax;
                    var r = new Rect(cx, cy, nw, 44 * u);
                    Ui.Box(r, open ? new Color(0.12f, 0.095f, 0.07f) : new Color(0.08f, 0.065f, 0.05f), rank > 0 ? Ui.Ember : can && Ui.Hover(r) ? Ui.Gold : Ui.LineCol);
                    Ui.Text(cx + 8, cy + 3, n.Name, 13 * u, open ? Ui.Ink : Ui.Dim, -1, true);
                    Ui.Text(cx + 8, cy + 23 * u, n.Text, 11 * u, Ui.Dim, -1, false);
                    Ui.Text(cx + nw - 8, cy + 3, rank + "/" + D.TraitMax, 13 * u, Ui.Ember, 1, true);
                    if (Ui.Hot(r, can))
                    {
                        s.Traits[n.Id] = rank + 1;
                        Persist();
                    }
                }
                y += 2 * 48 * u + 6;
            }
            return y;
        }

        float AdvSigil(float x, float y, float w, SaveData s)
        {
            float u = U;
            int lv = s.Sigil;
            var cost = D.SigilCost(lv);
            Ui.Box(new Rect(x, y, 86 * u, 86 * u), new Color(0.1f, 0.075f, 0.055f), Ui.Ember, 2);
            Ui.Icon(s.Cls, new Rect(x + 8, y + 8, 70 * u, 70 * u));
            Ui.Text(x + 100 * u, y + 4, "House Sigil", 22 * u, Ui.Ink, -1, true, 0, true);
            Ui.Text(x + 100 * u, y + 34 * u, "Level " + lv + " / " + D.SigilMax, 16 * u, Ui.Ember, -1, true);
            Ui.Text(x + 100 * u, y + 58 * u, "Per level: +1.5% damage, +2% health, +1 armor", 11 * u, Ui.Dim, -1, false);
            y += 100 * u;
            foreach (var b in D.SigilBoons)
            {
                Ui.Text(x, y, (lv >= b.lv ? "* " : "o ") + "Level " + b.lv + ": " + b.text, 13 * u, lv >= b.lv ? Ui.Good : Ui.Dim, -1, false);
                y += 22 * u;
            }
            y += 8;
            if (lv < D.SigilMax)
            {
                if (Ui.Button(new Rect(x, y, 310 * u, 38 * u), "Raise sigil  -  " + cost.gold + "g  -  " + cost.steel + " steel", Btn.Primary, s.Gold >= cost.gold && s.Steel >= cost.steel, 14 * u))
                {
                    s.Gold -= cost.gold;
                    s.Steel -= cost.steel;
                    s.Sigil++;
                    Persist();
                }
            }
            else Ui.Text(x, y, "Your sigil is fully raised.", 14 * u, Ui.Dim, -1, false);
            return y + 46 * u;
        }

        float AdvArts(float x, float y, float w, SaveData s)
        {
            float u = U;
            Ui.Text(x, y, "Relics from bosses (and rarely brutes). A duplicate levels it up.", 12 * u, Ui.Dim, -1, false);
            y += 24 * u;
            float sw = (w - 12) / 3;
            for (int i = 0; i < D.ArtSlots; i++)
            {
                var a = s.ArtSlots[i] != null ? D.ArtifactById(s.ArtSlots[i]) : null;
                var r = new Rect(x + i * (sw + 6), y, sw, 68 * u);
                Ui.Box(r, new Color(0.1f, 0.08f, 0.06f), a != null ? new Color(0.48f, 0.88f, 1f) : Ui.LineCol);
                if (a != null)
                {
                    Ui.Text(r.center.x, r.y + 5, a.Name, 12 * u, Ui.Ink, 0, true);
                    Ui.Text(r.center.x, r.y + 25 * u, "+" + D.ArtValue(a, s.Artifacts[a.Id]) + a.Text, 11 * u, Ui.Dim, 0, false);
                    if (Ui.Button(new Rect(r.x + 8, r.y + 42 * u, sw - 16, 22 * u), "Remove", Btn.Normal, true, 11 * u))
                    {
                        s.ArtSlots[i] = null;
                        Persist();
                    }
                }
                else Ui.Text(r.center.x, r.y + 24 * u, "Empty slot", 12 * u, Ui.Dim, 0, false);
            }
            y += 78 * u;
            foreach (var a in D.Artifacts)
            {
                Ui.Box(new Rect(x, y, w, 46 * u), new Color(0.1f, 0.08f, 0.06f, 0.9f), Ui.LineCol);
                if (!s.Artifacts.TryGetValue(a.Id, out var lv))
                {
                    Ui.Text(x + 12, y + 13 * u, "???  Not yet found", 14 * u, Ui.Dim, -1, true);
                    y += 52 * u;
                    continue;
                }
                var cost = D.ArtUpCost(lv);
                bool worn = s.ArtSlots.Contains(a.Id);
                Ui.Text(x + 12, y + 4, a.Name + "   Lv " + lv + "/" + D.ArtMax, 14 * u, Ui.Ink, -1, true, 0, true);
                Ui.Text(x + 12, y + 25 * u, "+" + D.ArtValue(a, lv) + a.Text, 11 * u, Ui.Dim, -1, false);
                if (Ui.Button(new Rect(x + w - 230 * u, y + 9 * u, 72 * u, 28 * u), worn ? "Worn" : "Equip", Btn.Normal, !worn, 12 * u))
                {
                    int slot = Array.IndexOf(s.ArtSlots, null);
                    s.ArtSlots[slot < 0 ? 0 : slot] = a.Id;
                    Persist();
                }
                if (lv < D.ArtMax && Ui.Button(new Rect(x + w - 152 * u, y + 9 * u, 144 * u, 28 * u), cost.gold + "g " + cost.steel + " steel", Btn.Normal, s.Gold >= cost.gold && s.Steel >= cost.steel, 11 * u))
                {
                    s.Gold -= cost.gold;
                    s.Steel -= cost.steel;
                    s.Artifacts[a.Id] = lv + 1;
                    Persist();
                }
                y += 52 * u;
            }
            return y;
        }

        static string FmtTime(double sec)
        {
            int t = Math.Max(0, (int)Math.Ceiling(sec));
            int h = t / 3600, m = t % 3600 / 60, s = t % 60;
            return h > 0 ? h + "h " + m.ToString("00") + "m" : m + ":" + s.ToString("00");
        }

        float AdvExped(float x, float y, float w, SaveData s)
        {
            float u = U;
            if (s.Cleared < D.ExpUnlockStage)
                return y + Ui.Text(x, y, "The Scout Lodge opens once you have cleared stage " + D.ExpUnlockStage + ": " + D.Stages[D.ExpUnlockStage - 1].Name + ".", 14 * u, Ui.Dim, -1, false, w);
            double now = Items.NowSeconds();
            var busy = new HashSet<string>(s.Expeds.SelectMany(e => e.Scouts));
            expCrew.RemoveAll(c => !s.Scouts.Any(q => q.Id == c) || busy.Contains(c));
            var route = D.RouteById(expRoute);
            var crew = s.Scouts.Where(q => expCrew.Contains(q.Id)).ToList();
            Ui.Text(x, y, "Scouts walk off for real-time errands, even while the game is closed.", 12 * u, Ui.Dim, -1, false);
            y += 24 * u;
            Ui.Text(x, y, "Out now (" + s.Expeds.Count + "/" + D.ExpSlots + ")", 13 * u, Ui.Ember, -1, true, 0, true);
            y += 22 * u;
            if (s.Expeds.Count == 0)
            {
                Ui.Text(x, y, "No expeditions out.", 13 * u, Ui.Dim, -1, false);
                y += 24 * u;
            }
            for (int i = 0; i < s.Expeds.Count; i++)
            {
                var e = s.Expeds[i];
                var r = D.RouteById(e.Route);
                double left = e.End - now;
                Ui.Box(new Rect(x, y, w, 42 * u), new Color(0.1f, 0.08f, 0.06f, 0.9f), Ui.LineCol);
                Ui.Text(x + 10, y + 3, r.Name + "  (" + e.Scouts.Count + " scouts)", 14 * u, Ui.Ink, -1, true);
                Ui.Text(x + 10, y + 23 * u, left <= 0 ? "Returned, awaiting you." : FmtTime(left) + " remaining", 12 * u, left <= 0 ? Ui.Good : Ui.Dim, -1, false);
                if (Ui.Button(new Rect(x + w - 100 * u, y + 7 * u, 90 * u, 28 * u), "Collect", left <= 0 ? Btn.Primary : Btn.Normal, left <= 0, 13 * u))
                {
                    var res = Items.ResolveExpedition(s, e);
                    s.Expeds.RemoveAt(i);
                    Say(res.Route + ": +" + res.Steel + " steel, +" + res.Gold + " gold" + (res.Found != null ? ". " + res.Found + "!" : "."));
                    Persist();
                    return y;
                }
                y += 48 * u;
            }
            Ui.Text(x, y, "Routes", 13 * u, Ui.Ember, -1, true, 0, true);
            y += 22 * u;
            float rw = (w - 12) / 3;
            for (int i = 0; i < D.Routes.Length; i++)
            {
                var r = D.Routes[i];
                string dur = r.Mins < 60 ? r.Mins + " min" : (r.Mins / 60).ToString("0.#") + "h";
                if (Ui.Button(new Rect(x + i * (rw + 6), y, rw, 46 * u), r.Name + "\n" + dur + " - " + r.Scouts + "+ scouts", expRoute == r.Id ? Btn.On : Btn.Normal, true, 12 * u))
                    expRoute = r.Id;
            }
            y += 54 * u;
            double odds = Items.ExpeditionOdds(route, crew);
            y += Ui.Text(x, y, route.Blurb + "  Artifact chance with this crew: " + Math.Round(odds * 100) + "%", 12 * u, Ui.Dim, -1, false, w) + 10 * u;
            Ui.Text(x, y, "Scouts (" + s.Scouts.Count + "/" + D.ScoutMax + ")", 13 * u, Ui.Ember, -1, true, 0, true);
            y += 22 * u;
            float sw = (w - 12) / 3;
            for (int i = 0; i < s.Scouts.Count; i++)
            {
                var c = s.Scouts[i];
                bool away = busy.Contains(c.Id);
                var r = new Rect(x + (i % 3) * (sw + 6), y + (i / 3) * 46 * u, sw, 40 * u);
                if (Ui.Button(r, c.Name + "\n" + D.Rarities[c.Rar].Name + (away ? " - away" : ""), expCrew.Contains(c.Id) ? Btn.On : Btn.Normal, !away, 12 * u))
                {
                    if (expCrew.Contains(c.Id)) expCrew.Remove(c.Id);
                    else if (expCrew.Count < 3) expCrew.Add(c.Id);
                }
            }
            y += Mathf.Ceil(s.Scouts.Count / 3f) * 46 * u + 6;
            bool full = s.Expeds.Count >= D.ExpSlots;
            bool can = !full && crew.Count >= route.Scouts && crew.Count <= 3;
            if (Ui.Button(new Rect(x, y, 210 * u, 36 * u), full ? "Expedition slots full" : crew.Count < route.Scouts ? "Pick " + route.Scouts + " scout(s)" : "Send out", Btn.Primary, can, 14 * u))
            {
                s.Expeds.Add(new Exped { Route = route.Id, Scouts = new List<string>(expCrew), Start = now, End = now + route.Mins * 60 });
                expCrew.Clear();
                Persist();
            }
            int hc = D.ScoutCost(s.Scouts.Count);
            if (Ui.Button(new Rect(x + 218 * u, y, 230 * u, 36 * u), s.Scouts.Count >= D.ScoutMax ? "Lodge is full" : "Hire a scout - " + hc + "g", Btn.Normal, s.Scouts.Count < D.ScoutMax && s.Gold >= hc, 13 * u))
            {
                s.Gold -= hc;
                var sc = Items.NewScout();
                s.Scouts.Add(sc);
                Say(sc.Name + " joins the lodge.");
                Persist();
            }
            return y + 44 * u;
        }

        // --- shop tab
        float TabShop(float x, float y, float w, SaveData s, HeroStats hero)
        {
            float u = U;
            Ui.Icon("potion", new Rect(x, y, 64 * u, 64 * u));
            Ui.Text(x + 76 * u, y + 2, "Hedge-Apothecary", 20 * u, Ui.Ink, -1, true, 0, true);
            Ui.Text(x + 76 * u, y + 32 * u, "Red tonic. Heals half your health. Carry up to " + D.MaxPotions + ".", 13 * u, new Color(0.84f, 0.77f, 0.62f), -1, false, w - 80 * u);
            y += 86 * u;
            Ui.Text(x, y, "Potions " + s.Potions + " / " + D.MaxPotions, 16 * u, Ui.Ink, -1, true, 0, true);
            y += 30 * u;
            bool full = s.Potions >= D.MaxPotions;
            int toFull = D.MaxPotions - s.Potions;
            if (Ui.Button(new Rect(x, y, 196 * u, 36 * u), "Buy 1  -  " + D.PotionPrice + "g", Btn.Primary, s.Gold >= D.PotionPrice && !full, 14 * u)) Buy(1);
            if (Ui.Button(new Rect(x + 204 * u, y, 226 * u, 36 * u), toFull > 1 ? "Fill up (" + toFull + ") - " + toFull * D.PotionPrice + "g" : "Fill up", Btn.Normal, toFull > 1 && s.Gold >= D.PotionPrice, 14 * u)) Buy(toFull);
            y += 58 * u;
            Ui.Text(x, y, "Bag slots " + s.BagSize + " / " + D.BagMax, 16 * u, Ui.Ink, -1, true, 0, true);
            y += 30 * u;
            int cost = D.BagExpandCost(s.BagSize);
            if (Ui.Button(new Rect(x, y, 310 * u, 36 * u), s.BagSize >= D.BagMax ? "Bag is full size" : "+" + D.BagExpand + " slots  -  " + cost + "g", Btn.Normal, s.BagSize < D.BagMax && s.Gold >= cost, 14 * u))
            {
                s.Gold -= cost;
                s.BagSize = Math.Min(D.BagMax, s.BagSize + D.BagExpand);
                Persist();
            }
            y += 54 * u;
            Ui.Text(x, y, "Sell or dismantle spare equipment from the Bag.", 13 * u, Ui.Dim, -1, false);
            return y + 30 * u;
        }

        void Buy(int n)
        {
            var s = S;
            n = Math.Min(n, Math.Min(D.MaxPotions - s.Potions, s.Gold / D.PotionPrice));
            if (n <= 0) return;
            s.Potions += n;
            s.Gold -= n * D.PotionPrice;
            Persist();
        }

        // ================================================================ RESULT
        public void Result(StageResult res)
        {
            float W = Screen.width, H = Screen.height, u = U;
            Ui.Rect(new Rect(0, 0, W, H), new Color(0.03f, 0.02f, 0.015f, 0.72f));
            var st = res.Stage;
            var run = res.Run;
            var s = S;
            bool vault = st.Id == "vault";
            bool ending = res.Won && st.Id == "6" && run.FirstClear;
            float bw = Mathf.Min(580 * u, W - 40), bh = Mathf.Min(H - 40, 640 * u);
            var r = new Rect((W - bw) / 2, (H - bh) / 2, bw, bh);
            Ui.Panel(r);
            Ui.Block(r);
            float y = r.y + 20 * u;
            string title = res.Won && vault ? "Floor " + st.Floor + " cleared" : ending ? "The Heir is Free" : res.Won ? "Victory" : "Defeated";
            Ui.Text(W / 2, y, title, 38 * u, res.Won ? Ui.Ember : Ui.Bad, 0, true, 0, true);
            y += 52 * u;
            Ui.Text(W / 2, y, st.Name, 14 * u, Ui.Dim, 0, false);
            y += 28 * u;
            if (ending) y += Ui.Text(W / 2, y, D.EndingText, 14 * u, new Color(0.88f, 0.8f, 0.64f), 0, false, bw - 60) + 12 * u;
            var stats = new List<(string, string)> { (run.Kills.ToString(), "Foes slain"), (run.Xp.ToString(), "XP"), (run.Gold.ToString(), "Gold") };
            if (run.Steel > 0) stats.Add((run.Steel.ToString(), "Steel"));
            if (res.Won && run.Bonus > 0) stats.Add(("+" + run.Bonus, "Clear bonus"));
            float cw = (bw - 40) / stats.Count;
            for (int i = 0; i < stats.Count; i++)
            {
                Ui.Text(r.x + 20 + cw * (i + 0.5f), y, stats[i].Item1, 26 * u, Ui.Ink, 0, true, 0, true);
                Ui.Text(r.x + 20 + cw * (i + 0.5f), y + 34 * u, stats[i].Item2.ToUpper(), 10 * u, Ui.Dim, 0, false);
            }
            y += 64 * u;
            if (run.Levels > 0)
            {
                Ui.Text(W / 2, y, "Level " + run.StartLevel + " -> " + s.Level, 16 * u, Ui.Ember, 0, true, 0, true);
                y += 26 * u;
            }
            if (vault)
            {
                Ui.Text(W / 2, y, "Best floor " + s.VaultBest, 14 * u, Ui.Ember, 0, true);
                y += 24 * u;
            }
            foreach (var a in run.Artifacts)
            {
                Ui.Text(W / 2, y, a, 14 * u, new Color(0.48f, 0.88f, 1f), 0, true);
                y += 22 * u;
            }
            if (run.Items.Count > 0)
            {
                Ui.Text(W / 2, y, "LOOT", 11 * u, Ui.Dim, 0, false);
                y += 20 * u;
                foreach (var it in run.Items.Take(7))
                {
                    Ui.Icon(SlotIcon(it), new Rect(r.x + 40, y - 2, 22 * u, 22 * u));
                    Ui.Text(r.x + 70 * u, y, it.Name, 14 * u, Ui.RarityColor(it.Rarity), -1, true);
                    y += 24 * u;
                }
                if (run.Items.Count > 7) Ui.Text(W / 2, y, "...and " + (run.Items.Count - 7) + " more", 12 * u, Ui.Dim, 0, false);
            }
            float by = r.yMax - 58 * u;
            if (res.Won && vault)
            {
                if (Ui.Button(new Rect(W / 2 - 250 * u, by, 240 * u, 42 * u), "Descend to floor " + (st.Floor + 1), Btn.Primary, true, 15 * u)) app.March("vault", st.Floor + 1);
                if (Ui.Button(new Rect(W / 2 + 10 * u, by, 240 * u, 42 * u), "Return to camp", Btn.Normal, true, 15 * u)) app.ToCamp();
            }
            else if (!res.Won)
            {
                if (Ui.Button(new Rect(W / 2 - 250 * u, by, 240 * u, 42 * u), "Try again", Btn.Primary, true, 15 * u)) app.March(st.Id, vault ? st.Floor : 0);
                if (Ui.Button(new Rect(W / 2 + 10 * u, by, 240 * u, 42 * u), "Return to camp", Btn.Normal, true, 15 * u)) app.ToCamp();
            }
            else if (Ui.Button(new Rect(W / 2 - 130 * u, by, 260 * u, 42 * u), "Return to camp", Btn.Primary, true, 16 * u)) app.ToCamp();
        }

        // ================================================================ PAUSE
        public void Pause()
        {
            float W = Screen.width, H = Screen.height, u = U;
            Ui.Rect(new Rect(0, 0, W, H), new Color(0.03f, 0.02f, 0.015f, 0.7f));
            float bw = 380 * u, bh = 350 * u;
            var r = new Rect((W - bw) / 2, (H - bh) / 2, bw, bh);
            Ui.Panel(r);
            Ui.Block(r);
            Ui.Text(W / 2, r.y + 18 * u, "Paused", 34 * u, Ui.Ink, 0, true, 0, true);
            if (Ui.Button(new Rect(r.x + 40 * u, r.y + 80 * u, bw - 80 * u, 46 * u), "Resume", Btn.Primary, true, 18 * u)) app.Resume();
            Ui.Text(r.x + 40 * u, r.y + 152 * u, "Graphics", 15 * u, Ui.Dim, -1, false);
            string q = app.Quality;
            if (Ui.Button(new Rect(r.x + 140 * u, r.y + 144 * u, 86 * u, 36 * u), "Low", q == "low" ? Btn.On : Btn.Normal, true, 14 * u)) app.SetQuality("low");
            if (Ui.Button(new Rect(r.x + 232 * u, r.y + 144 * u, 86 * u, 36 * u), "High", q == "high" ? Btn.On : Btn.Normal, true, 14 * u)) app.SetQuality("high");
            if (Ui.Button(new Rect(r.x + 40 * u, r.y + 208 * u, bw - 80 * u, 42 * u), "Abandon stage", Btn.Normal, true, 15 * u)) app.QuitStage();
            Ui.Text(W / 2, r.y + 290 * u, "Esc to resume", 12 * u, Ui.Dim, 0, false);
        }
    }
}
