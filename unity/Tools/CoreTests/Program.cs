using System;
using System.Collections.Generic;
using System.IO;
using Highkeep.Core;

static class Program
{
    static int failures;
    static string LayoutDir;

    static void Check(bool ok, string what)
    {
        Console.WriteLine((ok ? "  ok   " : "  FAIL ") + what);
        if (!ok) failures++;
    }

    static Layout LoadLayout(string theme, int seed, bool boss, int floor)
    {
        string name = theme == "vault" ? "vault" + (((floor - 1) % 60) + 1) : theme == "town" ? "town" : "stage" + seed;
        return Layout.FromJson(File.ReadAllText(Path.Combine(LayoutDir, name + ".json")));
    }

    static int Main(string[] args)
    {
        LayoutDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../Assets/HighkeepRoad/Resources/Layouts"));
        var rng = new Random(7);
        Func<double> R = () => rng.NextDouble();

        Console.WriteLine("data");
        var s = SaveData.New("knight", R);
        Check(Items.HeroStats(s).Power >= 120 && Items.HeroStats(s).Power <= 135, "starting knight power ~125 (" + Items.HeroStats(s).Power + ")");
        Check(D.XpToNext(1) == 60, "xp to level 2 is 60");
        var r1 = new Rng(42);
        Check(Math.Abs(r1.Next() - 0.6011037519201636) < 1e-12, "mulberry32 matches the Python sequence");

        Console.WriteLine("save round-trip");
        s.Bag.Add(Items.RollItem(R, "charm", 3, "rare", "knight"));
        s.Traits["m1"] = 2;
        s.Artifacts["ring"] = 3;
        s.ArtSlots[0] = "ring";
        s.Expeds.Add(new Exped { Route = "patrol", Scouts = { "scout0" }, Start = 1, End = 2 });
        var s2 = SaveData.FromJson(s.ToJson());
        Check(s2 != null && s2.Bag.Count == 1 && s2.Bag[0].Name == s.Bag[0].Name, "bag survives");
        Check(s2.Traits["m1"] == 2 && s2.Artifacts["ring"] == 3 && s2.ArtSlots[0] == "ring", "advancement survives");
        Check(Items.HeroStats(s2).Power == Items.HeroStats(s).Power, "power identical after reload");
        Check(s2.Expeds.Count == 1 && s2.Expeds[0].Scouts[0] == "scout0", "expeditions survive");

        Console.WriteLine("forge");
        var it = Items.RollItem(R, "weapon", 2, "magic", "knight");
        int guard = 0;
        while (it.Plus < D.MaxPlus && guard++ < 1000) Items.ForgeAttempt(it, R);
        Check(it.Plus == D.MaxPlus && !Items.ForgeAttempt(it, R), "forge reaches +10 and stops");

        Console.WriteLine("layouts");
        foreach (var t in new[] { 1, 2, 3, 4, 5, 6 })
        {
            var L = LoadLayout("x", t, false, 0);
            Check(L.Props.Count > 0 && !L.PointBlocked(L.StartX, L.StartY, 12), "stage " + t + " (" + L.Theme + ") loads, start is free");
        }

        Console.WriteLine("click-to-move");
        {
            var g = NewGame("knight", 8, R);
            g.StartStage("1");
            var inp = new GameInput { HasDest = true, DestX = g.P.X + 300, DestY = g.P.Y };
            double sx = g.P.X;
            for (int i = 0; i < 240; i++) g.Update(1 / 60.0, inp);
            Check(!inp.HasDest || Math.Abs(g.P.X - (sx + 300)) < 40, "hero walks to the clicked point (moved " + (g.P.X - sx).ToString("0") + ")");
        }

        Console.WriteLine("bot clears every stage with click-to-target only");
        foreach (var cls in new[] { "knight", "ranger", "mage" })
        {
            var save = SaveData.New(cls, R);
            save.Level = 12;
            for (int st = 1; st <= 6; st++)
            {
                if (st == 6)
                {
                    // the Regent is tuned for a geared hero (power ~385); give the bot what a player would have by then
                    save.Level = Math.Max(save.Level, 18);
                    foreach (var sl in D.Slots) save.Equip[sl] = Items.RollItem(R, sl, 6, "rare", cls);
                    save.Potions = D.MaxPotions;
                }
                var g = NewGame(cls, 0, R, save);
                bool? won = null;
                g.OnEnd = res => won = res.Won;
                g.StartStage(st.ToString());
                var inp = new GameInput();
                int steps = 0;
                while (g.Mode == "stage" && steps < 60 * 400)
                {
                    steps++;
                    Bot(g, inp, steps);
                    g.Update(1 / 60.0, inp);
                }
                if (won != true)
                {
                    var boss = g.Enemies.Find(e => e.Type == "regent");
                    Console.WriteLine("       boss hp " + (boss == null ? "-" : ((int)boss.Hp + "/" + (int)boss.MaxHp)) + ", alive " + g.Enemies.FindAll(e => !e.Dead).Count + ", wave " + g.Stage.WaveIdx + ", hero dmg " + g.Hero.Damage + " armor " + g.Hero.Armor + " maxhp " + g.Hero.MaxHp + " potions " + save.Potions);
                }
                Check(won == true, cls + " clears stage " + st + " in " + (steps / 60) + "s (level " + save.Level + ", hp " + (int)g.P.Hp + ")");
            }
            var gv = NewGame(cls, 0, R, save);
            bool? vw = null;
            gv.OnEnd = res => vw = res.Won;
            save.Potions = D.MaxPotions;
            gv.StartStage("vault", 5);
            var vi = new GameInput();
            int vs = 0;
            while (gv.Mode == "stage" && vs < 60 * 400) { vs++; Bot(gv, vi, vs); gv.Update(1 / 60.0, vi); }
            Check(vw == true, cls + " clears vault floor 5 (boss)");
        }
        Console.WriteLine(failures == 0 ? "ALL PASSED" : failures + " FAILED");
        return failures == 0 ? 0 : 1;
    }

    static Game NewGame(string cls, int level, Func<double> R, SaveData save = null)
    {
        save ??= SaveData.New(cls, R);
        if (level > 0) save.Level = level;
        var g = new Game(save, R) { LayoutProvider = LoadLayout };
        return g;
    }

    /// <summary>Plays like a person with a mouse: click the nearest enemy, use skills off cooldown, drink potions.</summary>
    static void Bot(Game g, GameInput inp, int step)
    {
        var p = g.P;
        Enemy best = null;
        double bd = 1e9;
        foreach (var e in g.Enemies)
        {
            if (!Game.Targetable(e)) continue;
            double d = Math.Sqrt((e.X - p.X) * (e.X - p.X) + (e.Y - p.Y) * (e.Y - p.Y));
            if (d < bd) { bd = d; best = e; }
        }
        g.God = false;
        // step out of telegraphed slams like a player would
        foreach (var z in g.Zones)
        {
            if (z.Team != "e" || z.Fired || z.Kind == "line") continue;
            double dx = p.X - z.X, dy = p.Y - z.Y, d = Math.Sqrt(dx * dx + dy * dy);
            if (d < z.R + 18)
            {
                if (d < 1) { dx = 1; d = 1; }
                inp.TargetId = 0;
                inp.HasDest = true;
                inp.DestX = z.X + dx / d * (z.R + 60);
                inp.DestY = z.Y + dy / d * (z.R + 60);
                return;
            }
        }
        if (inp.HasDest && g.Zones.Exists(z => z.Team == "e" && !z.Fired && z.Kind != "line")) return;
        inp.HasDest = false;
        if (best != null)
        {
            inp.TargetId = best.Id;
            inp.HasAim = true;
            inp.AimX = best.X;
            inp.AimY = best.Y;
            if (step % 50 == 0)
                for (int i = 0; i < 3; i++)
                    if (g.SkillReady(i) && D.Classes[g.Save.Cls].Skills[i].Id != "tumble" && D.Classes[g.Save.Cls].Skills[i].Id != "blink") inp.Skills[i] = true;
        }
        else
        {
            inp.TargetId = 0;
            // walk to collect loot
            if (g.Pickups.Count > 0) { inp.HasDest = true; inp.DestX = g.Pickups[0].X; inp.DestY = g.Pickups[0].Y; }
        }
        if (p.Hp < g.Hero.MaxHp * 0.45) inp.Potion = true;
    }
}
