// Game state and simulation: stage flow, player, enemies, combat, loot. Pure logic (no graphics).
// World coordinates: x east, y SOUTH (towards the camera). Angles are atan2(dy, dx).
//
// Movement is Kingsroad-style: click the ground to walk there (or hold the button to keep walking towards the
// cursor), click an enemy to target it - the hero walks into range and keeps attacking until it dies.
// WASD still works and overrides click movement.
using System;
using System.Collections.Generic;

namespace Highkeep.Core
{
    public sealed class GameInput
    {
        public double MoveX, MoveY;               // keyboard direction (-1..1)
        public bool HasDest;                       // click-to-move destination
        public double DestX, DestY;
        public int TargetId;                       // clicked enemy (0 = none)
        public bool HasAim;                        // cursor on the ground, used for skills and forced attacks
        public double AimX, AimY;
        public bool Attack;                        // attack in place towards the aim point (Space / Shift-click)
        public readonly bool[] Skills = new bool[3];
        public bool Potion;
    }

    public sealed class Dash
    {
        public double T, Dur, Vx, Vy;
        public string Kind;
        public HashSet<int> Hit = new HashSet<int>();
    }

    public sealed class Spin { public double T, Tick, Mul; }

    public sealed class Player
    {
        public double X, Y, R = 12, Face, Hp, Mp, Vx, Vy, AtkCd, AtkT = -1, AtkDur = 0.3, HitT, Invuln, Grace, DmgBuff, PotCd, Walk, DeadT, SkillT, MoveAng;
        public double[] Cd = new double[3];
        public bool Moving, Dead;
        public Dash Dash;
        public Spin Spin;
        public string SkillAnim;
    }

    public sealed class Enemy
    {
        public int Id;
        public string Type, State = "chase", Anim = "idle";
        public EnemyDef D;
        public double X, Y, R, Face, Vx, Vy, Hp, MaxHp, Dmg, Speed, T, Cd, SpawnT, HitT, SlowT, StunT, Walk, AtkT = -1, DeadT, StrafeT, Wob;
        public double SteerT, StuckT, Sx = 1e5, Sy = 1e5, RAng, ChargeAng, Dur = 1, SummonCd;
        public int Strafe = 1, Steer, ChargePhase, Rings;
        public bool Dead, Flying, Enraged, Summoned, HitDone;
    }

    public sealed class Projectile
    {
        public string Team, Kind;
        public double X, Y, Vx, Vy, Ang, R, Dmg, Life, Splash, T;
        public int Pierce;
        public bool Crit;
        public HashSet<int> Hit = new HashSet<int>();
    }

    public sealed class Zone
    {
        public string Kind, Team;
        public double X, Y, R, T, Delay, Dur, Tick, Dmg, X2, Y2, W;
        public bool Fired, Crit;
    }

    public sealed class Pickup
    {
        public string Kind;      // gold | potion | item
        public Item Item;
        public int Amount;
        public double X, Y, Vx, Vy, T;
        public bool Magnet;
    }

    public sealed class Fx
    {
        public string Type;
        public double X, Y, R, T, Dur, Ang, Range, Arc;
        public float CR = 1, CG = 1, CB = 1;
    }

    public sealed class FloatText
    {
        public double X, Y, Z = 30, T, Dur;
        public string Text;
        public float CR = 1, CG = 1, CB = 1;
        public int Size;
        public bool Crit;
    }

    public sealed class Banner { public string Text, Sub; public double T, Dur; }

    public sealed class StageState
    {
        public string Id, Name, State = "intro";
        public StageDef Def;
        public int Floor, WaveIdx = -1;
        public List<List<(string type, int n)>> Waves;
        public double T = 2.2;
        public bool Boss;
    }

    public sealed class RunStats
    {
        public int Kills, Steel, Gold, Xp, Levels, Potions, StartLevel, Bonus;
        public bool FirstClear;
        public List<Item> Items = new List<Item>();
        public List<string> Artifacts = new List<string>();
    }

    public sealed class StageResult
    {
        public bool Won;
        public StageState Stage;
        public RunStats Run;
    }

    public sealed class AimInfo
    {
        public double X, Y, Ang;
        public Enemy Target;
    }

    public sealed class Game
    {
        const double TAU = Math.PI * 2;

        public SaveData Save;
        public HeroStats Hero;
        public string Mode = "idle";      // idle | stage | ended
        public bool Paused, God;
        public double Time, Shake, MpFlash, SkillMulNow = 1;
        public Player P;
        public readonly List<Enemy> Enemies = new List<Enemy>();
        public readonly List<Projectile> Proj = new List<Projectile>();
        public readonly List<Zone> Zones = new List<Zone>();
        public readonly List<Pickup> Pickups = new List<Pickup>();
        public readonly List<Fx> Effects = new List<Fx>();
        public readonly List<FloatText> Texts = new List<FloatText>();
        readonly List<(double t, string type)> spawnQ = new List<(double, string)>();
        public Layout L;
        public StageState Stage;
        public RunStats Run;
        public Banner Banner;
        public Dictionary<string, double> Diff;
        int nextId = 1;

        public Func<double> R;
        public Func<string, int, bool, int, Layout> LayoutProvider;     // (theme, seed, boss, floor) -> layout
        public Action<StageResult> OnEnd = r => { };
        public Action<int, SkillDef> OnLevelUp = (lv, sk) => { };
        /// <summary>Called whenever a melee swing, cast or shot happens: (kind) so the view can play sounds/animations.</summary>
        public Action<string> OnAction = k => { };

        public Game(SaveData save, Func<double> rng = null)
        {
            Save = save;
            R = rng ?? Items.DefaultRng;
            if (save != null) Hero = Items.HeroStats(save);
        }

        double Rand(double a, double b) => a + R() * (b - a);
        static double Dist(double ax, double ay, double bx, double by) => Math.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
        static double Hyp(double x, double y) => Math.Sqrt(x * x + y * y);

        static double AngDiff(double a, double b)
        {
            double d = ((a - b) % TAU + TAU) % TAU;
            if (d > Math.PI) d = TAU - d;
            return Math.Abs(d);
        }

        static double Clamp(double v, double a, double b) => Math.Max(a, Math.Min(b, v));

        // ------------------------------------------------------------ setup
        public void StartStage(string sid, int floor = 0)
        {
            var d = D.StageById(sid);
            bool vault = sid == "vault";
            bool boss = vault ? floor % 5 == 0 : sid == "6";
            L = LayoutProvider(d.Theme, vault ? 1000 + floor : d.Num, vault && boss, floor);
            Hero = Items.HeroStats(Save);
            double sIdx = vault ? 5 + floor * 0.35 : d.Num - 1;
            Diff = new Dictionary<string, double>
            {
                ["hp"] = 1 + 0.5 * sIdx, ["dmg"] = 1 + 0.28 * sIdx, ["xp"] = 1 + 0.3 * sIdx, ["gold"] = 1 + 0.3 * sIdx, ["s"] = sIdx,
            };
            Mode = "stage";
            Paused = false;
            Enemies.Clear(); Proj.Clear(); Zones.Clear(); Pickups.Clear(); Effects.Clear(); Texts.Clear(); spawnQ.Clear();
            Shake = 0;
            Time = 0;
            Run = new RunStats { StartLevel = Save.Level };
            P = new Player { X = L.StartX, Y = L.StartY, Hp = Hero.MaxHp, Mp = Hero.MaxMp, Face = -Math.PI / 2 };
            var waves = vault ? VaultWaves(floor, boss) : d.Waves;
            string name = vault ? d.Name + " - Floor " + floor : d.Name;
            Stage = new StageState { Id = sid, Def = d, Floor = floor, Waves = waves, Boss = boss, Name = name };
            string sub = vault ? (boss ? "A warlord stirs below" : "Descend") : "Suggested power " + d.Power;
            SetBanner(name, sub, 2.2);
        }

        public void SetBanner(string text, string sub = "", double t = 2.0) => Banner = new Banner { Text = text, Sub = sub, T = t, Dur = t };

        void StartWave()
        {
            var st = Stage;
            st.WaveIdx++;
            st.State = "fight";
            var wave = st.Waves[st.WaveIdx];
            bool isBoss = wave.Exists(w => w.type == "regent");
            SetBanner(isBoss ? "The Ashen Regent" : "Wave " + (st.WaveIdx + 1) + " / " + st.Waves.Count, isBoss ? "Boss" : "", 1.6);
            var lst = new List<string>();
            foreach (var (t, n) in wave) for (int i = 0; i < n; i++) lst.Add(t);
            for (int i = lst.Count - 1; i > 0; i--)
            {
                int j = (int)(R() * (i + 1));
                (lst[i], lst[j]) = (lst[j], lst[i]);
            }
            double tt = 0;
            foreach (var typ in lst)
            {
                spawnQ.Add((tt, typ));
                tt += typ == "regent" ? 0 : 0.18;
            }
        }

        // ------------------------------------------------------------ helpers
        int SideOf(double x)
        {
            if (!L.HasRiver) return 0;
            return x < L.RiverX0 ? -1 : x > L.RiverX1 ? 1 : 0;
        }

        (double, double) SpawnPoint(string typ)
        {
            var b = L.B;
            int psd = SideOf(P.X);
            for (int i = 0; i < 60; i++)
            {
                double a = R() * TAU;
                double d = typ == "regent" ? 330 : Rand(340, 560);
                double x = P.X + Math.Cos(a) * d, y = P.Y + Math.Sin(a) * d;
                if (x < b.X0 + 30 || x > b.X1 - 30 || y < b.Y0 + 30 || y > b.Y1 - 30) continue;
                if (L.HasRiver && (SideOf(x) == 0 || (psd != 0 && SideOf(x) != psd))) continue;
                if (L.PointBlocked(x, y, 22)) continue;
                return (x, y);
            }
            for (int i = 0; i < 80; i++)
            {
                double x = Rand(b.X0 + 40, b.X1 - 40), y = Rand(b.Y0 + 40, b.Y1 - 40);
                if (!L.PointBlocked(x, y, 22) && Dist(x, y, P.X, P.Y) > 250) return (x, y);
            }
            return (L.StartX + 200, L.StartY);
        }

        public Enemy MakeEnemy(string typ, double x, double y, bool noSpawn = false)
        {
            var d = D.Enemies[typ];
            var e = new Enemy
            {
                Id = nextId++, Type = typ, D = d, X = x, Y = y, R = d.R, Face = R() * TAU,
                MaxHp = Math.Round(d.Hp * Diff["hp"]), Dmg = d.Dmg * Diff["dmg"],
                Speed = d.Speed * (d.Boss ? 1 : 1 + Diff["s"] * 0.015), Cd = Rand(0.4, 1.4),
                SpawnT = noSpawn ? 0 : 0.7, Walk = R() * 6, Strafe = R() < 0.5 ? 1 : -1, StrafeT = Rand(1, 2.5), Wob = R() * 6,
                Flying = d.Flying,
            };
            e.Hp = e.MaxHp;
            if (typ == "regent")
            {
                e.State = "idle";
                e.Cd = 1.5;
                e.SummonCd = 6;
            }
            Enemies.Add(e);
            return e;
        }

        public Enemy EnemyById(int id)
        {
            if (id == 0) return null;
            foreach (var e in Enemies) if (e.Id == id) return e;
            return null;
        }

        public static bool Targetable(Enemy e) => e != null && !e.Dead && e.SpawnT <= 0.3;

        public AimInfo GetAim(GameInput inp)
        {
            var p = P;
            var tgt = EnemyById(inp.TargetId);
            if (Targetable(tgt))
                return new AimInfo { X = tgt.X, Y = tgt.Y, Ang = Math.Atan2(tgt.Y - p.Y, tgt.X - p.X), Target = tgt };
            double ax = inp.HasAim ? inp.AimX : p.X + Math.Cos(p.Face) * 100;
            double ay = inp.HasAim ? inp.AimY : p.Y + Math.Sin(p.Face) * 100;
            double dx = ax - p.X, dy = ay - p.Y;
            return new AimInfo { X = ax, Y = ay, Ang = Hyp(dx, dy) > 4 ? Math.Atan2(dy, dx) : p.Face };
        }

        void Text(double x, double y, string text, float r, float g, float b, int size = 14, bool crit = false)
        {
            if (Texts.Count > 70) Texts.RemoveAt(0);
            Texts.Add(new FloatText { X = x + Rand(-6, 6), Y = y, Text = text, CR = r, CG = g, CB = b, Size = size, Crit = crit, Dur = crit ? 1.0 : 0.8 });
        }

        void AddFx(string type, double x, double y, double dur, float r, float g, float b, double rad = 0, double ang = 0, double range = 0, double arc = 0)
        {
            if (Effects.Count < 120)
                Effects.Add(new Fx { Type = type, X = x, Y = y, Dur = dur, CR = r, CG = g, CB = b, R = rad, Ang = ang, Range = range, Arc = arc });
        }

        (double, bool) PlayerDmg()
        {
            bool crit = R() * 100 < Hero.Crit;
            double d = Hero.Damage * Rand(0.92, 1.08) * (P.DmgBuff > 0 ? 1.5 : 1) * SkillMulNow;
            if (crit) d *= 1.75;
            return (d, crit);
        }

        public void HurtEnemy(Enemy e, double amount, bool crit, double kbx = 0, double kby = 0, double kb = 0, double stun = 0)
        {
            if (e.Dead || e.SpawnT > 0) return;
            int dmg = Math.Max(1, (int)Math.Round(amount));
            e.Hp -= dmg;
            e.HitT = 0.16;
            if (kb != 0)
            {
                double k = e.Type == "brute" ? 0.4 : e.D.Boss ? 0.1 : 1;
                e.Vx += kbx * kb * k;
                e.Vy += kby * kb * k;
            }
            if (stun > 0 && !e.D.Boss) e.StunT = Math.Max(e.StunT, stun);
            if (crit) Text(e.X, e.Y - e.R, dmg.ToString(), 1f, 0.82f, 0.29f, 20, true);
            else Text(e.X, e.Y - e.R, dmg.ToString(), 1, 1, 1, 14);
            if (e.Hp <= 0) KillEnemy(e);
        }

        public bool HurtPlayer(double raw, double srcx, double srcy, bool unblockable = false)
        {
            var p = P;
            if (p.Dead || p.Invuln > 0 || (p.Grace > 0 && !unblockable)) return false;
            int dmg = Math.Max(1, (int)Math.Round(raw * Items.ArmorMul(Hero.Armor)));
            if (God) dmg = 0;
            p.Hp -= dmg;
            p.HitT = 0.22;
            p.Grace = 0.35;
            Shake = Math.Min(14, Shake + 4 + dmg * 0.1);
            Text(p.X, p.Y - 14, dmg.ToString(), 1f, 0.35f, 0.29f, 16);
            double a = Math.Atan2(p.Y - srcy, p.X - srcx);
            p.Vx += Math.Cos(a) * 120;
            p.Vy += Math.Sin(a) * 120;
            if (p.Hp <= 0)
            {
                p.Hp = 0;
                p.Dead = true;
                p.DeadT = 0;
                Stage.State = "defeat";
                Stage.T = 2.2;
                SetBanner("You have fallen", "", 2.2);
            }
            return true;
        }

        // ------------------------------------------------------------ loot
        void DropItem(double x, double y, double bonus, string minRarity = null)
        {
            int ilvl = Math.Max(1, (int)Math.Round(1 + Diff["s"]));
            string rar = Items.RollRarity(R, bonus + Diff["s"] * 0.05);
            var order = new List<string> { "common", "magic", "rare", "heroic" };
            if (minRarity != null && order.IndexOf(rar) < order.IndexOf(minRarity)) rar = minRarity;
            double t = R();
            string slot = t < 0.38 ? "weapon" : t < 0.76 ? "armor" : "charm";
            var item = Items.RollItem(R, slot, ilvl, rar, Save.Cls);
            Pickups.Add(new Pickup { Kind = "item", Item = item, X = x + Rand(-14, 14), Y = y + Rand(-14, 14), Vx = Rand(-40, 40), Vy = Rand(-40, 40) });
        }

        public void KillEnemy(Enemy e, bool silent = false)
        {
            if (e.Dead) return;
            e.Dead = true;
            e.DeadT = 0;
            e.State = "dead";
            if (silent) return;
            var run = Run;
            var d = e.D;
            run.Kills++;
            int xp = (int)Math.Round(d.Xp * Diff["xp"] * (1 + Hero.XpPct / 100));
            run.Xp += xp;
            int lv = Items.AddXp(Save, xp);
            Text(e.X, e.Y - e.R - 16, "+" + xp + " xp", 0.6f, 0.82f, 1f, 11);
            if (lv > 0) LevelUp(lv);
            int steel = d.Boss ? 8 + (int)Diff["s"] : e.Type == "brute" ? 2 : R() < 0.1 ? 1 : 0;
            if (steel > 0)
            {
                Save.Steel += steel;
                run.Steel += steel;
                Text(e.X, e.Y - e.R - 28, "+" + steel + " steel", 0.62f, 0.71f, 0.78f, 12);
            }
            if (d.Boss || (e.Type == "brute" && R() < 0.04))
            {
                string msg = Items.GrantArtifact(Save, R);
                run.Artifacts.Add(msg);
                Text(e.X, e.Y - 50, msg, 0.48f, 0.88f, 1f, 15, true);
                SetBanner("Artifact found", msg, 2.4);
            }
            int gold = (int)Math.Round(Rand(d.Gold0, d.Gold1) * Diff["gold"] * (1 + Hero.GoldPct / 100));
            Pickups.Add(new Pickup { Kind = "gold", Amount = gold, X = e.X, Y = e.Y, Vx = Rand(-50, 50), Vy = Rand(-50, 50) });
            if (d.Boss)
            {
                foreach (var o in Enemies) if (!o.Dead && o != e) KillEnemy(o, true);
                DropItem(e.X, e.Y, 1.0, "rare");
                DropItem(e.X, e.Y, 1.0, "magic");
                DropItem(e.X, e.Y, 0.8, "magic");
                Pickups.Add(new Pickup { Kind = "potion", X = e.X + 20, Y = e.Y, Vx = 30, Vy = 20 });
                Shake = 12;
            }
            else
            {
                if (R() < d.Drop) DropItem(e.X, e.Y, e.Type == "brute" ? 0.35 : 0);
                if (R() < 0.05) Pickups.Add(new Pickup { Kind = "potion", X = e.X, Y = e.Y, Vx = Rand(-40, 40), Vy = Rand(-40, 40) });
            }
        }

        void LevelUp(int n)
        {
            var p = P;
            var old = Hero;
            Run.Levels += n;
            Hero = Items.HeroStats(Save);
            p.Hp = Math.Min(Hero.MaxHp, p.Hp + (Hero.MaxHp - old.MaxHp) + Hero.MaxHp * 0.3);
            p.Mp = Hero.MaxMp;
            AddFx("ring", p.X, p.Y, 0.8, 1f, 0.89f, 0.54f, 90);
            Text(p.X, p.Y - 40, "LEVEL " + Save.Level + "!", 1f, 0.89f, 0.54f, 22, true);
            SkillDef sk = null;
            foreach (var s in D.Classes[Save.Cls].Skills) if (s.Unlock == Save.Level) sk = s;
            SetBanner("Level " + Save.Level, sk != null ? "Skill unlocked: " + sk.Name : "", 2);
            OnLevelUp(Save.Level, sk);
        }

        void Collect(Pickup pk)
        {
            var s = Save;
            var run = Run;
            if (pk.Kind == "gold")
            {
                s.Gold += pk.Amount;
                run.Gold += pk.Amount;
                Text(P.X, P.Y - 20, "+" + pk.Amount + "g", 1f, 0.82f, 0.29f, 12);
            }
            else if (pk.Kind == "potion")
            {
                if (s.Potions >= D.MaxPotions)
                {
                    s.Gold += 15;
                    run.Gold += 15;
                    Text(P.X, P.Y - 20, "+15g", 1f, 0.82f, 0.29f, 12);
                }
                else
                {
                    s.Potions++;
                    run.Potions++;
                    Text(P.X, P.Y - 20, "Potion", 1f, 0.56f, 0.63f, 13);
                }
            }
            else
            {
                if (s.Bag.Count >= s.BagSize)
                {
                    int v = (int)Math.Round(5 * pk.Item.Ilvl * Items.RarityOf(pk.Item.Rarity).Sell);
                    s.Gold += v;
                    run.Gold += v;
                    Text(P.X, P.Y - 20, "Bag full: sold for " + v + "g", 1f, 0.82f, 0.29f, 11);
                }
                else
                {
                    s.Bag.Add(pk.Item);
                    run.Items.Add(pk.Item);
                    var rc = Items.RarityOf(pk.Item.Rarity);
                    Text(P.X, P.Y - 28, pk.Item.Name, rc.R, rc.G, rc.B, 13);
                }
            }
        }

        // ------------------------------------------------------------ skills
        List<Enemy> InCircle(double x, double y, double r)
        {
            var l = new List<Enemy>();
            foreach (var e in Enemies) if (!e.Dead && e.SpawnT <= 0 && Dist(e.X, e.Y, x, y) < r + e.R) l.Add(e);
            return l;
        }

        void FireArrow(double ang, double mult, string kind = "arrow", double speed = 0, double r = 6, double rng = 0, double splash = 0, int pierce = 0)
        {
            var p = P;
            var c = D.Classes[Save.Cls];
            double sp = speed > 0 ? speed : (c.Attack.Speed > 0 ? c.Attack.Speed : 560);
            double rg = rng > 0 ? rng : c.Attack.Range;
            var (d, crit) = PlayerDmg();
            Proj.Add(new Projectile
            {
                Team = "p", Kind = kind, X = p.X + Math.Cos(ang) * 16, Y = p.Y + Math.Sin(ang) * 16, Vx = Math.Cos(ang) * sp, Vy = Math.Sin(ang) * sp,
                Ang = ang, R = r, Dmg = d * mult, Crit = crit, Life = rg / sp, Splash = splash, Pierce = pierce,
            });
        }

        void SkillRush(AimInfo a, GameInput inp)
        {
            var p = P;
            p.Dash = new Dash { T = 0.3, Dur = 0.3, Vx = Math.Cos(a.Ang) * 640, Vy = Math.Sin(a.Ang) * 640, Kind = "rush" };
            p.Invuln = Math.Max(p.Invuln, 0.3);
            p.Face = a.Ang;
            p.SkillAnim = "rush";
            p.SkillT = 0.3;
        }

        void SkillWhirl(AimInfo a, GameInput inp)
        {
            P.Spin = new Spin { T = 1.5, Tick = 0, Mul = SkillMulNow };
            P.SkillAnim = "whirl";
            P.SkillT = 1.5;
        }

        void SkillRally(AimInfo a, GameInput inp)
        {
            var p = P;
            p.Hp = Math.Min(Hero.MaxHp, p.Hp + Hero.MaxHp * 0.25 * SkillMulNow);
            p.DmgBuff = 6;
            p.SkillAnim = "rally";
            p.SkillT = 0.5;
            Text(p.X, p.Y - 30, "Rally!", 1f, 0.89f, 0.54f, 16, true);
            AddFx("ring", p.X, p.Y, 0.7, 1f, 0.85f, 0.42f, 120);
        }

        void SkillVolley(AimInfo a, GameInput inp)
        {
            var p = P;
            for (int i = -3; i <= 3; i++) FireArrow(a.Ang + i * 0.1, 0.8);
            p.Face = a.Ang;
            p.SkillAnim = "volley";
            p.SkillT = 0.3;
            p.AtkT = 0;
            p.AtkDur = 0.3;
        }

        void SkillTumble(AimInfo a, GameInput inp)
        {
            var p = P;
            double ang;
            if (Hyp(inp.MoveX, inp.MoveY) > 0.2) ang = Math.Atan2(inp.MoveY, inp.MoveX);
            else if (p.Moving) ang = p.MoveAng;
            else ang = a.Ang + Math.PI;
            p.Dash = new Dash { T = 0.4, Dur = 0.4, Vx = Math.Cos(ang) * 400, Vy = Math.Sin(ang) * 400, Kind = "tumble" };
            p.Invuln = Math.Max(p.Invuln, 0.42);
            p.SkillAnim = "tumble";
            p.SkillT = 0.4;
            p.MoveAng = ang;
        }

        void SkillRain(AimInfo a, GameInput inp)
        {
            var p = P;
            double d = Math.Min(420, Dist(a.X, a.Y, p.X, p.Y));
            double x = p.X + Math.Cos(a.Ang) * d, y = p.Y + Math.Sin(a.Ang) * d;
            Zones.Add(new Zone { Kind = "rain", Team = "p", X = x, Y = y, R = 112, Dur = 3, Dmg = 0.55 * SkillMulNow });
            p.Face = a.Ang;
            p.SkillAnim = "volley";
            p.SkillT = 0.4;
        }

        void SkillNova(AimInfo a, GameInput inp)
        {
            var p = P;
            foreach (var e in InCircle(p.X, p.Y, 135))
            {
                var (d, crit) = PlayerDmg();
                double ang = Math.Atan2(e.Y - p.Y, e.X - p.X);
                HurtEnemy(e, d * 1.6, crit, Math.Cos(ang), Math.Sin(ang), 120);
                e.SlowT = 3;
            }
            AddFx("nova", p.X, p.Y, 0.55, 0.56f, 0.85f, 1f, 135);
            p.SkillAnim = "nova";
            p.SkillT = 0.45;
            Shake = Math.Min(14, Shake + 3);
        }

        void SkillBlink(AimInfo a, GameInput inp)
        {
            var p = P;
            double ang = a.Ang;
            AddFx("blink", p.X, p.Y, 0.4, 0.72f, 0.61f, 1f);
            for (int i = 0; i < 18; i++)
            {
                p.X += Math.Cos(ang) * 10;
                p.Y += Math.Sin(ang) * 10;
                double px = p.X, py = p.Y;
                L.Resolve(ref p.X, ref p.Y, p.R);
                if (Math.Abs(px - p.X) > 3 || Math.Abs(py - p.Y) > 3) break;
            }
            AddFx("blink", p.X, p.Y, 0.4, 0.72f, 0.61f, 1f);
            p.Invuln = Math.Max(p.Invuln, 0.2);
            p.SkillAnim = "blink";
            p.SkillT = 0.3;
            p.Face = ang;
        }

        void SkillMeteor(AimInfo a, GameInput inp)
        {
            var p = P;
            double d = Math.Min(460, Dist(a.X, a.Y, p.X, p.Y));
            double x = p.X + Math.Cos(a.Ang) * d, y = p.Y + Math.Sin(a.Ang) * d;
            var (dmg, crit) = PlayerDmg();
            Zones.Add(new Zone { Kind = "meteor", Team = "p", X = x, Y = y, R = 118, Delay = 1.1, Dur = 1.6, Dmg = dmg * 4, Crit = crit });
            p.Face = a.Ang;
            p.SkillAnim = "cast";
            p.SkillT = 0.5;
        }

        public bool SkillReady(int i)
        {
            var sk = D.Classes[Save.Cls].Skills[i];
            return !P.Dead && Save.Level >= sk.Unlock && P.Cd[i] <= 0 && P.Dash == null && P.Spin == null && P.Mp >= sk.Cost;
        }

        public void TrySkill(int i, GameInput inp)
        {
            var p = P;
            var sk = D.Classes[Save.Cls].Skills[i];
            if (p.Dead || Save.Level < sk.Unlock || p.Cd[i] > 0 || p.Dash != null || p.Spin != null) return;
            if (p.Mp < sk.Cost)
            {
                MpFlash = 0.4;
                return;
            }
            var a = GetAim(inp);
            int lv = Save.SkillLv[i];
            p.Mp -= sk.Cost;
            p.Cd[i] = sk.Cd * D.SkillCdMul(lv) * (1 - Math.Min(0.5, Hero.Cdr / 100));
            SkillMulNow = D.SkillMul(lv);
            switch (sk.Id)
            {
                case "rush": SkillRush(a, inp); break;
                case "whirl": SkillWhirl(a, inp); break;
                case "rally": SkillRally(a, inp); break;
                case "volley": SkillVolley(a, inp); break;
                case "tumble": SkillTumble(a, inp); break;
                case "rain": SkillRain(a, inp); break;
                case "nova": SkillNova(a, inp); break;
                case "blink": SkillBlink(a, inp); break;
                case "meteor": SkillMeteor(a, inp); break;
            }
            SkillMulNow = 1;
            OnAction("skill:" + sk.Id);
        }

        void PlayerAttack(AimInfo a)
        {
            var p = P;
            var at = D.Classes[Save.Cls].Attack;
            p.AtkCd = at.Cd;
            p.AtkT = 0;
            p.AtkDur = at.Dur;
            p.Face = a.Ang;
            if (at.Type == "melee")
            {
                double half = at.Arc / 2 * Math.PI / 180;
                foreach (var e in Enemies)
                {
                    if (e.Dead || e.SpawnT > 0) continue;
                    double d = Dist(p.X, p.Y, e.X, e.Y);
                    if (d > at.Range + e.R) continue;
                    double ang = Math.Atan2(e.Y - p.Y, e.X - p.X);
                    if (d > e.R + 14 && AngDiff(ang, a.Ang) > half) continue;
                    var (dmg, crit) = PlayerDmg();
                    HurtEnemy(e, dmg * at.Mult, crit, Math.Cos(ang), Math.Sin(ang), 90);
                }
                AddFx("slash", p.X, p.Y, 0.22, 0.91f, 0.94f, 1f, 0, a.Ang, at.Range, at.Arc);
                OnAction("melee");
            }
            else if (at.Type == "arrow")
            {
                FireArrow(a.Ang, at.Mult);
                OnAction("arrow");
            }
            else
            {
                FireArrow(a.Ang, at.Mult, "bolt", at.Speed, 8, 0, at.Splash);
                OnAction("bolt");
            }
        }

        /// <summary>Distance at which the hero stops walking and starts attacking a clicked target.</summary>
        public double AttackReach(Enemy e)
        {
            var at = D.Classes[Save.Cls].Attack;
            return at.Type == "melee" ? at.Range * 0.72 + e.R : at.Range * 0.8;
        }

        // ------------------------------------------------------------ main update
        public void Update(double dt, GameInput inp)
        {
            if (Mode != "stage" || Paused) return;
            dt = Math.Min(dt, 0.05);
            Time += dt;
            var st = Stage;
            if (Banner != null)
            {
                Banner.T -= dt;
                if (Banner.T <= 0) Banner = null;
            }
            MpFlash = Math.Max(0, MpFlash - dt);
            Shake = Math.Max(0, Shake - dt * 22);

            if (st.State == "intro")
            {
                st.T -= dt;
                if (st.T <= 0) StartWave();
            }
            else if (st.State == "fight")
            {
                if (!Enemies.Exists(e => !e.Dead) && spawnQ.Count == 0)
                {
                    if (st.WaveIdx >= st.Waves.Count - 1)
                    {
                        st.State = "victory";
                        st.T = 1.8;
                        foreach (var pk in Pickups) pk.Magnet = true;
                        SetBanner(st.Boss ? "The Regent is slain" : "Victory!", "", 1.8);
                    }
                    else
                    {
                        st.State = "between";
                        st.T = 2.2;
                        SetBanner("Wave cleared", "", 1.6);
                    }
                }
            }
            else if (st.State == "between")
            {
                st.T -= dt;
                if (st.T <= 0) StartWave();
            }
            else if (st.State == "victory" || st.State == "defeat")
            {
                st.T -= dt;
                if (st.T <= 0)
                {
                    bool won = st.State == "victory";
                    st.State = "done";
                    FinishStage(won);
                }
            }

            for (int i = spawnQ.Count - 1; i >= 0; i--)
            {
                var q = spawnQ[i];
                q.t -= dt;
                spawnQ[i] = q;
                if (q.t <= 0)
                {
                    var (x, y) = SpawnPoint(q.type);
                    var e = MakeEnemy(q.type, x, y);
                    if (e.D.Boss) AddFx("spawn", x, y, 0.7, 1f, 0.42f, 0.16f);
                    else AddFx("spawn", x, y, 0.7, 1f, 0.6f, 0.29f);
                    spawnQ.RemoveAt(i);
                }
            }

            UpdatePlayer(dt, inp);
            UpdateEnemies(dt);
            UpdateProjectiles(dt);
            UpdateZones(dt);
            UpdatePickups(dt);
            for (int i = Effects.Count - 1; i >= 0; i--)
            {
                Effects[i].T += dt;
                if (Effects[i].T >= Effects[i].Dur) Effects.RemoveAt(i);
            }
            for (int i = Texts.Count - 1; i >= 0; i--)
            {
                var t = Texts[i];
                t.T += dt;
                t.Z += dt * 30;
                if (t.T >= t.Dur) Texts.RemoveAt(i);
            }
        }

        void FinishStage(bool won)
        {
            var s = Save;
            var st = Stage;
            var run = Run;
            int bonus = 0;
            if (won)
            {
                if (st.Id == "vault")
                {
                    bonus = (int)Math.Round(40 + st.Floor * 12.0);
                    s.VaultBest = Math.Max(s.VaultBest, st.Floor);
                }
                else
                {
                    int n = st.Def.Num;
                    bonus = 30 + n * 15;
                    if (n > s.Cleared)
                    {
                        s.Cleared = n;
                        run.FirstClear = true;
                        bonus += n * 40;
                    }
                    if (n == 6) s.Story = true;
                }
                s.Gold += bonus;
                run.Gold += bonus;
            }
            run.Bonus = bonus;
            Mode = "ended";
            OnEnd(new StageResult { Won = won, Stage = st, Run = run });
        }

        // ------------------------------------------------------------ steering
        /// <summary>Best heading towards (tx, ty) that is not blocked, probing to either side like a whisker.</summary>
        double SteerAngle(double x, double y, double r, double tx, double ty, double step, ref int steer, ref double steerT)
        {
            double ang = Math.Atan2(ty - y, tx - x);
            if (step <= 0) return ang;
            double Probe(double a)
            {
                double px = x + Math.Cos(a) * step * 2, py = y + Math.Sin(a) * step * 2;
                L.Resolve(ref px, ref py, r);
                return ((px - x) * Math.Cos(ang) + (py - y) * Math.Sin(ang)) / (step * 2);
            }
            double best = ang;
            if (Probe(ang) < 0.45)
            {
                if (steerT == 0 || steerT < Time)
                {
                    if (steer == 0) steer = R() < 0.5 ? 1 : -1;
                    steerT = Time + 1.2;
                }
                double bp = -9;
                foreach (double k in new[] { 0.7, 1.4, 2.1 })
                {
                    double a2 = ang + steer * k;
                    double pr = Probe(a2);
                    if (pr > bp)
                    {
                        bp = pr;
                        best = a2;
                    }
                    if (pr > 0.2) break;
                }
                if (bp < 0.1) steer = -steer;
            }
            return best;
        }

        int pSteer;
        double pSteerT;

        // ------------------------------------------------------------ player
        void UpdatePlayer(double dt, GameInput inp)
        {
            var p = P;
            var hero = Hero;
            if (p.Dead)
            {
                p.DeadT += dt;
                return;
            }
            p.AtkCd = Math.Max(0, p.AtkCd - dt);
            p.HitT = Math.Max(0, p.HitT - dt);
            p.Invuln = Math.Max(0, p.Invuln - dt);
            p.Grace = Math.Max(0, p.Grace - dt);
            p.DmgBuff = Math.Max(0, p.DmgBuff - dt);
            p.PotCd = Math.Max(0, p.PotCd - dt);
            for (int i = 0; i < 3; i++) p.Cd[i] = Math.Max(0, p.Cd[i] - dt);
            if (p.AtkT >= 0)
            {
                p.AtkT += dt / p.AtkDur;
                if (p.AtkT >= 1) p.AtkT = -1;
            }
            if (p.SkillT > 0)
            {
                p.SkillT -= dt;
                if (p.SkillT <= 0) p.SkillAnim = null;
            }
            p.Mp = Math.Min(hero.MaxMp, p.Mp + hero.Regen * dt);

            if (inp.Potion)
            {
                inp.Potion = false;
                if (Save.Potions > 0 && p.PotCd <= 0 && p.Hp < hero.MaxHp)
                {
                    Save.Potions--;
                    p.PotCd = 1;
                    int h = (int)Math.Round(hero.MaxHp * 0.5);
                    p.Hp = Math.Min(hero.MaxHp, p.Hp + h);
                    Text(p.X, p.Y - 26, "+" + h, 0.44f, 0.88f, 0.54f, 16);
                    AddFx("ring", p.X, p.Y, 0.5, 0.44f, 0.88f, 0.54f, 60);
                    OnAction("potion");
                }
            }
            for (int i = 0; i < 3; i++)
            {
                if (!inp.Skills[i]) continue;
                inp.Skills[i] = false;
                TrySkill(i, inp);
            }

            // --- decide where to go: keyboard > clicked target > clicked ground
            double mx = inp.MoveX, my = inp.MoveY;
            double ml = Hyp(mx, my);
            if (ml > 1)
            {
                mx /= ml;
                my /= ml;
            }
            bool keyboard = ml > 0.1;
            var tgt = EnemyById(inp.TargetId);
            if (inp.TargetId != 0 && (tgt == null || tgt.Dead)) inp.TargetId = 0;
            if (!Targetable(tgt)) tgt = null;
            bool inRange = false;
            double spd = hero.Speed * (p.Spin != null ? 0.65 : 1.0);
            if (keyboard)
            {
                inp.HasDest = false;
            }
            else if (tgt != null)
            {
                double d = Dist(p.X, p.Y, tgt.X, tgt.Y);
                if (d > AttackReach(tgt))
                {
                    double ang = SteerAngle(p.X, p.Y, p.R, tgt.X, tgt.Y, spd * dt, ref pSteer, ref pSteerT);
                    mx = Math.Cos(ang);
                    my = Math.Sin(ang);
                }
                else inRange = true;
            }
            else if (inp.HasDest)
            {
                double d = Dist(p.X, p.Y, inp.DestX, inp.DestY);
                if (d < Math.Max(6, spd * dt)) inp.HasDest = false;
                else
                {
                    double ang = SteerAngle(p.X, p.Y, p.R, inp.DestX, inp.DestY, spd * dt, ref pSteer, ref pSteerT);
                    double k = Math.Min(1, d / Math.Max(1e-3, spd * dt));
                    mx = Math.Cos(ang) * k;
                    my = Math.Sin(ang) * k;
                }
            }
            p.Moving = Hyp(mx, my) > 0.1;
            var a = GetAim(inp);

            if (p.Dash != null)
            {
                var d = p.Dash;
                d.T -= dt;
                p.Vx = d.Vx;
                p.Vy = d.Vy;
                p.X += d.Vx * dt;
                p.Y += d.Vy * dt;
                if (d.Kind == "rush")
                {
                    double ang = Math.Atan2(d.Vy, d.Vx);
                    foreach (var e in Enemies)
                    {
                        if (e.Dead || e.SpawnT > 0 || d.Hit.Contains(e.Id)) continue;
                        if (Dist(e.X, e.Y, p.X, p.Y) < e.R + p.R + 12)
                        {
                            d.Hit.Add(e.Id);
                            var (dmg, crit) = PlayerDmg();
                            int side = ((e.X - p.X) * -Math.Sin(ang) + (e.Y - p.Y) * Math.Cos(ang)) >= 0 ? 1 : -1;
                            HurtEnemy(e, dmg * 1.6, crit, -Math.Sin(ang) * side + Math.Cos(ang) * 0.3, Math.Cos(ang) * side + Math.Sin(ang) * 0.3, 360, 0.5);
                        }
                    }
                    if (R() < 0.6) AddFx("trail", p.X, p.Y, 0.3, 0.85f, 0.89f, 1f);
                }
                if (d.T <= 0) p.Dash = null;
                p.Walk += dt * 16;
                p.MoveAng = Math.Atan2(d.Vy, d.Vx);
                inp.HasDest = false;
            }
            else
            {
                double k = Math.Pow(0.0005, dt);
                p.Vx *= k;
                p.Vy *= k;
                // stand still while swinging so click-attacks don't slide
                double moveK = p.AtkT >= 0 && !keyboard ? 0.0 : 1.0;
                p.X += (mx * spd * moveK + p.Vx) * dt;
                p.Y += (my * spd * moveK + p.Vy) * dt;
                if (p.Moving && moveK > 0)
                {
                    p.Walk += dt * (spd / 18);
                    p.MoveAng = Math.Atan2(my, mx);
                }
            }
            L.Resolve(ref p.X, ref p.Y, p.R);

            bool wantAttack = (inp.Attack || inRange) && p.AtkCd <= 0 && p.Dash == null && p.Spin == null;
            if (p.Dash == null)
            {
                if (wantAttack || p.AtkT >= 0 || inRange || (inp.Attack && !p.Moving)) p.Face = a.Ang;
                else if (p.Moving) p.Face = p.MoveAng;
            }

            if (p.Spin != null)
            {
                p.Spin.T -= dt;
                p.Spin.Tick -= dt;
                if (p.Spin.Tick <= 0)
                {
                    p.Spin.Tick = 0.25;
                    foreach (var e in InCircle(p.X, p.Y, 86))
                    {
                        var (dmg, crit) = PlayerDmg();
                        double ang = Math.Atan2(e.Y - p.Y, e.X - p.X);
                        HurtEnemy(e, dmg * 0.8 * p.Spin.Mul, crit, Math.Cos(ang), Math.Sin(ang), 110);
                    }
                    AddFx("ring", p.X, p.Y, 0.3, 0.91f, 0.94f, 1f, 86);
                }
                if (p.Spin.T <= 0) p.Spin = null;
            }

            if (wantAttack) PlayerAttack(a);
        }

        // ------------------------------------------------------------ enemies
        void MoveTowards(Enemy e, double tx, double ty, double speed, double dt)
        {
            double ang = Math.Atan2(ty - e.Y, tx - e.X);
            double step = speed * dt;
            double best = e.Flying ? ang : SteerAngle(e.X, e.Y, e.R, tx, ty, step, ref e.Steer, ref e.SteerT);
            e.X += Math.Cos(best) * step;
            e.Y += Math.Sin(best) * step;
            e.Face = ang;
            e.Walk += dt * speed / 14;
        }

        (double, double, bool) GoalFor(Enemy e)
        {
            if (L.HasRiver)
            {
                int es = SideOf(e.X), ps = SideOf(P.X);
                if (es != 0 && es != ps) return (es < 0 ? L.RiverX0 + 12 : L.RiverX1 - 12, L.BridgeY, true);
            }
            return (P.X, P.Y, false);
        }

        void EnemyShoot(Enemy e, string kind, double ang, double speed, double dmg, double life = 3, double r = 5)
        {
            Proj.Add(new Projectile
            {
                Team = "e", Kind = kind, X = e.X + Math.Cos(ang) * 14, Y = e.Y + Math.Sin(ang) * 14, Vx = Math.Cos(ang) * speed, Vy = Math.Sin(ang) * speed,
                Ang = ang, R = r, Dmg = dmg, Life = life,
            });
        }

        void UpdateEnemies(double dt)
        {
            var p = P;
            for (int i = Enemies.Count - 1; i >= 0; i--)
            {
                var e = Enemies[i];
                if (e.Dead)
                {
                    e.DeadT += dt;
                    if (e.DeadT > 2.4) Enemies.RemoveAt(i);
                }
            }
            foreach (var e in Enemies.ToArray())
            {
                if (e.Dead) continue;
                e.HitT = Math.Max(0, e.HitT - dt);
                e.SlowT = Math.Max(0, e.SlowT - dt);
                e.StunT = Math.Max(0, e.StunT - dt);
                e.Cd -= dt;
                if (e.AtkT >= 0 && e.State != "windup") e.AtkT = -1;
                double k = Math.Pow(0.002, dt);
                e.Vx *= k;
                e.Vy *= k;
                e.X += e.Vx * dt;
                e.Y += e.Vy * dt;
                if (e.SpawnT > 0)
                {
                    e.SpawnT -= dt;
                    if (!e.Flying) L.Resolve(ref e.X, ref e.Y, e.R);
                    continue;
                }
                if (e.StunT > 0)
                {
                    if (!e.Flying) L.Resolve(ref e.X, ref e.Y, e.R);
                    continue;
                }
                double slow = e.SlowT > 0 ? 0.5 : 1.0;
                double dp = Dist(e.X, e.Y, p.X, p.Y);
                bool aliveP = !p.Dead;
                e.StuckT += dt;
                if (e.StuckT > 3)
                {
                    if (e.State == "chase" && !e.D.Boss && dp > 140 && Dist(e.X, e.Y, e.Sx, e.Sy) < 10)
                    {
                        (e.X, e.Y) = SpawnPoint(e.Type);
                        e.SpawnT = 0.5;
                    }
                    e.Sx = e.X;
                    e.Sy = e.Y;
                    e.StuckT = 0;
                }
                switch (e.Type)
                {
                    case "grunt": AiGrunt(e, dt, dp, slow, aliveP); break;
                    case "bowman": AiBowman(e, dt, dp, slow, aliveP); break;
                    case "wisp": AiWisp(e, dt, dp, slow, aliveP); break;
                    case "brute": AiBrute(e, dt, dp, slow, aliveP); break;
                    case "regent": AiRegent(e, dt, dp, slow, aliveP); break;
                }
            }
            var es = Enemies;
            for (int i = 0; i < es.Count; i++)
            {
                var a = es[i];
                if (a.Dead || a.SpawnT > 0) continue;
                for (int j = i + 1; j < es.Count; j++)
                {
                    var b = es[j];
                    if (b.Dead || b.SpawnT > 0 || a.Flying != b.Flying) continue;
                    double dx = b.X - a.X, dy = b.Y - a.Y, rr = a.R + b.R;
                    double d2 = dx * dx + dy * dy;
                    if (d2 > 0.01 && d2 < rr * rr)
                    {
                        double d = Math.Sqrt(d2);
                        double push = (rr - d) * 0.5;
                        double wa = a.D.Boss ? 0.1 : 1, wb = b.D.Boss ? 0.1 : 1;
                        a.X -= dx / d * push * wa;
                        a.Y -= dy / d * push * wa;
                        b.X += dx / d * push * wb;
                        b.Y += dy / d * push * wb;
                    }
                }
                if (!a.Flying) L.Resolve(ref a.X, ref a.Y, a.R);
                else
                {
                    a.X = Clamp(a.X, L.B.X0 + a.R, L.B.X1 - a.R);
                    a.Y = Clamp(a.Y, L.B.Y0 + a.R, L.B.Y1 - a.R);
                }
                if (!p.Dead && !a.D.Boss)
                {
                    double dx = p.X - a.X, dy = p.Y - a.Y, rr = a.R + p.R - 2;
                    double d2 = dx * dx + dy * dy;
                    if (d2 > 0.01 && d2 < rr * rr && p.Dash == null)
                    {
                        double d = Math.Sqrt(d2);
                        p.X += dx / d * (rr - d) * 0.35;
                        p.Y += dy / d * (rr - d) * 0.35;
                        a.X -= dx / d * (rr - d) * 0.15;
                        a.Y -= dy / d * (rr - d) * 0.15;
                    }
                }
            }
        }

        void AiGrunt(Enemy e, double dt, double dp, double slow, bool aliveP)
        {
            var d = e.D;
            var p = P;
            if (e.State == "chase")
            {
                var (gx, gy, via) = GoalFor(e);
                if (aliveP && dp < d.Range + p.R && e.Cd <= 0)
                {
                    e.State = "windup";
                    e.T = d.Windup;
                    e.AtkT = 0;
                    e.Face = Math.Atan2(p.Y - e.Y, p.X - e.X);
                }
                else if (dp > d.Range * 0.6 || via) MoveTowards(e, gx, gy, e.Speed * slow, dt);
                else e.Face = Math.Atan2(p.Y - e.Y, p.X - e.X);
            }
            else if (e.State == "windup")
            {
                e.T -= dt;
                e.AtkT = 1 - Math.Max(0, e.T) / d.Windup;
                if (e.T <= 0)
                {
                    if (aliveP && Dist(e.X, e.Y, p.X, p.Y) < d.Range + p.R + 14 && AngDiff(Math.Atan2(p.Y - e.Y, p.X - e.X), e.Face) < 1.2)
                        HurtPlayer(e.Dmg, e.X, e.Y);
                    e.State = "recover";
                    e.T = 0.35;
                    e.AtkT = -1;
                    e.Cd = d.Cd;
                }
            }
            else if (e.State == "recover")
            {
                e.T -= dt;
                if (e.T <= 0) e.State = "chase";
            }
        }

        void AiBowman(Enemy e, double dt, double dp, double slow, bool aliveP)
        {
            var d = e.D;
            var p = P;
            if (e.State == "chase")
            {
                e.StrafeT -= dt;
                if (e.StrafeT <= 0)
                {
                    e.Strafe *= -1;
                    e.StrafeT = Rand(1.2, 2.8);
                }
                double toP = Math.Atan2(p.Y - e.Y, p.X - e.X);
                var (gx, gy, via) = GoalFor(e);
                if (via) MoveTowards(e, gx, gy, e.Speed * slow, dt);
                else if (dp < d.Keep)
                {
                    e.X -= Math.Cos(toP) * e.Speed * 1.1 * slow * dt;
                    e.Y -= Math.Sin(toP) * e.Speed * 1.1 * slow * dt;
                    e.Face = toP;
                    e.Walk += dt * 6;
                }
                else if (dp > d.Range - 30) MoveTowards(e, p.X, p.Y, e.Speed * slow, dt);
                else
                {
                    e.X += Math.Cos(toP + Math.PI / 2) * e.Strafe * e.Speed * 0.7 * slow * dt;
                    e.Y += Math.Sin(toP + Math.PI / 2) * e.Strafe * e.Speed * 0.7 * slow * dt;
                    e.Face = toP;
                    e.Walk += dt * 5;
                }
                if (aliveP && e.Cd <= 0 && dp < d.Range)
                {
                    e.State = "windup";
                    e.T = d.Windup;
                    e.AtkT = 0;
                }
            }
            else if (e.State == "windup")
            {
                e.T -= dt;
                e.AtkT = 1 - Math.Max(0, e.T) / d.Windup;
                e.Face = Math.Atan2(p.Y - e.Y, p.X - e.X);
                if (e.T <= 0)
                {
                    EnemyShoot(e, "earrow", e.Face, d.ProjSpeed, e.Dmg, 2.6, 5);
                    e.State = "recover";
                    e.T = 0.25;
                    e.AtkT = -1;
                    e.Cd = d.Cd * Rand(0.9, 1.3);
                }
            }
            else if (e.State == "recover")
            {
                e.T -= dt;
                if (e.T <= 0) e.State = "chase";
            }
        }

        void AiWisp(Enemy e, double dt, double dp, double slow, bool aliveP)
        {
            var d = e.D;
            var p = P;
            e.Wob += dt * 5;
            if (e.State == "chase")
            {
                double ang = Math.Atan2(p.Y - e.Y, p.X - e.X) + Math.Sin(e.Wob) * 0.6;
                e.X += Math.Cos(ang) * e.Speed * slow * dt;
                e.Y += Math.Sin(ang) * e.Speed * slow * dt;
                e.Face = ang;
                e.Walk += dt * 8;
                if (aliveP && dp < d.Range + p.R && e.Cd <= 0)
                {
                    e.State = "windup";
                    e.T = d.Windup;
                    e.AtkT = 0;
                }
            }
            else if (e.State == "windup")
            {
                e.T -= dt;
                e.AtkT = 1 - Math.Max(0, e.T) / d.Windup;
                if (e.T <= 0)
                {
                    if (aliveP && Dist(e.X, e.Y, p.X, p.Y) < d.Range + p.R + 8) HurtPlayer(e.Dmg, e.X, e.Y);
                    e.State = "recover";
                    e.T = 0.7;
                    e.AtkT = -1;
                    e.Cd = d.Cd;
                    e.RAng = Math.Atan2(e.Y - p.Y, e.X - p.X) + Rand(-0.6, 0.6);
                }
            }
            else if (e.State == "recover")
            {
                e.T -= dt;
                e.X += Math.Cos(e.RAng) * e.Speed * 0.9 * dt;
                e.Y += Math.Sin(e.RAng) * e.Speed * 0.9 * dt;
                if (e.T <= 0) e.State = "chase";
            }
        }

        void AiBrute(Enemy e, double dt, double dp, double slow, bool aliveP)
        {
            var d = e.D;
            var p = P;
            if (e.State == "chase")
            {
                var (gx, gy, via) = GoalFor(e);
                if (aliveP && dp < 120 && e.Cd <= 0)
                {
                    e.State = "windup";
                    e.T = d.Windup;
                    e.AtkT = 0;
                    e.Face = Math.Atan2(p.Y - e.Y, p.X - e.X);
                    double sx = Clamp(p.X, e.X - 150, e.X + 150), sy = Clamp(p.Y, e.Y - 150, e.Y + 150);
                    Zones.Add(new Zone { Kind = "slam", Team = "e", X = sx, Y = sy, R = d.SlamR, Delay = d.Windup, Dur = d.Windup + 0.35, Dmg = e.Dmg });
                }
                else MoveTowards(e, gx, gy, e.Speed * slow, dt);
            }
            else if (e.State == "windup")
            {
                e.T -= dt;
                e.AtkT = 1 - Math.Max(0, e.T) / d.Windup;
                if (e.T <= 0)
                {
                    e.State = "recover";
                    e.T = 0.9;
                    e.AtkT = -1;
                    e.Cd = d.Cd;
                    Shake = Math.Min(14, Shake + 4);
                }
            }
            else if (e.State == "recover")
            {
                e.T -= dt;
                if (e.T <= 0) e.State = "chase";
            }
        }

        void AiRegent(Enemy e, double dt, double dp, double slow, bool aliveP)
        {
            var p = P;
            bool enr = e.Enraged;
            if (!enr && e.Hp < e.MaxHp * 0.5)
            {
                e.Enraged = enr = true;
                SetBanner("The Regent is enraged!", "", 1.8);
                AddFx("ring", e.X, e.Y, 0.9, 1f, 0.35f, 0.16f, 200);
                Shake = 12;
            }
            double spd = e.Speed * (enr ? 1.3 : 1.0) * slow;
            double dmg = e.Dmg * (enr ? 1.2 : 1.0);
            e.SummonCd -= dt;
            double toP = Math.Atan2(p.Y - e.Y, p.X - e.X);
            double recCd = enr ? 0.9 : 1.5;
            switch (e.State)
            {
                case "idle":
                {
                    e.Anim = "idle";
                    if (aliveP && dp > 90) MoveTowards(e, p.X, p.Y, spd, dt);
                    else e.Face = toP;
                    if (aliveP && e.Cd <= 0)
                    {
                        int alive = 0;
                        foreach (var o in Enemies) if (!o.Dead && o != e) alive++;
                        var opts = new List<string> { "slam", "orbs", "charge" };
                        if (e.SummonCd <= 0 && alive < 4) { opts.Add("summon"); opts.Add("summon"); }
                        if (dp < 140) opts.Add("slam");
                        string pick = opts[Math.Min(opts.Count - 1, (int)(R() * opts.Count))];
                        e.State = pick;
                        e.Anim = pick;
                        e.Face = toP;
                        e.AtkT = 0;
                        e.HitDone = false;
                        if (pick == "slam")
                        {
                            e.T = e.Dur = enr ? 0.8 : 1.05;
                            Zones.Add(new Zone { Kind = "slam", Team = "e", X = p.X, Y = p.Y, R = 108, Delay = e.T, Dur = e.T + 0.4, Dmg = dmg * 1.3 });
                            if (enr)
                                foreach (int s in new[] { -1, 1 })
                                    Zones.Add(new Zone { Kind = "slam", Team = "e", X = p.X + s * 140, Y = p.Y + 30, R = 80, Delay = e.T + 0.25, Dur = e.T + 0.65, Dmg = dmg });
                        }
                        else if (pick == "orbs")
                        {
                            e.T = e.Dur = 0.7;
                            e.Rings = enr ? 2 : 1;
                        }
                        else if (pick == "charge")
                        {
                            e.T = e.Dur = enr ? 0.65 : 0.85;
                            e.ChargeAng = toP;
                            e.ChargePhase = 0;
                            Zones.Add(new Zone
                            {
                                Kind = "line", Team = "e", X = e.X, Y = e.Y, X2 = e.X + Math.Cos(toP) * 560, Y2 = e.Y + Math.Sin(toP) * 560, W = 56,
                                Delay = e.T, Dur = e.T,
                            });
                        }
                        else
                        {
                            e.T = e.Dur = 0.9;
                            e.SummonCd = enr ? 9 : 13;
                        }
                    }
                    break;
                }
                case "slam":
                    e.T -= dt;
                    e.AtkT = 1 - Math.Max(0, e.T) / e.Dur;
                    if (e.T <= 0)
                    {
                        e.State = "recover"; e.T = 0.8; e.Anim = "idle"; e.AtkT = -1; e.Cd = recCd;
                        Shake = Math.Min(14, Shake + 6);
                    }
                    break;
                case "orbs":
                    e.T -= dt;
                    e.AtkT = 1 - Math.Max(0, e.T) / e.Dur;
                    if (e.T <= 0)
                    {
                        int n = enr ? 18 : 12;
                        double off = Rand(0, TAU);
                        for (int i = 0; i < n; i++) EnemyShoot(e, "orb", off + (double)i / n * TAU, 170, dmg * 0.55, 4.5, 8);
                        e.Rings--;
                        if (e.Rings > 0)
                        {
                            e.T = e.Dur = 0.55;
                            e.AtkT = 0;
                        }
                        else
                        {
                            e.State = "recover"; e.T = 0.7; e.Anim = "idle"; e.AtkT = -1; e.Cd = recCd;
                        }
                    }
                    break;
                case "charge":
                    if (e.ChargePhase == 0)
                    {
                        e.T -= dt;
                        e.AtkT = 1 - Math.Max(0, e.T) / e.Dur;
                        if (e.T <= 0)
                        {
                            e.ChargePhase = 1;
                            e.T = 0.6;
                            e.AtkT = -1;
                        }
                    }
                    else
                    {
                        e.T -= dt;
                        e.X += Math.Cos(e.ChargeAng) * 560 * dt;
                        e.Y += Math.Sin(e.ChargeAng) * 560 * dt;
                        e.Face = e.ChargeAng;
                        e.Walk += dt * 20;
                        if (!e.HitDone && aliveP && Dist(e.X, e.Y, p.X, p.Y) < e.R + p.R + 6)
                        {
                            if (HurtPlayer(dmg * 1.4, e.X, e.Y))
                            {
                                e.HitDone = true;
                                p.Vx += Math.Cos(e.ChargeAng) * 260;
                                p.Vy += Math.Sin(e.ChargeAng) * 260;
                            }
                        }
                        var b = L.B;
                        double before = e.X + e.Y;
                        L.Resolve(ref e.X, ref e.Y, e.R);
                        if (e.T <= 0 || Math.Abs(before - (e.X + e.Y)) > 3 || e.X < b.X0 + 40 || e.X > b.X1 - 40 || e.Y < b.Y0 + 40 || e.Y > b.Y1 - 40)
                        {
                            e.State = "recover"; e.T = 0.9; e.Anim = "idle"; e.Cd = recCd;
                            Shake = Math.Min(14, Shake + 4);
                        }
                    }
                    break;
                case "summon":
                    e.T -= dt;
                    e.AtkT = 1 - Math.Max(0, e.T) / e.Dur;
                    if (e.T <= 0)
                    {
                        int n = enr ? 3 : 2;
                        var bd = L.B;
                        for (int i = 0; i < n; i++)
                        {
                            double a = (double)i / n * TAU + Rand(0, 1);
                            var g = MakeEnemy("grunt", Clamp(e.X + Math.Cos(a) * 80, bd.X0 + 30, bd.X1 - 30), Clamp(e.Y + Math.Sin(a) * 80, bd.Y0 + 30, bd.Y1 - 30));
                            g.Summoned = true;
                            AddFx("spawn", g.X, g.Y, 0.7, 1f, 0.42f, 0.16f);
                        }
                        e.State = "recover"; e.T = 0.6; e.Anim = "idle"; e.AtkT = -1; e.Cd = recCd;
                    }
                    break;
                case "recover":
                    e.T -= dt;
                    if (e.T <= 0) e.State = "idle";
                    break;
            }
        }

        // ------------------------------------------------------------ projectiles / zones / pickups
        void SplashDamage(double x, double y, double r, double dmg, bool crit, Enemy skip)
        {
            foreach (var e in Enemies.ToArray())
            {
                if (e.Dead || e.SpawnT > 0 || e == skip) continue;
                if (Dist(e.X, e.Y, x, y) < r + e.R) HurtEnemy(e, dmg, crit);
            }
            AddFx("burst", x, y, 0.35, 1f, 0.6f, 0.23f, r);
        }

        void UpdateProjectiles(double dt)
        {
            var p = P;
            var b = L.B;
            for (int i = Proj.Count - 1; i >= 0; i--)
            {
                var q = Proj[i];
                q.T += dt;
                q.Life -= dt;
                q.X += q.Vx * dt;
                q.Y += q.Vy * dt;
                bool dead = q.Life <= 0;
                if (q.X < b.X0 - 40 || q.X > b.X1 + 40 || q.Y < b.Y0 - 40 || q.Y > b.Y1 + 40) dead = true;
                if (!dead && q.Team == "p")
                {
                    foreach (var e in Enemies.ToArray())
                    {
                        if (e.Dead || e.SpawnT > 0 || q.Hit.Contains(e.Id)) continue;
                        if (Dist(e.X, e.Y, q.X, q.Y) < e.R + q.R)
                        {
                            q.Hit.Add(e.Id);
                            HurtEnemy(e, q.Dmg, q.Crit, Math.Cos(q.Ang), Math.Sin(q.Ang), 40);
                            if (q.Splash > 0) SplashDamage(q.X, q.Y, q.Splash, q.Dmg * 0.6, false, e);
                            q.Pierce--;
                            if (q.Pierce < 0)
                            {
                                dead = true;
                                break;
                            }
                        }
                    }
                }
                else if (!dead && !p.Dead)
                {
                    if (Dist(p.X, p.Y, q.X, q.Y) < p.R + q.R)
                    {
                        HurtPlayer(q.Dmg, q.X - q.Vx, q.Y - q.Vy);
                        dead = true;
                    }
                }
                if (dead)
                {
                    if (q.Team == "p" && q.Splash > 0 && q.Hit.Count == 0) SplashDamage(q.X, q.Y, q.Splash, q.Dmg * 0.6, false, null);
                    Proj.RemoveAt(i);
                }
            }
        }

        void UpdateZones(double dt)
        {
            var p = P;
            for (int i = Zones.Count - 1; i >= 0; i--)
            {
                var z = Zones[i];
                z.T += dt;
                if (z.Kind == "rain")
                {
                    z.Tick -= dt;
                    if (z.Tick <= 0 && z.T < z.Dur)
                    {
                        z.Tick = 0.25;
                        foreach (var e in InCircle(z.X, z.Y, z.R))
                        {
                            var (d, crit) = PlayerDmg();
                            HurtEnemy(e, d * z.Dmg, crit);
                        }
                    }
                }
                else if ((z.Kind == "meteor" || z.Kind == "slam") && !z.Fired && z.T >= z.Delay)
                {
                    z.Fired = true;
                    if (z.Team == "p")
                    {
                        foreach (var e in InCircle(z.X, z.Y, z.R))
                        {
                            double a = Math.Atan2(e.Y - z.Y, e.X - z.X);
                            HurtEnemy(e, z.Dmg, z.Crit, Math.Cos(a), Math.Sin(a), 160, 0.4);
                        }
                        Shake = Math.Min(14, Shake + 7);
                        AddFx("burst", z.X, z.Y, 0.5, 1f, 0.54f, 0.23f, z.R);
                    }
                    else
                    {
                        if (!p.Dead && Dist(p.X, p.Y, z.X, z.Y) < z.R + p.R * 0.4) HurtPlayer(z.Dmg, z.X, z.Y);
                        Shake = Math.Min(14, Shake + 5);
                        AddFx("burst", z.X, z.Y, 0.5, 0.78f, 0.63f, 0.44f, z.R);
                    }
                }
                if (z.T >= z.Dur) Zones.RemoveAt(i);
            }
        }

        void UpdatePickups(double dt)
        {
            var p = P;
            for (int i = Pickups.Count - 1; i >= 0; i--)
            {
                var pk = Pickups[i];
                pk.T += dt;
                if (pk.Vx != 0 || pk.Vy != 0)
                {
                    pk.X += pk.Vx * dt;
                    pk.Y += pk.Vy * dt;
                    double k = Math.Pow(0.01, dt);
                    pk.Vx *= k;
                    pk.Vy *= k;
                }
                if (p.Dead) continue;
                double d = Dist(p.X, p.Y, pk.X, pk.Y);
                double mag = pk.Kind == "item" ? 55 : 95;
                if (pk.T > 0.35 && (pk.Magnet || d < mag))
                {
                    double sp = pk.Magnet ? 700 : 260;
                    double dd = d > 0 ? d : 1;
                    pk.X += (p.X - pk.X) / dd * sp * dt;
                    pk.Y += (p.Y - pk.Y) / dd * sp * dt;
                }
                if (d < 20 && pk.T > 0.2)
                {
                    Collect(pk);
                    Pickups.RemoveAt(i);
                }
            }
        }

        public static List<List<(string type, int n)>> VaultWaves(int floor, bool boss)
        {
            var rn = new Rng(floor * 977 + 13);
            int n = boss ? 2 : Math.Min(4, 2 + floor / 3);
            double budget = 6 + floor * 1.4;
            var keys = new[] { "grunt", "bowman", "wisp", "brute" };
            var costs = new Dictionary<string, double> { ["grunt"] = 1, ["bowman"] = 1.3, ["wisp"] = 0.8, ["brute"] = 4 };
            var weights = new Dictionary<string, double> { ["grunt"] = 5, ["bowman"] = 3, ["wisp"] = 3, ["brute"] = 1 + floor * 0.15 };
            double wsum = 0;
            foreach (var k in keys) wsum += weights[k];
            var waves = new List<List<(string, int)>>();
            for (int w = 0; w < n; w++)
            {
                var counts = new List<(string type, int n)>();
                double left = budget * (0.7 + w * 0.2) / (boss ? 1.3 : 1);
                int guard = 0;
                while (left > 0.8 && guard < 60)
                {
                    guard++;
                    double t = rn.Next() * wsum;
                    string pick = keys[0];
                    foreach (var k in keys)
                    {
                        t -= weights[k];
                        if (t <= 0)
                        {
                            pick = k;
                            break;
                        }
                    }
                    if (costs[pick] > left && pick == "brute") continue;
                    int idx = counts.FindIndex(c => c.type == pick);
                    if (idx < 0) counts.Add((pick, 1));
                    else counts[idx] = (pick, counts[idx].n + 1);
                    left -= costs[pick];
                }
                var wave = new List<(string, int)>();
                foreach (var c in counts) wave.Add((c.type, Math.Min(c.n, 14)));
                waves.Add(wave);
            }
            if (boss) waves.Add(new List<(string, int)> { ("regent", 1) });
            return waves;
        }
    }
}
