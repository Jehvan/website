// Save model and JSON (de)serialisation. Field names in JSON match the Python version so saves stay readable.
using System;
using System.Collections.Generic;

namespace Highkeep.Core
{
    public sealed class Affix
    {
        public string K;
        public double V;
        public Affix Clone() => new Affix { K = K, V = V };
    }

    public sealed class Item
    {
        public string Id, Slot, Rarity, Name, Kind, Cls;
        public int Ilvl, Base, Plus, Fp;
        public int? Set;
        public bool Lock;
        public List<Affix> Aff = new List<Affix>();

        public Dictionary<string, object> ToJson()
        {
            var aff = new List<object>();
            foreach (var a in Aff) aff.Add(new Dictionary<string, object> { ["k"] = a.K, ["v"] = a.V });
            return new Dictionary<string, object>
            {
                ["id"] = Id, ["slot"] = Slot, ["rarity"] = Rarity, ["name"] = Name, ["kind"] = Kind, ["ilvl"] = Ilvl,
                ["base"] = Base, ["aff"] = aff, ["cls"] = Cls, ["set"] = Set.HasValue ? (object)Set.Value : null,
                ["plus"] = Plus, ["fp"] = Fp, ["lock"] = Lock,
            };
        }

        public static Item FromJson(object o)
        {
            var d = Json.Obj(o);
            if (d == null) return null;
            var it = new Item
            {
                Id = Json.Str(d, "id") ?? Items.Uid(), Slot = Json.Str(d, "slot"), Rarity = Json.Str(d, "rarity", "common"),
                Name = Json.Str(d, "name", "Item"), Kind = Json.Str(d, "kind", ""), Cls = Json.Str(d, "cls"),
                Ilvl = Json.Int(d, "ilvl", 1), Base = Json.Int(d, "base"), Plus = Json.Int(d, "plus"), Fp = Json.Int(d, "fp"),
                Lock = Json.Bool(d, "lock"),
                Set = Json.Has(d, "set") ? Json.Int(d, "set") : (int?)null,
            };
            foreach (var a in Json.Arr(d.TryGetValue("aff", out var al) ? al : null))
            {
                var ad = Json.Obj(a);
                it.Aff.Add(new Affix { K = Json.Str(ad, "k"), V = Json.Num(ad, "v") });
            }
            return it;
        }
    }

    public sealed class Scout
    {
        public string Id, Name;
        public int Rar;
    }

    public sealed class Exped
    {
        public string Route;
        public List<string> Scouts = new List<string>();
        public double Start, End;
    }

    public sealed class SaveData
    {
        public const int Version = 1;
        public string Cls = "knight";
        public int Level = 1, Xp, Gold = 60, Potions = 3, Cleared, VaultBest, Steel = 6, BagSize = D.BagSize, Sigil;
        public bool Story;
        public Dictionary<string, Item> Equip = new Dictionary<string, Item> { ["weapon"] = null, ["armor"] = null, ["charm"] = null };
        public List<Item> Bag = new List<Item>();
        public Dictionary<string, int> Research = new Dictionary<string, int>();
        public int[] SkillLv = { 1, 1, 1 };
        public Dictionary<string, int> Traits = new Dictionary<string, int>();
        public Dictionary<string, int> Artifacts = new Dictionary<string, int>();     // id -> level
        public string[] ArtSlots = new string[3];
        public List<Scout> Scouts = new List<Scout>();
        public List<Exped> Expeds = new List<Exped>();

        public static SaveData New(string cls, Func<double> R = null)
        {
            var s = new SaveData { Cls = cls };
            s.Equip["weapon"] = Items.RollItem(R ?? Items.DefaultRng, "weapon", 1, "common", cls);
            s.Equip["armor"] = Items.RollItem(R ?? Items.DefaultRng, "armor", 1, "common", cls);
            s.Scouts.Add(new Scout { Id = "scout0", Name = "Wren", Rar = 1 });
            return s;
        }

        public Item Eq(string slot) => Equip.TryGetValue(slot, out var it) ? it : null;

        public string ToJson()
        {
            var eq = new Dictionary<string, object>();
            foreach (var sl in D.Slots) eq[sl] = Eq(sl)?.ToJson();
            var bag = new List<object>();
            foreach (var it in Bag) bag.Add(it.ToJson());
            var research = new Dictionary<string, object>();
            foreach (var kv in Research) research[kv.Key] = kv.Value;
            var traits = new Dictionary<string, object>();
            foreach (var kv in Traits) traits[kv.Key] = kv.Value;
            var arts = new Dictionary<string, object>();
            foreach (var kv in Artifacts) arts[kv.Key] = new Dictionary<string, object> { ["lv"] = kv.Value };
            var scouts = new List<object>();
            foreach (var c in Scouts) scouts.Add(new Dictionary<string, object> { ["id"] = c.Id, ["name"] = c.Name, ["rar"] = c.Rar });
            var expeds = new List<object>();
            foreach (var e in Expeds)
                expeds.Add(new Dictionary<string, object> { ["route"] = e.Route, ["scouts"] = new List<object>(e.Scouts), ["start"] = e.Start, ["end"] = e.End });
            return Json.Write(new Dictionary<string, object>
            {
                ["v"] = Version, ["cls"] = Cls, ["level"] = Level, ["xp"] = Xp, ["gold"] = Gold, ["potions"] = Potions,
                ["equip"] = eq, ["bag"] = bag, ["cleared"] = Cleared, ["vault_best"] = VaultBest, ["story"] = Story,
                ["steel"] = Steel, ["research"] = research, ["bag_size"] = BagSize,
                ["skill_lv"] = new List<object> { SkillLv[0], SkillLv[1], SkillLv[2] }, ["traits"] = traits, ["sigil"] = Sigil,
                ["artifacts"] = arts, ["art_slots"] = new List<object> { ArtSlots[0], ArtSlots[1], ArtSlots[2] },
                ["scouts"] = scouts, ["expeds"] = expeds,
            });
        }

        public static SaveData FromJson(string text)
        {
            var d = Json.Obj(Json.Parse(text));
            if (d == null || Json.Int(d, "v") != Version || Json.Str(d, "cls") == null) return null;
            var s = new SaveData
            {
                Cls = Json.Str(d, "cls"), Level = Json.Int(d, "level", 1), Xp = Json.Int(d, "xp"), Gold = Json.Int(d, "gold"),
                Potions = Json.Int(d, "potions"), Cleared = Json.Int(d, "cleared"), VaultBest = Json.Int(d, "vault_best"),
                Story = Json.Bool(d, "story"), Steel = Json.Int(d, "steel"), BagSize = Json.Int(d, "bag_size", D.BagSize),
                Sigil = Json.Int(d, "sigil"),
            };
            if (!D.Classes.ContainsKey(s.Cls)) return null;
            var eq = Json.Obj(d.TryGetValue("equip", out var e) ? e : null);
            foreach (var sl in D.Slots) s.Equip[sl] = eq != null && eq.TryGetValue(sl, out var io) ? Item.FromJson(io) : null;
            foreach (var io in Json.Arr(d.TryGetValue("bag", out var b) ? b : null))
            {
                var it = Item.FromJson(io);
                if (it != null) s.Bag.Add(it);
            }
            var res = Json.Obj(d.TryGetValue("research", out var r) ? r : null);
            if (res != null) foreach (var kv in res) s.Research[kv.Key] = (int)Math.Round((double)kv.Value);
            var sk = Json.Arr(d.TryGetValue("skill_lv", out var skl) ? skl : null);
            for (int i = 0; i < 3 && i < sk.Count; i++) s.SkillLv[i] = (int)Math.Round((double)sk[i]);
            var tr = Json.Obj(d.TryGetValue("traits", out var t) ? t : null);
            if (tr != null) foreach (var kv in tr) s.Traits[kv.Key] = (int)Math.Round((double)kv.Value);
            var arts = Json.Obj(d.TryGetValue("artifacts", out var a) ? a : null);
            if (arts != null) foreach (var kv in arts) s.Artifacts[kv.Key] = Json.Int(Json.Obj(kv.Value), "lv", 1);
            var slots = Json.Arr(d.TryGetValue("art_slots", out var asl) ? asl : null);
            for (int i = 0; i < 3 && i < slots.Count; i++) s.ArtSlots[i] = slots[i] as string;
            foreach (var co in Json.Arr(d.TryGetValue("scouts", out var sc) ? sc : null))
            {
                var cd = Json.Obj(co);
                s.Scouts.Add(new Scout { Id = Json.Str(cd, "id"), Name = Json.Str(cd, "name", "Scout"), Rar = Json.Int(cd, "rar") });
            }
            if (s.Scouts.Count == 0) s.Scouts.Add(new Scout { Id = "scout0", Name = "Wren", Rar = 1 });
            foreach (var eo in Json.Arr(d.TryGetValue("expeds", out var ex) ? ex : null))
            {
                var ed = Json.Obj(eo);
                var x = new Exped { Route = Json.Str(ed, "route"), Start = Json.Num(ed, "start"), End = Json.Num(ed, "end") };
                foreach (var id in Json.Arr(ed.TryGetValue("scouts", out var ids) ? ids : null)) x.Scouts.Add(id as string);
                s.Expeds.Add(x);
            }
            return s;
        }
    }
}
