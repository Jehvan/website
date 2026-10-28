"""Headless Blender: KayKit glTF characters -> trimmed FBX for Unity (only the animations and props we use).

blender -b --factory-startup -P unity/Tools/blender_convert.py -- <kaykit root> <out dir>
"""
import json
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
ADV = os.path.join(SRC, "kaykit-character-pack-adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf")
SKL = os.path.join(SRC, "kaykit-character-pack-skeletons-1.0/addons/kaykit_character_pack_skeletons/Characters/gltf")

HERO = {"Idle", "Running_A", "Walking_A", "1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Chop", "1H_Melee_Attack_Slice_Horizontal",
        "2H_Melee_Attack_Spinning", "2H_Ranged_Shoot", "Block", "Dodge_Forward", "Dodge_Backward", "Cheer", "Use_Item",
        "Spellcast_Shoot", "Spellcast_Raise", "Spellcast_Long", "Hit_A", "Death_A", "Interact", "Sit_Floor_Idle"}
FOE = {"Idle", "Idle_Combat", "Running_A", "Running_C", "Walking_D_Skeletons", "1H_Melee_Attack_Chop", "2H_Melee_Attack_Chop",
       "2H_Melee_Attack_Slice", "1H_Ranged_Shoot", "2H_Ranged_Shoot", "Spellcast_Shoot", "Spellcast_Summon", "Spellcast_Raise",
       "Hit_A", "Death_A", "Spawn_Ground_Skeletons", "Taunt", "Jump_Full_Short", "Cheer"}

CHARS = [
    (ADV, "Knight", ["1H_Sword", "Round_Shield"], HERO),
    (ADV, "Mage", ["2H_Staff"], HERO),
    (ADV, "Rogue_Hooded", ["2H_Crossbow"], HERO),
    (ADV, "Rogue", ["Knife"], HERO),
    (ADV, "Barbarian", ["2H_Axe"], FOE),
    (SKL, "Skeleton_Minion", [], FOE),
    (SKL, "Skeleton_Rogue", [], FOE),
    (SKL, "Skeleton_Mage", [], FOE),
    (SKL, "Skeleton_Warrior", [], FOE),
]
WEAPON_NODES = {"1H_Sword_Offhand", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield", "1H_Sword", "2H_Sword",
                "Spellbook", "Spellbook_open", "1H_Wand", "2H_Staff", "Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Knife",
                "Throwable", "1H_Axe_Offhand", "Barbarian_Round_Shield", "1H_Axe", "2H_Axe", "Mug"}

SKW = os.path.join(SRC, "kaykit-character-pack-skeletons-1.0/addons/kaykit_character_pack_skeletons/Assets/gltf")
SKEL_WEAPONS = {
    "Skeleton_Minion": [("Skeleton_Axe", "r"), ("Skeleton_Shield_Small_A", "l")],
    "Skeleton_Rogue": [("Skeleton_Crossbow", "r")],
    "Skeleton_Mage": [("Skeleton_Staff", "r")],
    "Skeleton_Warrior": [("Skeleton_Blade", "r"), ("Skeleton_Shield_Large_A", "l")],
}


def gltf_local(t, q):
    """glTF node TRS (Y-up) -> Blender matrix (Z-up)."""
    from mathutils import Matrix, Quaternion
    qb = Quaternion((q[3], q[0], -q[2], q[1]))
    return Matrix.Translation((t[0], -t[2], t[1])) @ qb.to_matrix().to_4x4()


def bone_world(arm, name):
    return arm.matrix_world @ arm.data.bones[name].matrix_local


def handslot_offsets():
    """Offset from Blender's handslot bones to the glTF handslot frames, measured on the Knight's own sword and shield."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ADV, "Knight.glb"))
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    sword = bpy.data.objects["1H_Sword"]
    shield = bpy.data.objects["Round_Shield"]
    ls = gltf_local((0, 0.03330930517626057, 0), (0, -1, 0, 0))
    lsh = gltf_local((0, 0.01701178596925984, 0.15588533878326416), (0, 0, 0, 1))
    off_r = bone_world(arm, "handslot.r").inverted() @ (sword.matrix_world @ ls.inverted())
    off_l = bone_world(arm, "handslot.l").inverted() @ (shield.matrix_world @ lsh.inverted())
    return off_r, off_l


OFF_R, OFF_L = handslot_offsets()
report = {}
os.makedirs(OUT, exist_ok=True)
for folder, name, keep, ANIMS in CHARS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(folder, name + ".glb"))
    for ob in list(bpy.data.objects):
        base = ob.name.split(".")[0]
        # drop unused weapons and the importer's unparented bone-shape icosphere
        if (base in WEAPON_NODES and base not in keep) or (ob.type == "MESH" and ob.parent is None):
            bpy.data.objects.remove(ob, do_unlink=True)
    if name in SKEL_WEAPONS:
        arm0 = next(o for o in bpy.data.objects if o.type == "ARMATURE")
        arm0.data.pose_position = "REST"
        bpy.context.view_layer.update()
        for wname, side in SKEL_WEAPONS[name]:
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(SKW, wname + ".gltf"))
            new = [o for o in bpy.data.objects if o not in before]
            frame = bone_world(arm0, "handslot." + side) @ (OFF_R if side == "r" else OFF_L)
            for o in new:
                if o.parent is not None:
                    continue
                mw = frame @ o.matrix_world
                o.parent = arm0
                o.parent_type = "BONE"
                o.parent_bone = "handslot." + side
                bpy.context.view_layer.update()
                o.matrix_world = mw
        arm0.data.pose_position = "POSE"
        bpy.context.view_layer.update()
    names = []
    for act in list(bpy.data.actions):
        base = act.name.split("|")[-1]
        if base.endswith("_Rig"):
            base = base[:-4]
        if base not in ANIMS:
            bpy.data.actions.remove(act)
        else:
            act.name = base
            act.use_fake_user = True
            names.append(base)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    if arm.animation_data:
        arm.animation_data.action = bpy.data.actions.get("Idle")
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    zmax = max((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
    out = os.path.join(OUT, name + ".fbx")
    bpy.ops.export_scene.fbx(filepath=out, use_selection=False, object_types={"ARMATURE", "MESH", "EMPTY"},
                             apply_scale_options="FBX_SCALE_ALL", axis_forward="-Z", axis_up="Y",
                             add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True,
                             bake_anim_use_nla_strips=False, bake_anim_force_startend_keying=True,
                             bake_anim_simplify_factor=2.0, path_mode="STRIP", embed_textures=False)
    report[name] = {"anims": sorted(names), "height": round(zmax, 3), "size_mb": round(os.path.getsize(out) / 1e6, 2),
                    "armature": arm.name}
    print("EXPORTED", name, report[name]["size_mb"], "MB", len(names), "anims", "h", report[name]["height"])
with open(os.path.join(OUT, "_report.json"), "w") as f:
    json.dump(report, f, indent=1)
