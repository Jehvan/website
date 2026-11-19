// Tilted follow camera (Kingsroad-like three-quarter view) with scroll zoom, screen shake and ground picking,
// plus the full-screen post pass.
using UnityEngine;

namespace Highkeep
{
    public sealed class CameraRig
    {
        public readonly Camera Cam;
        public readonly PostFx Post;
        public float Pitch = 50f, Distance = 23f, MinDist = 14f, MaxDist = 34f;
        Vector3 target;
        bool init;

        public CameraRig()
        {
            var go = new GameObject("Main Camera");
            go.tag = "MainCamera";
            Object.DontDestroyOnLoad(go);
            Cam = go.AddComponent<Camera>();
            Cam.fieldOfView = 32f;
            Cam.nearClipPlane = 0.5f;
            Cam.farClipPlane = 260f;
            Cam.allowHDR = true;
            Cam.allowMSAA = true;
            Cam.clearFlags = CameraClearFlags.SolidColor;
            Cam.backgroundColor = new Color(0.05f, 0.04f, 0.04f);
            go.AddComponent<AudioListener>();
            Post = go.AddComponent<PostFx>();
        }

        public void Zoom(float delta) => Distance = Mathf.Clamp(Distance + delta, MinDist, MaxDist);

        /// <summary>Follow a point, keeping the view inside the map bounds (in metres).</summary>
        public void Follow(Vector3 focus, Rect boundsM, float dt, float shake)
        {
            float halfW = Distance * 0.55f, halfH = Distance * 0.32f;
            float x = boundsM.width > halfW * 2 ? Mathf.Clamp(focus.x, boundsM.xMin + halfW, boundsM.xMax - halfW) : boundsM.center.x;
            float z = boundsM.height > halfH * 2 ? Mathf.Clamp(focus.z, boundsM.yMin + halfH, boundsM.yMax - halfH * 0.6f) : boundsM.center.y;
            var want = new Vector3(x, 0, z);
            if (!init)
            {
                target = want;
                init = true;
            }
            target = Vector3.Lerp(target, want, 1f - Mathf.Exp(-6f * dt));
            Place(target, shake);
        }

        public void Snap() => init = false;

        public void Place(Vector3 look, float shake = 0f, float yaw = 0f)
        {
            var rot = Quaternion.Euler(Pitch, yaw, 0);
            var pos = look - rot * Vector3.forward * Distance;
            if (shake > 0)
                pos += new Vector3(Random.Range(-1f, 1f), Random.Range(-0.5f, 0.5f), Random.Range(-1f, 1f)) * shake * 0.025f;
            Cam.transform.SetPositionAndRotation(pos, rot);
        }

        /// <summary>Screen pixel (origin bottom-left) -> point on the ground plane.</summary>
        public bool Ground(Vector2 screen, out Vector3 hit)
        {
            var ray = Cam.ScreenPointToRay(new Vector3(screen.x, screen.y, 0));
            var plane = new Plane(Vector3.up, Vector3.zero);
            if (plane.Raycast(ray, out float d))
            {
                hit = ray.GetPoint(d);
                return true;
            }
            hit = Vector3.zero;
            return false;
        }
    }

    [RequireComponent(typeof(Camera))]
    public sealed class PostFx : MonoBehaviour
    {
        Material mat;
        public Theme Theme;
        public bool Enabled = true;

        void OnRenderImage(RenderTexture src, RenderTexture dst)
        {
            if (!Enabled || Theme == null)
            {
                Graphics.Blit(src, dst);
                return;
            }
            if (mat == null)
            {
                var sh = Shader.Find("Hidden/Highkeep/Post");
                if (sh == null || !sh.isSupported)
                {
                    Enabled = false;
                    Graphics.Blit(src, dst);
                    return;
                }
                mat = new Material(sh) { hideFlags = HideFlags.DontSave };
            }
            var t = Theme;
            mat.SetFloat("_Threshold", t.Threshold);
            mat.SetFloat("_BloomStrength", t.Bloom);
            mat.SetFloat("_Exposure", t.Exposure);
            mat.SetFloat("_Saturation", t.Saturation);
            mat.SetFloat("_Vignette", t.Vignette);
            mat.SetFloat("_Contrast", t.Contrast);
            mat.SetColor("_ShadowTint", t.ShadowTint);
            mat.SetColor("_HighlightTint", t.HighlightTint);
            var fmt = src.format;
            int w = src.width / 2, h = src.height / 2;
            var a = RenderTexture.GetTemporary(w, h, 0, fmt);
            Graphics.Blit(src, a, mat, 0);
            var b = a;
            for (int i = 0; i < 4; i++)
            {
                w = Mathf.Max(1, w / 2);
                h = Mathf.Max(1, h / 2);
                var c = RenderTexture.GetTemporary(w, h, 0, fmt);
                Graphics.Blit(b, c, mat, 1);
                if (b != a) RenderTexture.ReleaseTemporary(b);
                b = c;
            }
            // blur back up one step so the bloom is soft, not blocky
            var up = RenderTexture.GetTemporary(w * 4, h * 4, 0, fmt);
            Graphics.Blit(b, up, mat, 1);
            mat.SetTexture("_Bloom", up);
            Graphics.Blit(src, dst, mat, 2);
            RenderTexture.ReleaseTemporary(up);
            RenderTexture.ReleaseTemporary(b);
            RenderTexture.ReleaseTemporary(a);
        }
    }
}
