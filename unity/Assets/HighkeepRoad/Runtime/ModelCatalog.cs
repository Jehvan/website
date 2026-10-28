// Every 3D model the game uses, in one table: which file, which texture atlas, how tall it should stand.
// To swap art (for example to a grittier commercial pack), change the paths/heights here; nothing else needs to know.
using System.Collections.Generic;
using UnityEngine;

namespace Highkeep
{
    public sealed class ModelSpec
    {
        public string Key, Path, Texture;
        public float Height;          // target height in metres (0 = use Scale)
        public float Scale = 1f;
        public float Yaw;             // extra yaw to make the model face +Z
        public float Sink;            // push the base below ground (trees, rocks)
        public float Rim = 0.12f;
        public bool Center = true, CastShadows = true;
        public Color Tint = Color.white;
    }

    public sealed class CharSpec
    {
        public ModelSpec Model;
        public string Idle = "Idle", Run = "Running_A", Walk = "Walking_A", Hit = "Hit_A", Death = "Death_A";
        public string[] Attacks = { "1H_Melee_Attack_Chop" };
        public string Spawn;
        public float RunRef = 4.5f;        // metres/second at which the run cycle plays at speed 1
        public bool Hover;
    }

    public static class ModelCatalog
    {
        const string C = "Models/Characters/", HX = "Models/Hex/", DG = "Models/Dungeon/";
        const string HexTex = HX + "hexagons_medieval", DunTex = DG + "dungeon_texture";

        static ModelSpec Hex(string name, float h, float sink = 0, bool shadows = true) =>
            new ModelSpec { Key = name, Path = HX + name, Texture = HexTex, Height = h, Sink = sink, CastShadows = shadows };

        static ModelSpec Dun(string name, float h, float sink = 0) =>
            new ModelSpec { Key = name, Path = DG + name, Texture = DunTex, Height = h, Sink = sink };

        static ModelSpec Chr(string name, string tex, float h, Color? tint = null) =>
            new ModelSpec { Key = name + (tint.HasValue ? "_" + tint.Value : ""), Path = C + name, Texture = C + tex, Height = h, Center = false, Rim = 0.45f, Tint = tint ?? Color.white };

        // ---------------------------------------------------------------- characters
        public static readonly Dictionary<string, CharSpec> Chars = new Dictionary<string, CharSpec>
        {
            ["knight"] = new CharSpec { Model = Chr("Knight", "knight_texture", 2.15f), Attacks = new[] { "1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Slice_Horizontal", "1H_Melee_Attack_Chop" } },
            ["ranger"] = new CharSpec { Model = Chr("Rogue_Hooded", "rogue_texture", 2.0f), Attacks = new[] { "2H_Ranged_Shoot" }, RunRef = 5f },
            ["mage"] = new CharSpec { Model = Chr("Mage", "mage_texture", 2.25f), Attacks = new[] { "Spellcast_Shoot" } },
            ["grunt"] = new CharSpec { Model = Chr("Skeleton_Minion", "skeleton_texture", 1.95f), Attacks = new[] { "1H_Melee_Attack_Chop" }, Run = "Running_A", Walk = "Walking_D_Skeletons", Spawn = "Spawn_Ground_Skeletons", Idle = "Idle_Combat", RunRef = 3.2f },
            ["bowman"] = new CharSpec { Model = Chr("Skeleton_Rogue", "skeleton_texture", 2.0f), Attacks = new[] { "1H_Ranged_Shoot" }, Spawn = "Spawn_Ground_Skeletons", Idle = "Idle_Combat", RunRef = 3.2f },
            ["wisp"] = new CharSpec { Model = Chr("Skeleton_Mage", "skeleton_texture", 1.9f, new Color(1f, 0.82f, 0.7f)), Attacks = new[] { "Spellcast_Shoot" }, Run = "Running_C", Spawn = "Spawn_Ground_Skeletons", Hover = true, RunRef = 5f },
            ["brute"] = new CharSpec { Model = Chr("Skeleton_Warrior", "skeleton_texture", 3.0f), Attacks = new[] { "2H_Melee_Attack_Chop" }, Walk = "Walking_D_Skeletons", Spawn = "Spawn_Ground_Skeletons", Idle = "Idle_Combat", RunRef = 2.2f },
            ["regent"] = new CharSpec { Model = Chr("Barbarian", "barbarian_texture", 4.2f, new Color(0.62f, 0.58f, 0.62f)), Attacks = new[] { "2H_Melee_Attack_Chop" }, Idle = "Idle_Combat", RunRef = 3f },
            // town folk
            ["villager"] = new CharSpec { Model = Chr("Rogue", "rogue_texture", 2.0f) },
            ["guard"] = new CharSpec { Model = Chr("Knight", "knight_texture", 2.15f, new Color(0.85f, 0.88f, 1f)) },
            ["smith"] = new CharSpec { Model = Chr("Barbarian", "barbarian_texture", 2.2f) },
            ["heir"] = new CharSpec { Model = Chr("Rogue", "rogue_texture", 1.9f, new Color(0.8f, 0.85f, 1f)), Idle = "Sit_Floor_Idle" },
        };

        // ---------------------------------------------------------------- props (layout kind -> model choices)
        public static readonly Dictionary<string, ModelSpec[]> Props = new Dictionary<string, ModelSpec[]>
        {
            ["tree"] = new[] { Hex("tree_single_A", 7.2f, -0.4f), Hex("tree_single_B", 7.6f, -0.4f), Hex("trees_A_medium", 6.2f, -0.3f) },
            ["pine"] = new[] { Hex("tree_single_B", 8.4f, -0.4f), Hex("tree_single_A", 8.0f, -0.4f) },
            ["deadtree"] = new[] { Hex("tree_single_A_cut", 1.4f, -0.1f) },
            ["rock"] = new[] { Hex("rock_single_A", 0.55f), Hex("rock_single_B", 0.8f), Hex("rock_single_C", 0.6f), Hex("rock_single_D", 0.9f), Hex("rock_single_E", 0.7f) },
            ["hay"] = new[] { Hex("sack", 1.1f), Hex("resource_lumber", 1.0f) },
            ["logs"] = new[] { Hex("resource_lumber", 1.4f) },
            ["fence"] = new[] { Hex("fence_wood_straight", 1.2f) },
            ["cottage"] = new[] { Hex("building_home_A_red", 5.6f), Hex("building_home_B_red", 7.2f), Hex("building_home_A_blue", 5.6f), Hex("building_home_B_blue", 7.2f) },
            ["lamp"] = new[] { Dun("torch_lit", 2.4f, -0.2f) },
            ["brazier"] = new[] { Dun("torch_lit", 2.6f, -0.2f) },
            ["pillar"] = new[] { Dun("pillar_decorated", 5.0f) },
            ["column"] = new[] { Dun("column", 2.6f) },
            ["ruin"] = new[] { Dun("wall_broken", 3.2f), Dun("rubble_half", 1.6f) },
            ["bridge"] = new[] { Hex("building_bridge_A", 3.0f) },
            ["tower"] = new[] { Hex("building_tower_A_red", 11f) },
            ["wall"] = new[] { Hex("wall_straight", 5.5f) },
            ["portcullis"] = new[] { Hex("wall_straight_gate", 6f) },
            ["banner"] = new[] { Dun("banner_patternA_red", 4.2f) },
            ["throne"] = new[] { Dun("chair", 3.6f) },
            ["tent"] = new[] { Hex("tent", 3.4f) },
            ["tent_blue"] = new[] { Hex("tent", 3.4f) },
            ["camp_tent"] = new[] { Hex("tent", 3.0f) },
            ["standard"] = new[] { Hex("flag_red", 3.6f) },
            ["rack"] = new[] { Hex("weaponrack", 1.6f) },
            ["barrel"] = new[] { Hex("barrel", 1.05f) },
            ["crate"] = new[] { Hex("crate_A_big", 1.0f), Hex("crate_B_small", 0.8f) },
            ["well"] = new[] { Hex("building_well_red", 4.2f) },
            ["cart"] = new[] { Hex("wheelbarrow", 0.9f) },
            ["palisade"] = new[] { Hex("fence_stone_straight", 1.8f) },
            ["campfire"] = new[] { Hex("resource_lumber", 0.6f) },
            ["sarcophagus"] = new[] { Dun("trunk_large_A", 1.3f) },
            ["bones"] = new[] { Dun("rubble_half", 0.7f) },
            ["reeds"] = new[] { Hex("waterplant_A", 1.0f), Hex("waterplant_B", 1.1f) },
            ["forge"] = new[] { Hex("building_blacksmith_red", 4.4f) },
            ["market"] = new[] { Hex("building_market_red", 5.0f) },
            ["tavern"] = new[] { Hex("building_tavern_red", 8.5f) },
            ["windmill"] = new[] { Hex("building_windmill_red", 10f) },
            ["church"] = new[] { Hex("building_church_red", 10f) },
            ["mountain"] = new[] { Hex("mountain_A_grass_trees", 16f, 0, false), Hex("mountain_B_grass_trees", 18f, 0, false), Hex("hills_A_trees", 9f, 0, false) },
            ["hallwall"] = new[] { Dun("wall", 5.0f) },
            ["hallwindow"] = new[] { Dun("wall_window_closed", 5.0f) },
            ["torch_wall"] = new[] { Dun("torch_mounted", 1.6f) },
            ["chest"] = new[] { Dun("chest", 1.0f) },
            ["keg"] = new[] { Dun("keg_decorated", 1.4f) },
            ["table"] = new[] { Dun("table_long_decorated_A", 1.4f) },
            ["stack"] = new[] { Dun("box_stacked", 2.4f) },
        };

        /// <summary>Deterministic variant for a prop so a stage looks the same on every visit.</summary>
        public static ModelSpec Pick(string kind, double x, double y)
        {
            if (!Props.TryGetValue(kind, out var arr) || arr.Length == 0) return null;
            int h = Mathf.Abs((int)(x * 7.13 + y * 3.71));
            return arr[h % arr.Length];
        }
    }
}
