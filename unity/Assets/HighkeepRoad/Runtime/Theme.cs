// Per-stage lighting, fog and colour grade.
using System.Collections.Generic;
using UnityEngine;

namespace Highkeep
{
    public sealed class Theme
    {
        public Color Sun = new Color(1f, 0.9f, 0.75f);
        public float SunIntensity = 1.25f, SunPitch = 50f, SunYaw = -35f;
        public Color Sky = new Color(0.55f, 0.6f, 0.7f), Equator = new Color(0.42f, 0.42f, 0.36f), Ground = new Color(0.2f, 0.18f, 0.14f);
        public Color Fog = new Color(0.55f, 0.6f, 0.55f);
        public float FogDensity = 0.012f;
        public float Exposure = 1.05f, Saturation = 1.12f, Bloom = 0.55f, Threshold = 1.05f, Vignette = 1.1f, Contrast = 1.06f;
        public Color ShadowTint = new Color(0.92f, 0.96f, 1.06f), HighlightTint = new Color(1.04f, 1.0f, 0.94f);
        public Color Skirt = new Color(0.16f, 0.2f, 0.1f);
        public Color TorchColor = new Color(1f, 0.6f, 0.28f);
        public float TorchIntensity = 2.2f;
        public bool Indoor;
        public Color Motes = new Color(1f, 0.95f, 0.7f, 0.5f);

        public static readonly Dictionary<string, Theme> All = new Dictionary<string, Theme>
        {
            ["fields"] = new Theme(),
            ["town"] = new Theme { SunIntensity = 1.3f, Fog = new Color(0.6f, 0.66f, 0.6f), FogDensity = 0.008f, Saturation = 1.15f },
            ["wood"] = new Theme
            {
                Sun = new Color(1f, 0.88f, 0.7f), SunIntensity = 1.05f, Sky = new Color(0.42f, 0.52f, 0.46f), Equator = new Color(0.3f, 0.36f, 0.26f),
                Fog = new Color(0.32f, 0.4f, 0.32f), FogDensity = 0.022f, Skirt = new Color(0.1f, 0.14f, 0.08f), Motes = new Color(0.8f, 1f, 0.6f, 0.5f),
            },
            ["bridge"] = new Theme { Sun = new Color(1f, 0.86f, 0.68f), SunIntensity = 1.3f, SunYaw = -60f, FogDensity = 0.01f },
            ["marsh"] = new Theme
            {
                Sun = new Color(0.95f, 0.82f, 0.6f), SunIntensity = 0.85f, SunPitch = 35f, Sky = new Color(0.4f, 0.46f, 0.4f), Equator = new Color(0.3f, 0.32f, 0.26f),
                Fog = new Color(0.36f, 0.42f, 0.32f), FogDensity = 0.035f, Saturation = 0.95f, Skirt = new Color(0.1f, 0.12f, 0.08f),
                ShadowTint = new Color(0.9f, 1.02f, 0.95f), Motes = new Color(0.85f, 1f, 0.45f, 0.6f),
            },
            ["gate"] = new Theme { Sun = new Color(1f, 0.82f, 0.6f), SunIntensity = 1.2f, SunPitch = 40f, Fog = new Color(0.55f, 0.52f, 0.5f), FogDensity = 0.012f, Motes = new Color(1f, 0.6f, 0.3f, 0.6f) },
            ["hall"] = new Theme
            {
                Sun = new Color(0.65f, 0.72f, 1f), SunIntensity = 0.45f, SunPitch = 60f, Sky = new Color(0.32f, 0.3f, 0.36f), Equator = new Color(0.26f, 0.22f, 0.22f),
                Ground = new Color(0.12f, 0.1f, 0.1f), Fog = new Color(0.06f, 0.05f, 0.06f), FogDensity = 0.012f, Exposure = 1.15f, Bloom = 0.85f, Threshold = 0.9f,
                Vignette = 1.5f, Indoor = true, Skirt = new Color(0.04f, 0.035f, 0.04f), TorchIntensity = 3.2f, Motes = new Color(1f, 0.6f, 0.3f, 0.6f),
                ShadowTint = new Color(0.95f, 0.92f, 1.05f), HighlightTint = new Color(1.06f, 0.98f, 0.9f),
            },
            ["vault"] = new Theme
            {
                Sun = new Color(0.55f, 0.65f, 1f), SunIntensity = 0.4f, SunPitch = 60f, Sky = new Color(0.26f, 0.28f, 0.38f), Equator = new Color(0.2f, 0.2f, 0.26f),
                Ground = new Color(0.08f, 0.08f, 0.1f), Fog = new Color(0.03f, 0.03f, 0.05f), FogDensity = 0.016f, Exposure = 1.2f, Bloom = 0.9f, Threshold = 0.85f,
                Vignette = 1.6f, Indoor = true, Skirt = new Color(0.02f, 0.02f, 0.03f), TorchIntensity = 3.4f, Motes = new Color(1f, 0.5f, 0.2f, 0.6f),
                ShadowTint = new Color(0.9f, 0.95f, 1.1f),
            },
        };

        public static Theme Get(string theme) => All.TryGetValue(theme, out var t) ? t : All["fields"];
    }
}
