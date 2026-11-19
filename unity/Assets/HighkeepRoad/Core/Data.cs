// Static game data: classes, skills, stages, enemies, rarities, affixes and progression tables.
// Pure C# (no UnityEngine) so it can be unit tested outside the editor.
using System;
using System.Collections.Generic;

namespace Highkeep.Core
{
    public sealed class AttackDef
    {
        public string Type;      // melee | arrow | bolt
        public double Range, Arc, Cd, Mult, Dur, Speed, Splash;
    }

    public sealed class SkillDef
    {
        public string Id, Name, Desc;
        public int Unlock, Cost;
        public double Cd;
    }

    public sealed class ClassDef
    {
        public string Id, Name, Blurb;
        public int Hp, Mp;
        public double Speed, Damage, ManaRegen;
        public string[] WeaponKinds;
        public AttackDef Attack;
        public SkillDef[] Skills;
    }

    public sealed class RarityDef
    {
        public string Id, Name;
        public float R, G, B;
        public int Affixes;
        public double Sell, Weight;
    }

    public sealed class AffixDef
    {
        public string Key, Label, Fmt, Prefix, Suffix;
        public double Base;
        public int Dec;
    }

    public sealed class EnemyDef
    {
        public string Id, Name;
        public int Hp, Xp;
        public double Dmg, Speed, R, Windup, Cd, Range, Drop, Keep, ProjSpeed, SlamR;
        public int Gold0, Gold1;
        public bool Boss, Flying;
    }

    public sealed class StageDef
    {
        public string Id, Name, Theme, Blurb;   // Id: "1".."6" or "vault"
        public int Num, Power;
        public float NodeX, NodeY;
        public List<List<(string type, int n)>> Waves;
    }

    public sealed class TraitNode { public string Id, Name, Stat, Text; public double Per; }
    public sealed class TraitBranch { public string Id, Name; public TraitNode[] Nodes; }
    public sealed class ArtifactDef { public string Id, Name, Stat, Text; public double Val; }
    public sealed class RouteDef
    {
        public string Id, Name, Blurb;
        public double Mins, Art;
        public int Scouts, Steel0, Steel1, Gold0, Gold1;
    }

    public static class D
    {
        public const int WorldW = 1600, WorldH = 1150;
        public const int MaxLevel = 30, MaxPotions = 5, PotionPrice = 25;
        public const int BagSize = 24, BagMax = 60, BagExpand = 6, MaxPlus = 10, ResearchMax = 10;
        public const int SkillMax = 10, TraitMax = 5, SigilMax = 10, ArtMax = 10, ArtSlots = 3;
        public const int ExpUnlockStage = 3, ExpSlots = 2, ScoutMax = 5;

        public static int BagExpandCost(int size) => 120 + (size - BagSize) * 25;
        public static int XpToNext(int level) => (int)Math.Round(30 * Math.Pow(level, 1.55) + 30);

        public static readonly string[] SetNames =
        {
            "Millbrook Militia", "Hollow Stalker", "Toll Warden", "Marsh Wraith", "Highkeep Guard", "Throne Breaker",
        };

        /// <summary>Totals for wearing 2 / 3 pieces of a set; tier = 1 + 0.35 * set id.</summary>
        public static Dictionary<string, double> SetBonus(int pieces, double tier)
        {
            if (pieces == 2)
                return new Dictionary<string, double> { ["armor"] = Math.Round(6 * tier), ["hp"] = Math.Round(18 * tier) };
            return new Dictionary<string, double> { ["damage"] = Math.Round(3 * tier * 10) / 10, ["crit"] = 3 };
        }

        public static readonly Dictionary<string, ClassDef> Classes = new Dictionary<string, ClassDef>
        {
            ["knight"] = new ClassDef
            {
                Id = "knight", Name = "Knight", Hp = 150, Mp = 60, Speed = 165, Damage = 16, ManaRegen = 2.5,
                Blurb = "Armoured vanguard. Cuts a wide arc and shrugs off blows.",
                WeaponKinds = new[] { "Sword", "Longsword", "Arming Sword", "Falchion" },
                Attack = new AttackDef { Type = "melee", Range = 64, Arc = 130, Cd = 0.46, Mult = 1.0, Dur = 0.28 },
                Skills = new[]
                {
                    new SkillDef { Id = "rush", Name = "Shield Rush", Unlock = 1, Cost = 14, Cd = 6, Desc = "Charge forward, hurling foes aside." },
                    new SkillDef { Id = "whirl", Name = "Whirlwind", Unlock = 3, Cost = 26, Cd = 10, Desc = "Spin for 1.5s, striking everything near." },
                    new SkillDef { Id = "rally", Name = "Rally Cry", Unlock = 5, Cost = 30, Cd = 18, Desc = "Heal 25% and deal +50% damage for 6s." },
                },
            },
            ["ranger"] = new ClassDef
            {
                Id = "ranger", Name = "Ranger", Hp = 115, Mp = 70, Speed = 188, Damage = 12, ManaRegen = 2.8,
                Blurb = "Swift archer. Keeps distance and fills the air with arrows.",
                WeaponKinds = new[] { "Longbow", "Shortbow", "Yew Bow", "Hornbow" },
                Attack = new AttackDef { Type = "arrow", Range = 560, Cd = 0.36, Mult = 1.0, Dur = 0.22, Speed = 560 },
                Skills = new[]
                {
                    new SkillDef { Id = "volley", Name = "Volley", Unlock = 1, Cost = 14, Cd = 5, Desc = "Loose seven arrows in a fan." },
                    new SkillDef { Id = "tumble", Name = "Tumble", Unlock = 3, Cost = 8, Cd = 4, Desc = "Roll away, untouchable while rolling." },
                    new SkillDef { Id = "rain", Name = "Arrow Rain", Unlock = 5, Cost = 32, Cd = 14, Desc = "Darken an area with arrows for 3s." },
                },
            },
            ["mage"] = new ClassDef
            {
                Id = "mage", Name = "Mage", Hp = 95, Mp = 130, Speed = 172, Damage = 15, ManaRegen = 4,
                Blurb = "Glass cannon. Firebolts that splash, spells that reshape the fight.",
                WeaponKinds = new[] { "Staff", "Rod", "Wand", "Scepter" },
                Attack = new AttackDef { Type = "bolt", Range = 520, Cd = 0.58, Mult = 1.1, Dur = 0.3, Speed = 400, Splash = 54 },
                Skills = new[]
                {
                    new SkillDef { Id = "nova", Name = "Frost Nova", Unlock = 1, Cost = 20, Cd = 7, Desc = "Burst of frost that damages and slows." },
                    new SkillDef { Id = "blink", Name = "Blink", Unlock = 3, Cost = 12, Cd = 4, Desc = "Teleport a short distance." },
                    new SkillDef { Id = "meteor", Name = "Meteor", Unlock = 5, Cost = 40, Cd = 12, Desc = "Call a meteor; lands after a short delay." },
                },
            },
        };
        public static readonly string[] ClassOrder = { "knight", "ranger", "mage" };
        public const double PerLevelHp = 14, PerLevelMp = 6, PerLevelDamage = 1.8;

        public static readonly RarityDef[] Rarities =
        {
            new RarityDef { Id = "common", Name = "Common", R = 0.80f, G = 0.78f, B = 0.70f, Affixes = 0, Sell = 1.0, Weight = 58 },
            new RarityDef { Id = "magic", Name = "Magic", R = 0.37f, G = 0.67f, B = 1.0f, Affixes = 1, Sell = 2.2, Weight = 29 },
            new RarityDef { Id = "rare", Name = "Rare", R = 0.95f, G = 0.82f, B = 0.29f, Affixes = 2, Sell = 4.5, Weight = 11 },
            new RarityDef { Id = "heroic", Name = "Heroic", R = 1.0f, G = 0.48f, B = 0.18f, Affixes = 4, Sell = 9.0, Weight = 2 },
        };

        public static readonly AffixDef[] AffixList =
        {
            new AffixDef { Key = "hp", Label = "Health", Base = 12, Fmt = "+{0} Health", Prefix = "Hale", Suffix = "of Vigor", Dec = 0 },
            new AffixDef { Key = "mp", Label = "Mana", Base = 8, Fmt = "+{0} Mana", Prefix = "Lucid", Suffix = "of the Well", Dec = 0 },
            new AffixDef { Key = "damage", Label = "Damage", Base = 1.6, Fmt = "+{0} Damage", Prefix = "Keen", Suffix = "of Edges", Dec = 1 },
            new AffixDef { Key = "armor", Label = "Armor", Base = 3, Fmt = "+{0} Armor", Prefix = "Warded", Suffix = "of Bulwarks", Dec = 0 },
            new AffixDef { Key = "crit", Label = "Crit", Base = 1.6, Fmt = "+{0}% Crit", Prefix = "Sharp", Suffix = "of Precision", Dec = 1 },
            new AffixDef { Key = "speed", Label = "Speed", Base = 2, Fmt = "+{0}% Speed", Prefix = "Fleet", Suffix = "of Wind", Dec = 1 },
            new AffixDef { Key = "regen", Label = "Mana Regen", Base = 0.45, Fmt = "+{0} Mana/s", Prefix = "Flowing", Suffix = "of Tides", Dec = 2 },
        };
        public static readonly Dictionary<string, AffixDef> Affixes = new Dictionary<string, AffixDef>();
        public static readonly string[] AffixKeys;

        public static readonly string[] Slots = { "weapon", "armor", "charm" };
        public static readonly Dictionary<string, string> SlotLabel = new Dictionary<string, string>
        { ["weapon"] = "Weapon", ["armor"] = "Armor", ["charm"] = "Charm" };
        public static readonly string[] ArmorNames = { "Jerkin", "Hauberk", "Brigandine", "Cuirass", "Gambeson", "Mantle" };
        public static readonly string[] CharmNames = { "Charm", "Talisman", "Amulet", "Token", "Sigil", "Ember Stone" };
        public static readonly string[] HeroicTitles = { "Dawnwarden", "Kingsmark", "Ashbreaker", "Hollowlight", "Ember-Sworn", "Regent's Bane" };
        public static readonly string[] CommonAdj = { "Worn", "Plain", "Sturdy", "Notched", "Rough", "Road-worn" };

        public static readonly Dictionary<string, EnemyDef> Enemies = new Dictionary<string, EnemyDef>
        {
            ["grunt"] = new EnemyDef { Id = "grunt", Name = "Ash Grunt", Hp = 44, Dmg = 8, Speed = 74, R = 13, Xp = 7, Gold0 = 2, Gold1 = 5, Windup = 0.45, Cd = 1.2, Range = 34, Drop = 0.07 },
            ["bowman"] = new EnemyDef { Id = "bowman", Name = "Ash Bowman", Hp = 30, Dmg = 7, Speed = 66, R = 12, Xp = 9, Gold0 = 3, Gold1 = 6, Windup = 0.5, Cd = 1.9, Range = 270, Keep = 190, Drop = 0.09, ProjSpeed = 270 },
            ["wisp"] = new EnemyDef { Id = "wisp", Name = "Ember Wisp", Hp = 17, Dmg = 6, Speed = 128, R = 10, Xp = 5, Gold0 = 1, Gold1 = 3, Windup = 0.25, Cd = 1.0, Range = 24, Drop = 0.04, Flying = true },
            ["brute"] = new EnemyDef { Id = "brute", Name = "Brute", Hp = 170, Dmg = 22, Speed = 44, R = 21, Xp = 36, Gold0 = 10, Gold1 = 18, Windup = 0.95, Cd = 2.2, Range = 56, SlamR = 78, Drop = 0.38 },
            ["regent"] = new EnemyDef { Id = "regent", Name = "The Ashen Regent", Hp = 1500, Dmg = 26, Speed = 62, R = 27, Xp = 420, Gold0 = 140, Gold1 = 180, Boss = true, Drop = 1 },
        };

        static List<(string, int)> W(params object[] a)
        {
            var l = new List<(string, int)>();
            for (int i = 0; i < a.Length; i += 2) l.Add(((string)a[i], (int)a[i + 1]));
            return l;
        }

        public static readonly StageDef[] Stages =
        {
            new StageDef { Id = "1", Num = 1, Name = "Millbrook Fields", Theme = "fields", Power = 105, NodeX = 0.10f, NodeY = 0.80f,
                Blurb = "The road begins among thatched cottages and hay-fields. Raiders have already burned the mill.",
                Waves = new List<List<(string, int)>> { W("grunt", 5), W("grunt", 4, "bowman", 2), W("grunt", 5, "bowman", 2, "wisp", 2) } },
            new StageDef { Id = "2", Num = 2, Name = "Hollow Wood", Theme = "wood", Power = 150, NodeX = 0.26f, NodeY = 0.55f,
                Blurb = "Dense forest, thick with log piles and ambush. Bowmen shoot from the shadows.",
                Waves = new List<List<(string, int)>> { W("grunt", 5, "bowman", 2), W("wisp", 5, "bowman", 3), W("grunt", 5, "brute", 1, "bowman", 2) } },
            new StageDef { Id = "3", Num = 3, Name = "Old Toll Bridge", Theme = "bridge", Power = 200, NodeX = 0.42f, NodeY = 0.74f,
                Blurb = "The warband holds the only crossing. Fight through the toll gate and over the river.",
                Waves = new List<List<(string, int)>> { W("grunt", 6, "bowman", 3), W("brute", 1, "grunt", 4, "wisp", 3), W("brute", 2, "bowman", 3, "grunt", 4) } },
            new StageDef { Id = "4", Num = 4, Name = "Ember Marsh", Theme = "marsh", Power = 255, NodeX = 0.58f, NodeY = 0.46f,
                Blurb = "Murky pools, dead trees and drowned ruins. Wisps drift in from the fog.",
                Waves = new List<List<(string, int)>> { W("wisp", 7, "grunt", 4), W("brute", 2, "bowman", 4, "wisp", 3), W("grunt", 7, "brute", 2, "bowman", 3) } },
            new StageDef { Id = "5", Num = 5, Name = "Highkeep Gate", Theme = "gate", Power = 315, NodeX = 0.74f, NodeY = 0.68f,
                Blurb = "The great gate of Highkeep, banners hung with ash. Only the courtyard stands between you and the hall.",
                Waves = new List<List<(string, int)>> { W("grunt", 7, "bowman", 4), W("brute", 2, "wisp", 5, "bowman", 3), W("brute", 3, "grunt", 6, "bowman", 4) } },
            new StageDef { Id = "6", Num = 6, Name = "The Throne Hall", Theme = "hall", Power = 385, NodeX = 0.90f, NodeY = 0.36f,
                Blurb = "The heir is bound before the throne. The Ashen Regent waits.",
                Waves = new List<List<(string, int)>> { W("grunt", 6, "bowman", 4), W("brute", 2, "wisp", 5, "grunt", 4), W("regent", 1) } },
        };
        public static readonly StageDef Vault = new StageDef
        {
            Id = "vault", Num = 7, Name = "The Deep Vaults", Theme = "vault", Power = 400, NodeX = 0.95f, NodeY = 0.80f,
            Blurb = "Endless vaults beneath Highkeep. A warlord waits every fifth floor.",
        };

        public static StageDef StageById(string id) => id == "vault" ? Vault : Stages[int.Parse(id) - 1];

        public const string EndingText = "The Regent falls, and the heir is freed from the throne-chains. The road is open again from " +
                                         "Millbrook to Highkeep. Beneath the hall, a stair leads down to the Deep Vaults...";
        public const string IntroText = "The king rode east and never returned. The Ashen Warband holds the road from Millbrook to Highkeep, " +
                                        "and the heir is held in the Throne Hall. Fight down the road and free the heir.";

        // ---- advancement ----
        public static double SkillMul(int lv) => 1 + 0.1 * (lv - 1);
        public static double SkillCdMul(int lv) => 1 - 0.03 * (lv - 1);
        public static (int gold, int steel) SkillUpCost(int lv) => ((int)Math.Round(70 * Math.Pow(lv, 1.5)), lv);

        public static readonly TraitBranch[] Traits =
        {
            new TraitBranch { Id = "might", Name = "Path of Might", Nodes = new[]
            {
                new TraitNode { Id = "m1", Name = "Honed Edge", Stat = "dmgPct", Per = 2, Text = "+2% damage" },
                new TraitNode { Id = "m2", Name = "Killing Eye", Stat = "crit", Per = 1.5, Text = "+1.5% crit" },
                new TraitNode { Id = "m3", Name = "Heavy Hand", Stat = "damage", Per = 1.2, Text = "+1.2 damage" },
                new TraitNode { Id = "m4", Name = "Executioner", Stat = "dmgPct", Per = 2.5, Text = "+2.5% damage" },
            } },
            new TraitBranch { Id = "guard", Name = "Path of the Warden", Nodes = new[]
            {
                new TraitNode { Id = "g1", Name = "Thick Skin", Stat = "armor", Per = 2, Text = "+2 armor" },
                new TraitNode { Id = "g2", Name = "Vital Spark", Stat = "hpPct", Per = 2, Text = "+2% health" },
                new TraitNode { Id = "g3", Name = "Iron Will", Stat = "hp", Per = 12, Text = "+12 health" },
                new TraitNode { Id = "g4", Name = "Bulwark", Stat = "armor", Per = 3, Text = "+3 armor" },
            } },
            new TraitBranch { Id = "swift", Name = "Path of the Road", Nodes = new[]
            {
                new TraitNode { Id = "s1", Name = "Fleet Foot", Stat = "speed", Per = 1.5, Text = "+1.5% speed" },
                new TraitNode { Id = "s2", Name = "Deep Well", Stat = "mp", Per = 8, Text = "+8 mana" },
                new TraitNode { Id = "s3", Name = "Flowing Mana", Stat = "regen", Per = 0.3, Text = "+0.3 mana/s" },
                new TraitNode { Id = "s4", Name = "Quick Study", Stat = "cdr", Per = 2, Text = "-2% cooldowns" },
            } },
        };

        public static int TraitPoints(SaveData s) => Math.Max(0, s.Level - 1);
        public static int TraitSpent(SaveData s) { int n = 0; foreach (var v in s.Traits.Values) n += v; return n; }
        public static int TraitResetCost(SaveData s) => 100 + s.Level * 20;

        public static readonly Dictionary<string, double> SigilPer = new Dictionary<string, double> { ["dmgPct"] = 1.5, ["hpPct"] = 2, ["armor"] = 1 };
        public static readonly (int lv, double goldPct, double xpPct, string text)[] SigilBoons =
        {
            (3, 5, 0, "+5% gold"), (6, 0, 8, "+8% experience"), (9, 10, 5, "+10% gold, +5% experience"),
        };
        public static (int gold, int steel) SigilCost(int lv) => ((int)Math.Round(150 * Math.Pow(lv + 1, 1.5)), lv + 2);

        public static readonly ArtifactDef[] Artifacts =
        {
            new ArtifactDef { Id = "compass", Name = "Ember Compass", Stat = "speed", Val = 4, Text = "% speed" },
            new ArtifactDef { Id = "seal", Name = "Kingsmark Seal", Stat = "hpPct", Val = 4, Text = "% health" },
            new ArtifactDef { Id = "ring", Name = "Ashen Ring", Stat = "armor", Val = 6, Text = " armor" },
            new ArtifactDef { Id = "chalice", Name = "Hollow Chalice", Stat = "regen", Val = 0.8, Text = " mana/s" },
            new ArtifactDef { Id = "die", Name = "Tollkeeper's Die", Stat = "crit", Val = 3, Text = "% crit" },
            new ArtifactDef { Id = "horn", Name = "Marsh Horn", Stat = "dmgPct", Val = 3, Text = "% damage" },
            new ArtifactDef { Id = "lantern", Name = "Wraith Lantern", Stat = "mp", Val = 20, Text = " mana" },
            new ArtifactDef { Id = "crown", Name = "Broken Crown", Stat = "cdr", Val = 4, Text = "% faster cooldowns" },
        };
        public static ArtifactDef ArtifactById(string id) { foreach (var a in Artifacts) if (a.Id == id) return a; return null; }
        public static double ArtValue(ArtifactDef a, int lv) => Math.Round(a.Val * (1 + 0.3 * (lv - 1)), 1);
        public static (int gold, int steel) ArtUpCost(int lv) => ((int)Math.Round(90 * Math.Pow(lv, 1.4)), 2 + lv);

        public static int ScoutCost(int n) => 150 + n * 120;
        public static readonly RouteDef[] Routes =
        {
            new RouteDef { Id = "patrol", Name = "Roadside Patrol", Mins = 2, Scouts = 1, Art = 0.12, Steel0 = 2, Steel1 = 4, Gold0 = 40, Gold1 = 90, Blurb = "A short sweep of the verge." },
            new RouteDef { Id = "cairn", Name = "Ruined Cairn", Mins = 20, Scouts = 2, Art = 0.4, Steel0 = 5, Steel1 = 9, Gold0 = 120, Gold1 = 220, Blurb = "Old stones, older things beneath them." },
            new RouteDef { Id = "barrow", Name = "Deep Barrow", Mins = 90, Scouts = 3, Art = 0.85, Steel0 = 10, Steel1 = 18, Gold0 = 260, Gold1 = 450, Blurb = "A king's barrow. Few come back with empty hands." },
        };
        public static RouteDef RouteById(string id) { foreach (var r in Routes) if (r.Id == id) return r; return null; }
        public static readonly string[] ScoutNames = { "Wren", "Tamsin", "Corvin", "Ilse", "Bram", "Odalys", "Hob", "Sable", "Rook", "Maud", "Fenn", "Lark" };
        public static readonly double[] ForgeChance = { 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2 };

        static D()
        {
            AffixKeys = new string[AffixList.Length];
            for (int i = 0; i < AffixList.Length; i++)
            {
                Affixes[AffixList[i].Key] = AffixList[i];
                AffixKeys[i] = AffixList[i].Key;
            }
        }
    }
}
