// Editor-side setup: import settings for the KayKit models and textures, and a one-time project bootstrap
// (linear colour space, a Main scene in the build list) so opening the project and pressing Play just works.
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Highkeep.EditorTools
{
    public sealed class HighkeepImport : AssetPostprocessor
    {
        const string Root = "Assets/HighkeepRoad/Resources/";

        static readonly string[] Loops =
        {
            "Idle", "Idle_Combat", "2H_Melee_Idle", "Running_A", "Running_B", "Running_C", "Walking_A", "Walking_D_Skeletons",
            "2H_Melee_Attack_Spinning", "Sit_Floor_Idle", "Sit_Chair_Idle", "Spellcasting",
        };

        static bool IsLoop(string clip)
        {
            int bar = clip.LastIndexOf('|');
            string n = bar >= 0 ? clip.Substring(bar + 1) : clip;
            foreach (var l in Loops) if (n == l) return true;
            return false;
        }

        void OnPreprocessModel()
        {
            if (!assetPath.StartsWith(Root + "Models/")) return;
            var mi = (ModelImporter)assetImporter;
            bool character = assetPath.Contains("/Characters/");
#if UNITY_2019_3_OR_NEWER
            mi.materialImportMode = ModelImporterMaterialImportMode.None;   // the game assigns its own shared materials
#endif
            mi.importCameras = false;
            mi.importLights = false;
            mi.importBlendShapes = false;
            mi.isReadable = false;
            mi.meshCompression = ModelImporterMeshCompression.Off;
            if (character)
            {
                mi.animationType = ModelImporterAnimationType.Generic;
                mi.importAnimation = true;
                mi.animationCompression = ModelImporterAnimationCompression.Optimal;
                mi.resampleCurves = true;
            }
            else
            {
                mi.animationType = ModelImporterAnimationType.None;
                mi.importAnimation = false;
                mi.addCollider = false;
            }
        }

        void OnPreprocessAnimation()
        {
            if (!assetPath.StartsWith(Root + "Models/Characters/")) return;
            var mi = (ModelImporter)assetImporter;
            var clips = mi.defaultClipAnimations;
            for (int i = 0; i < clips.Length; i++)
            {
                clips[i].loopTime = IsLoop(clips[i].takeName);
                clips[i].lockRootRotation = true;
                clips[i].lockRootHeightY = false;
                clips[i].keepOriginalOrientation = true;
                clips[i].keepOriginalPositionY = true;
                clips[i].keepOriginalPositionXZ = true;
            }
            mi.clipAnimations = clips;
        }

        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(Root)) return;
            var ti = (TextureImporter)assetImporter;
            if (assetPath.Contains("/Icons/"))
            {
                ti.textureType = TextureImporterType.Default;
                ti.alphaIsTransparency = true;
                ti.mipmapEnabled = false;
                ti.wrapMode = TextureWrapMode.Clamp;
                ti.textureCompression = TextureImporterCompression.Uncompressed;
            }
            else if (assetPath.Contains("/Ground/"))
            {
                ti.wrapMode = TextureWrapMode.Clamp;
                ti.maxTextureSize = 2048;
                ti.anisoLevel = 8;
                ti.textureCompression = TextureImporterCompression.CompressedHQ;
            }
            else if (assetPath.Contains("/Textures/"))
            {
                ti.wrapMode = TextureWrapMode.Repeat;
                ti.alphaIsTransparency = assetPath.Contains("grass");
                ti.sRGBTexture = !assetPath.Contains("detail");
            }
            else if (assetPath.Contains("/Models/"))
            {
                // KayKit atlases are flat colour swatches: keep them crisp and uncompressed
                ti.filterMode = FilterMode.Bilinear;
                ti.mipmapEnabled = true;
                ti.textureCompression = TextureImporterCompression.Uncompressed;
            }
        }
    }

    [InitializeOnLoad]
    public static class HighkeepBootstrap
    {
        const string ScenePath = "Assets/Scenes/Main.unity";

        static HighkeepBootstrap()
        {
            EditorApplication.delayCall += Setup;
        }

        static void Setup()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;
            if (PlayerSettings.colorSpace != ColorSpace.Linear) PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.productName = "Highkeep Road";
            PlayerSettings.companyName = "Highkeep";
            if (!File.Exists(ScenePath))
            {
                Directory.CreateDirectory("Assets/Scenes");
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                EditorSceneManager.SaveScene(scene, ScenePath);
                AssetDatabase.Refresh();
            }
            var list = EditorBuildSettings.scenes;
            if (list.Length == 0 || list[0].path != ScenePath)
                EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            var active = SceneManager.GetActiveScene();
            if (string.IsNullOrEmpty(active.path) && !active.isDirty) EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem("Highkeep/Open Main Scene")]
        static void OpenMain()
        {
            if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) EditorSceneManager.OpenScene(ScenePath);
        }

        [MenuItem("Highkeep/Delete Save")]
        static void DeleteSave()
        {
            var p = Path.Combine(Application.persistentDataPath, "save.json");
            if (File.Exists(p)) File.Delete(p);
            Debug.Log("Highkeep: save deleted (" + p + ")");
        }
    }
}
