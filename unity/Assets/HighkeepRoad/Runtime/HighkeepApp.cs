// Highkeep Road for Unity: boots itself into any scene, owns the save, the simulation, the 3D view and the UI.
//
// Controls (Kingsroad style): left-click the ground to walk there (hold to keep walking towards the cursor),
// left-click an enemy to attack it until it falls, 1/2/3 skills aimed at your target or the cursor, F potion,
// Shift+click to attack in place, WASD also moves, scroll wheel zooms, Esc pauses.
using System;
using System.Collections.Generic;
using System.IO;
using Highkeep.Core;
using UnityEngine;

namespace Highkeep
{
    public sealed class HighkeepApp : MonoBehaviour
    {
        public SaveData Save;
        public string Quality = "high";
        public string Mode = "title";            // title | camp | stage | result
        Game game;
        readonly GameInput input = new GameInput();
        CameraRig rig;
        StageView stage, hub;
        readonly Hud hud = new Hud();
        Screens screens;
        StageResult lastResult;
        float accum, hubT;

        // input state gathered from IMGUI events (works with either Unity input backend)
        readonly HashSet<KeyCode> held = new HashSet<KeyCode>();
        Vector2 mouseGui;
        bool mouseHeld, holdIsMove, shiftHeld;
        int hoverId;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
#if UNITY_2023_1_OR_NEWER
            if (FindFirstObjectByType<HighkeepApp>() != null) return;
#else
            if (FindObjectOfType<HighkeepApp>() != null) return;
#endif
            var go = new GameObject("Highkeep Road");
            DontDestroyOnLoad(go);
            go.AddComponent<HighkeepApp>();
        }

        static string SavePath => Path.Combine(Application.persistentDataPath, "save.json");
        static string SettingsPath => Path.Combine(Application.persistentDataPath, "settings.txt");

        void Awake()
        {
            Application.targetFrameRate = 60;
#if UNITY_2023_1_OR_NEWER
            var cams = FindObjectsByType<Camera>(FindObjectsSortMode.None);
            var lights = FindObjectsByType<Light>(FindObjectsSortMode.None);
#else
            var cams = FindObjectsOfType<Camera>();
            var lights = FindObjectsOfType<Light>();
#endif
            // the game builds its own camera and lights; switch off whatever the scene template had
            foreach (var cam in cams) cam.gameObject.SetActive(false);
            foreach (var l in lights) l.gameObject.SetActive(false);
            try { if (File.Exists(SettingsPath)) Quality = File.ReadAllText(SettingsPath).Trim() == "low" ? "low" : "high"; } catch (Exception) { }
            rig = new CameraRig();
            ApplyQuality();
            screens = new Screens(this);
            Ui.Init();
            try { if (File.Exists(SavePath)) Save = SaveData.FromJson(File.ReadAllText(SavePath)); }
            catch (Exception e) { Debug.LogWarning("Highkeep: could not read save: " + e.Message); }
            ShowHub();
        }

        void ApplyQuality()
        {
            bool hi = Quality == "high";
            QualitySettings.shadows = ShadowQuality.All;
            QualitySettings.shadowResolution = hi ? ShadowResolution.VeryHigh : ShadowResolution.Medium;
            QualitySettings.shadowDistance = hi ? 70f : 45f;
            QualitySettings.shadowCascades = hi ? 2 : 1;
            QualitySettings.pixelLightCount = hi ? 6 : 2;
            QualitySettings.antiAliasing = hi ? 4 : 0;
            QualitySettings.anisotropicFiltering = AnisotropicFiltering.Enable;
            QualitySettings.vSyncCount = 1;
            if (rig != null) rig.Post.Enabled = hi;
        }

        public void SetQuality(string q)
        {
            Quality = q;
            try { File.WriteAllText(SettingsPath, q); } catch (Exception) { }
            ApplyQuality();
        }

        public void Persist()
        {
            if (Save == null) return;
            try
            {
                Directory.CreateDirectory(Application.persistentDataPath);
                string tmp = SavePath + ".tmp";
                File.WriteAllText(tmp, Save.ToJson());
                if (File.Exists(SavePath)) File.Delete(SavePath);
                File.Move(tmp, SavePath);
            }
            catch (Exception e) { Debug.LogWarning("Highkeep: could not write save: " + e.Message); }
        }

        void OnApplicationQuit() => Persist();
        void OnApplicationFocus(bool focus)
        {
            if (!focus)
            {
                held.Clear();
                mouseHeld = false;
            }
        }

        // ---------------------------------------------------------------- flow
        void ShowHub()
        {
            if (hub != null) return;
            stage?.Destroy();
            stage = null;
            var L = Res.LoadLayout("town", 3, false, 0);
            hub = new StageView(L, "ground_town", true);
            rig.Post.Theme = hub.Th;
            string cls = Save != null ? Save.Cls : "knight";
            hub.AddNpc(cls == "knight" ? "knight" : cls == "ranger" ? "ranger" : "mage", new Vector2(780, 810));
            hub.AddNpc("guard", new Vector2(520, 560), new Vector2(620, 700));
            hub.AddNpc("guard", new Vector2(1100, 560), new Vector2(1170, 700));
            hub.AddNpc("villager", new Vector2(720, 470), new Vector2(900, 470), new Vector2(980, 560));
            hub.AddNpc("smith", new Vector2(470, 690));
            hub.AddNpc("villager", new Vector2(560, 760), new Vector2(690, 700));
            hub.AddNpc("mage", new Vector2(1050, 640), new Vector2(1050, 560));
            hubT = 0;
        }

        void HideHub()
        {
            hub?.Destroy();
            hub = null;
        }

        public void PickClass(string cls)
        {
            Save = SaveData.New(cls);
            Persist();
            HideHub();
            ToCamp();
        }

        public void ContinueGame()
        {
            if (Save != null) ToCamp();
        }

        public void ToTitle()
        {
            Persist();
            StopStage();
            Mode = "title";
            ShowHub();
        }

        public void ToCamp()
        {
            StopStage();
            Persist();
            Mode = "camp";
            ShowHub();
        }

        void StopStage()
        {
            if (game != null) game.Mode = "idle";
            stage?.Destroy();
            stage = null;
            mouseHeld = false;
            held.Clear();
        }

        public void March(string sid, int floor)
        {
            if (Save == null) return;
            if (sid == "vault" ? Save.Cleared < 6 : int.Parse(sid) > Save.Cleared + 1) return;
            HideHub();
            stage?.Destroy();
            game = new Game(Save) { LayoutProvider = Res.LoadLayout };
            game.OnEnd = OnStageEnd;
            game.StartStage(sid, floor);
            var d = D.StageById(sid);
            string ground = sid == "vault" ? (floor % 5 == 0 ? "ground_vault_boss" : "ground_vault") : "ground_" + d.Theme;
            stage = new StageView(game.L, ground);
            rig.Post.Theme = stage.Th;
            rig.Distance = 23f;
            rig.Snap();
            input.HasDest = false;
            input.TargetId = 0;
            input.Attack = false;
            Mode = "stage";
            accum = 0;
        }

        void OnStageEnd(StageResult r)
        {
            Persist();
            lastResult = r;
            Mode = "result";
            mouseHeld = false;
        }

        public void Resume()
        {
            if (game != null) game.Paused = false;
        }

        public void QuitStage()
        {
            if (game != null) game.Paused = false;
            ToCamp();
        }

        // ---------------------------------------------------------------- frame
        void Update()
        {
            float dt = Mathf.Min(0.1f, Time.deltaTime);
            if (stage != null && game != null && (Mode == "stage" || Mode == "result"))
            {
                if (Mode == "stage" && !game.Paused)
                {
                    ReadInput();
                    accum += dt;
                    int n = 0;
                    while (accum >= 1f / 60f && n < 5)
                    {
                        game.Update(1.0 / 60.0, input);
                        accum -= 1f / 60f;
                        n++;
                    }
                    if (n >= 5) accum = 0;
                }
                var focus = W3.Pos(game.P.X, game.P.Y);
                stage.Sync(game, input, game.Paused ? 0f : dt, hoverId);
                stage.Tick(dt, focus);
                var L = game.L;
                rig.Follow(focus, new Rect(0, -(float)L.H * W3.S, (float)L.W * W3.S, (float)L.H * W3.S), dt, (float)game.Shake);
            }
            else if (hub != null)
            {
                hubT += dt;
                hub.TickNpcs(dt);
                var c = W3.Pos(800, 640);
                hub.Tick(dt, c);
                rig.Distance = 30f;
                // camp: plaza sits left of the side panel; title: centred
                var look = c + new Vector3(Mode == "camp" ? 7.5f : 0f, 0, Mode == "camp" ? -1.5f : -2f) + new Vector3(Mathf.Sin(hubT * 0.12f) * 0.8f, 0, 0);
                rig.Place(look, 0, Mathf.Sin(hubT * 0.07f) * 6f);
            }
        }

        Vector2 MouseScreen => new Vector2(mouseGui.x, Screen.height - mouseGui.y);

        void ReadInput()
        {
            float mx = (held.Contains(KeyCode.D) || held.Contains(KeyCode.RightArrow) ? 1 : 0) - (held.Contains(KeyCode.A) || held.Contains(KeyCode.LeftArrow) ? 1 : 0);
            float my = (held.Contains(KeyCode.S) || held.Contains(KeyCode.DownArrow) ? 1 : 0) - (held.Contains(KeyCode.W) || held.Contains(KeyCode.UpArrow) ? 1 : 0);
            if (mx != 0 && my != 0)
            {
                mx *= 0.7071f;
                my *= 0.7071f;
            }
            input.MoveX = mx;
            input.MoveY = my;
            hoverId = PickEnemy(MouseScreen);
            if (rig.Ground(MouseScreen, out var hit))
            {
                var w = W3.ToWorld(hit);
                input.HasAim = true;
                input.AimX = w.x;
                input.AimY = w.y;
                if (mouseHeld && holdIsMove && !shiftHeld)
                {
                    input.HasDest = true;
                    input.DestX = w.x;
                    input.DestY = w.y;
                }
            }
            input.Attack = held.Contains(KeyCode.Space) || (mouseHeld && shiftHeld);
        }

        /// <summary>Enemy under the cursor: nearest projected body within a generous screen radius.</summary>
        int PickEnemy(Vector2 screen)
        {
            if (game == null) return 0;
            int best = 0;
            float bd = float.MaxValue;
            float u = Ui.U;
            foreach (var e in game.Enemies)
            {
                if (!Game.Targetable(e)) continue;
                float h = e.Type == "brute" ? 1.4f : e.Type == "regent" ? 2f : 1f;
                var sp = rig.Cam.WorldToScreenPoint(W3.Pos(e.X, e.Y, h));
                if (sp.z < 0) continue;
                float r = ((float)e.R * W3.S * 900f / Mathf.Max(1f, sp.z) + 18f) * u;
                float d = Vector2.Distance(screen, new Vector2(sp.x, sp.y));
                if (d < r * 1.6f && d < bd)
                {
                    bd = d;
                    best = e.Id;
                }
            }
            return best;
        }

        void WorldClick(Vector2 gui, bool shift)
        {
            if (game == null || game.P.Dead) return;
            var screen = new Vector2(gui.x, Screen.height - gui.y);
            int id = PickEnemy(screen);
            mouseHeld = true;
            if (shift)
            {
                holdIsMove = false;
                input.HasDest = false;
                return;
            }
            if (id != 0)
            {
                input.TargetId = id;
                input.HasDest = false;
                holdIsMove = false;
                return;
            }
            if (rig.Ground(screen, out var hit))
            {
                var w = W3.ToWorld(hit);
                input.TargetId = 0;
                input.HasDest = true;
                input.DestX = w.x;
                input.DestY = w.y;
                holdIsMove = true;
                stage?.ShowClick(hit);
            }
        }

        // ---------------------------------------------------------------- UI + events
        void OnGUI()
        {
            Ui.U = Mathf.Clamp(Screen.height / 760f, 0.8f, 1.6f);
            var e = Event.current;
            mouseGui = e.mousePosition;
            shiftHeld = e.shift;

            if (e.type == EventType.KeyDown && e.keyCode != KeyCode.None)
            {
                bool first = held.Add(e.keyCode);
                if (first) OnKey(e.keyCode);
            }
            else if (e.type == EventType.KeyUp) held.Remove(e.keyCode);
            if (e.type == EventType.MouseUp && e.button == 0) mouseHeld = false;
            if (e.type == EventType.ScrollWheel && Mode == "stage") rig.Zoom(e.delta.y * 0.8f);

            switch (Mode)
            {
                case "title":
                    screens.Title();
                    break;
                case "camp":
                    screens.Camp();
                    break;
                case "stage":
                    if (game == null) break;
                    hud.Draw(game, input, rig.Cam, hoverId, Time.deltaTime);
                    if (Ui.Button(hud.PauseRect, "II", Btn.Normal, true, 18 * Ui.U)) TogglePause();
                    for (int i = 0; i < 4; i++)
                        if (Ui.Hot(hud.SlotRects[i]))
                        {
                            if (i < 3) input.Skills[i] = true;
                            else input.Potion = true;
                        }
                    if (game.Paused) screens.Pause();
                    break;
                case "result":
                    if (game != null) hud.Draw(game, input, rig.Cam, 0, Time.deltaTime);
                    if (lastResult != null) screens.Result(lastResult);
                    break;
            }

            // whatever the UI did not consume goes to the world
            if (Mode == "stage" && game != null && !game.Paused && e.type == EventType.MouseDown && e.button == 0)
            {
                WorldClick(e.mousePosition, e.shift);
                e.Use();
            }
        }

        void OnKey(KeyCode k)
        {
            if (Mode != "stage" || game == null) return;
            if (k == KeyCode.Escape || k == KeyCode.P)
            {
                TogglePause();
                return;
            }
            if (game.Paused) return;
            if (k == KeyCode.Alpha1 || k == KeyCode.Keypad1) input.Skills[0] = true;
            if (k == KeyCode.Alpha2 || k == KeyCode.Keypad2) input.Skills[1] = true;
            if (k == KeyCode.Alpha3 || k == KeyCode.Keypad3) input.Skills[2] = true;
            if (k == KeyCode.F || k == KeyCode.Q) input.Potion = true;
        }

        void TogglePause()
        {
            if (game == null) return;
            game.Paused = !game.Paused;
            if (game.Paused)
            {
                held.Clear();
                mouseHeld = false;
            }
        }
    }
}
