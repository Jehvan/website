// Items, hero stat derivation, power score, forge/reforge, sets, research, artifacts and expeditions.
using System;
using System.Collections.Generic;
using System.Globalization;

namespace Highkeep.Core
{
    public sealed class HeroStats
    {
        public int MaxHp, MaxMp, Armor, Power;
        public double Damage, Crit, Speed, SpeedPct, Regen, Cdr, GoldPct, XpPct;
    }

    public sealed class ForgeInfo
    {
        public double Chance;
        public bool Guaranteed;
        public int Gold, Steel;
    }

    public sealed class ExpedResult
    {
        public int Steel, Gold;
        public string Found, Route;
    }

    public static class Items
    {
        static readonly Random Sys = new Random();
        public static readonly Func<double> DefaultRng = () => Sys.NextDouble();

        public static string Uid() => Guid.NewGuid().ToString("N").Substring(0, 10);

        public static RarityDef RarityOf(string id)
        {
            foreach (var r in D.Rarities) if (r.Id == id) return r;
            return D.Rarities[0];
        }

        public static int RarityIndex(Item it)
        {
            for (int i = 0; i < D.Rarities.Length; i++) if (D.Rarities[i].Id == it.Rarity) return i;
            return 0;
        }

        static T Pick<T>(IList<T> seq, Func<double> R) => seq[Math.Min(seq.Count - 1, (int)(R() * seq.Count))];

        public static double RoundDec(double v, int dec) => dec > 0 ? Math.Round(v, dec) : Math.Round(v);

        public static Affix RollAffix(string key, int ilvl, Func<double> R)
        {
            var a = D.Affixes[key];
            double scale = 1 + 0.3 * (ilvl - 1);
            double v = a.Base * scale * (0.8 + R() * 0.4);
            return new Affix { K = key, V = RoundDec(v, a.Dec) };
        }

        public static Item RollItem(Func<double> R, string slot, int ilvl, string rarity, string cls)
        {
            var rar = RarityOf(rarity);
            int n = rar.Affixes;
            if (slot == "charm" && n < 1) n = 1;
            var pool = new List<string>();
            foreach (var k in D.AffixKeys) if (!(slot == "weapon" && k == "armor")) pool.Add(k);
            var keys = new List<string>();
            while (keys.Count < n)
            {
                var k = Pick(pool, R);
                if (!keys.Contains(k)) keys.Add(k);
            }
            var aff = new List<Affix>();
            foreach (var k in keys) aff.Add(RollAffix(k, ilvl, R));
            int b = 0;
            string kind;
            double heroic = rarity == "heroic" ? 1.15 : 1;
            if (slot == "weapon")
            {
                kind = Pick(D.Classes[cls].WeaponKinds, R);
                b = (int)Math.Round((3 + 2.3 * ilvl) * (0.9 + R() * 0.2) * heroic);
            }
            else if (slot == "armor")
            {
                kind = Pick(D.ArmorNames, R);
                b = (int)Math.Round((3 + 3.2 * ilvl) * (0.9 + R() * 0.2) * heroic);
            }
            else kind = Pick(D.CharmNames, R);
            string name;
            if (rarity == "common") name = Pick(D.CommonAdj, R) + " " + kind;
            else if (rarity == "magic") name = D.Affixes[aff[0].K].Prefix + " " + kind;
            else if (rarity == "rare") name = D.Affixes[aff[0].K].Prefix + " " + kind + " " + D.Affixes[aff[1].K].Suffix;
            else name = Pick(D.HeroicTitles, R) + "'s " + kind;
            double chance = rarity == "common" ? 0 : rarity == "magic" ? 0.3 : rarity == "rare" ? 0.85 : 1;
            int? sid = null;
            if (R() < chance)
                sid = Math.Max(0, Math.Min(D.SetNames.Length - 1, (int)Math.Round(ilvl - 1 + (R() < 0.3 ? -1.0 : 0.0))));
            return new Item
            {
                Id = Uid(), Slot = slot, Rarity = rarity, Name = name, Kind = kind, Ilvl = ilvl, Base = b, Aff = aff,
                Cls = slot == "weapon" ? cls : null, Set = sid,
            };
        }

        public static string RollRarity(Func<double> R, double bonus = 0)
        {
            var w = new double[D.Rarities.Length];
            double sum = 0;
            for (int i = 0; i < w.Length; i++)
            {
                w[i] = D.Rarities[i].Weight * (i == 0 ? Math.Max(0.2, 1 - bonus) : 1 + bonus * i * 0.8);
                sum += w[i];
            }
            double t = R() * sum;
            for (int i = 0; i < w.Length; i++)
            {
                t -= w[i];
                if (t <= 0) return D.Rarities[i].Id;
            }
            return "common";
        }

        public static double ForgeMul(Item it) => 1 + 0.1 * it.Plus;

        public static int SellValue(Item it) => Math.Max(3, (int)Math.Round(7 * it.Ilvl * RarityOf(it.Rarity).Sell));

        public static Dictionary<string, double> NewTotals() => new Dictionary<string, double>
        { ["hp"] = 0, ["mp"] = 0, ["damage"] = 0, ["armor"] = 0, ["crit"] = 0, ["speed"] = 0, ["regen"] = 0 };

        public static Dictionary<string, double> ItemTotals(Item it)
        {
            var t = NewTotals();
            if (it == null) return t;
            double m = ForgeMul(it);
            if (it.Slot == "weapon") t["damage"] += it.Base * m;
            if (it.Slot == "armor") t["armor"] += it.Base * m;
            foreach (var a in it.Aff) t[a.K] += a.V * m;
            return t;
        }

        public static string DescribeAffix(Affix a, double mult = 1)
        {
            var d = D.Affixes[a.K];
            double v = RoundDec(a.V * mult, d.Dec);
            return string.Format(CultureInfo.InvariantCulture, d.Fmt, d.Dec > 0 ? v.ToString("0.##", CultureInfo.InvariantCulture) : ((int)v).ToString(CultureInfo.InvariantCulture));
        }

        // ---------- sets / research / advancement ----------
        public static Dictionary<int, int> SetCounts(Dictionary<string, Item> eq)
        {
            var c = new Dictionary<int, int>();
            foreach (var sl in D.Slots)
            {
                eq.TryGetValue(sl, out var it);
                if (it != null && it.Set.HasValue) c[it.Set.Value] = (c.TryGetValue(it.Set.Value, out var n) ? n : 0) + 1;
            }
            return c;
        }

        public static Dictionary<string, double> SetBonusTotals(Dictionary<string, Item> eq)
        {
            var o = new Dictionary<string, double>();
            foreach (var kv in SetCounts(eq))
            {
                double t = 1 + 0.35 * kv.Key;
                foreach (int need in new[] { 2, 3 })
                    if (kv.Value >= need)
                        foreach (var b in D.SetBonus(need, t)) o[b.Key] = (o.TryGetValue(b.Key, out var x) ? x : 0) + b.Value;
            }
            return o;
        }

        public static int ResearchLevel(int xp) => Math.Min(D.ResearchMax, (int)Math.Sqrt(Math.Max(0, xp) / 25.0));
        public static int ResearchNeed(int lv) => lv * lv * 25;

        public static Dictionary<string, double> ResearchTotals(SaveData s)
        {
            var o = new Dictionary<string, double> { ["armor"] = 0, ["damage"] = 0, ["hp"] = 0 };
            foreach (var xp in s.Research.Values)
            {
                int L = ResearchLevel(xp);
                o["armor"] += 2 * L;
                o["damage"] += L;
                o["hp"] += 6 * L;
            }
            return o;
        }

        public static int StudyValue(Item it) => (int)Math.Round(10 * RarityOf(it.Rarity).Sell * it.Ilvl) + it.Plus * 6;

        public static Dictionary<string, double> AdvanceTotals(SaveData s)
        {
            var t = new Dictionary<string, double>
            {
                ["hp"] = 0, ["mp"] = 0, ["damage"] = 0, ["armor"] = 0, ["crit"] = 0, ["speed"] = 0, ["regen"] = 0,
                ["dmgPct"] = 0, ["hpPct"] = 0, ["cdr"] = 0, ["goldPct"] = 0, ["xpPct"] = 0,
            };
            foreach (var br in D.Traits)
                foreach (var n in br.Nodes)
                    t[n.Stat] += n.Per * (s.Traits.TryGetValue(n.Id, out var p) ? p : 0);
            foreach (var kv in D.SigilPer) t[kv.Key] += kv.Value * s.Sigil;
            foreach (var b in D.SigilBoons)
                if (s.Sigil >= b.lv)
                {
                    t["goldPct"] += b.goldPct;
                    t["xpPct"] += b.xpPct;
                }
            foreach (var aid in s.ArtSlots)
            {
                if (aid == null) continue;
                var a = D.ArtifactById(aid);
                if (a != null && s.Artifacts.TryGetValue(aid, out var lv)) t[a.Stat] += D.ArtValue(a, lv);
            }
            return t;
        }

        public static bool TraitUnlocked(SaveData s, TraitBranch br, int idx)
        {
            int spent = 0;
            foreach (var n in br.Nodes) spent += s.Traits.TryGetValue(n.Id, out var p) ? p : 0;
            return spent >= idx * 3;
        }

        public static HeroStats HeroStats(SaveData s, Dictionary<string, Item> equipOverride = null)
        {
            var c = D.Classes[s.Cls];
            int L = s.Level;
            var eq = equipOverride ?? s.Equip;
            var g = NewTotals();
            foreach (var sl in D.Slots)
            {
                eq.TryGetValue(sl, out var it);
                foreach (var kv in ItemTotals(it)) g[kv.Key] += kv.Value;
            }
            foreach (var kv in SetBonusTotals(eq)) g[kv.Key] += kv.Value;
            foreach (var kv in ResearchTotals(s)) g[kv.Key] += kv.Value;
            var x = AdvanceTotals(s);
            foreach (var k in new[] { "hp", "mp", "damage", "armor", "crit", "regen", "speed" }) g[k] += x[k];
            var h = new HeroStats
            {
                MaxHp = (int)Math.Round((c.Hp + D.PerLevelHp * (L - 1) + g["hp"]) * (1 + x["hpPct"] / 100)),
                MaxMp = (int)Math.Round(c.Mp + D.PerLevelMp * (L - 1) + g["mp"]),
                Damage = Math.Round((c.Damage + D.PerLevelDamage * (L - 1) + g["damage"]) * (1 + x["dmgPct"] / 100), 1),
                Armor = (int)Math.Round(g["armor"]),
                Crit = Math.Round(5 + g["crit"], 1),
                Speed = Math.Round(c.Speed * (1 + g["speed"] / 100), 1),
                SpeedPct = g["speed"],
                Regen = Math.Round(c.ManaRegen + g["regen"], 2),
                Cdr = x["cdr"], GoldPct = x["goldPct"], XpPct = x["xpPct"],
            };
            h.Power = PowerOf(h);
            return h;
        }

        public static int PowerOf(HeroStats s) => (int)Math.Round(s.MaxHp * 0.2 + s.MaxMp * 0.1 + s.Damage * 3.2 + s.Armor * 2 + s.Crit * 2
                                                                + s.SpeedPct * 0.8 + s.Regen * 3 - 8);

        public static double ArmorMul(double armor) => 120 / (120 + armor);

        public static int AddXp(SaveData s, int amount)
        {
            int gained = 0;
            if (s.Level >= D.MaxLevel) return 0;
            s.Xp += amount;
            while (s.Level < D.MaxLevel && s.Xp >= D.XpToNext(s.Level))
            {
                s.Xp -= D.XpToNext(s.Level);
                s.Level++;
                gained++;
            }
            if (s.Level >= D.MaxLevel) s.Xp = 0;
            return gained;
        }

        // ---------- forge / reforge / dismantle ----------
        public static ForgeInfo GetForgeInfo(Item it)
        {
            if (it.Plus >= D.MaxPlus) return null;
            bool g = it.Fp >= 100;
            return new ForgeInfo
            {
                Chance = g ? 1.0 : D.ForgeChance[it.Plus], Guaranteed = g,
                Gold = (int)Math.Round(25 * (it.Plus + 1) * (1 + it.Ilvl * 0.5)),
                Steel = 1 + it.Plus + (RarityIndex(it) >= 2 ? 1 : 0),
            };
        }

        public static bool ForgeAttempt(Item it, Func<double> R = null)
        {
            R = R ?? DefaultRng;
            var info = GetForgeInfo(it);
            if (info == null) return false;
            if (R() < info.Chance)
            {
                it.Plus++;
                it.Fp = 0;
                return true;
            }
            it.Fp = Math.Min(100, it.Fp + 20 + (int)(R() * 10));
            return false;
        }

        public static (int gold, int steel) ReforgeCost(Item it)
        {
            int ri = RarityIndex(it);
            return (40 * it.Ilvl + 20 * ri * it.Ilvl, 2 + ri);
        }

        public static bool CanReforge(Item it) => RarityIndex(it) >= 1 && it.Aff.Count > 0;

        public static void ReforgeAffix(Item it, int idx, Func<double> R = null)
        {
            R = R ?? DefaultRng;
            var have = new List<string>();
            foreach (var a in it.Aff) have.Add(a.K);
            var pool = new List<string>();
            foreach (var k in D.AffixKeys) if (!have.Contains(k) && !(it.Slot == "weapon" && k == "armor")) pool.Add(k);
            it.Aff[idx] = RollAffix(Pick(pool, R), it.Ilvl, R);
        }

        public static int DismantleValue(Item it)
            => Math.Max(1, (int)Math.Round(new[] { 1, 2, 4, 8 }[RarityIndex(it)] * (1 + it.Ilvl * 0.35)) + it.Plus);

        // ---------- artifacts & expeditions ----------
        public static string GrantArtifact(SaveData s, Func<double> R = null)
        {
            R = R ?? DefaultRng;
            var a = Pick(D.Artifacts, R);
            if (!s.Artifacts.TryGetValue(a.Id, out var lv))
            {
                s.Artifacts[a.Id] = 1;
                return "New artifact: " + a.Name;
            }
            if (lv < D.ArtMax)
            {
                s.Artifacts[a.Id] = lv + 1;
                return a.Name + " rose to level " + (lv + 1);
            }
            s.Steel += 4;
            return a.Name + " is maxed (+4 steel)";
        }

        public static Scout NewScout(Func<double> R = null)
        {
            R = R ?? DefaultRng;
            var w = new[] { 50, 32, 14, 4 };
            double t = R() * 100;
            int rar = 0;
            for (int i = 0; i < w.Length; i++)
            {
                t -= w[i];
                if (t <= 0) { rar = i; break; }
            }
            return new Scout { Id = Uid(), Name = Pick(D.ScoutNames, R), Rar = rar };
        }

        public static double ScoutBonus(List<Scout> crew)
        {
            double b = 0;
            foreach (var c in crew) b += 0.05 * (c.Rar + 1);
            return b;
        }

        public static double ExpeditionOdds(RouteDef r, List<Scout> crew) => Math.Min(0.97, r.Art + ScoutBonus(crew) - 0.05 * crew.Count);

        public static ExpedResult ResolveExpedition(SaveData s, Exped ex, Func<double> R = null)
        {
            R = R ?? DefaultRng;
            var route = D.RouteById(ex.Route);
            var crew = s.Scouts.FindAll(c => ex.Scouts.Contains(c.Id));
            int steel = (int)Math.Round(route.Steel0 + R() * (route.Steel1 - route.Steel0));
            int gold = (int)Math.Round(route.Gold0 + R() * (route.Gold1 - route.Gold0));
            s.Steel += steel;
            s.Gold += gold;
            string found = R() < ExpeditionOdds(route, crew) ? GrantArtifact(s, R) : null;
            return new ExpedResult { Steel = steel, Gold = gold, Found = found, Route = route.Name };
        }

        public static double NowSeconds() => (DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
    }
}
