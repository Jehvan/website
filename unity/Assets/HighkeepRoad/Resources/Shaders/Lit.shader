// Characters and props: Standard lighting + rim light (readability from the top-down camera),
// hit flash and a fade used when corpses sink away. Props marked see-through dissolve (dithered cutout)
// where they stand between the camera and the hero, so trees and roofs never hide the fight.
Shader "Highkeep/Lit"
{
    Properties
    {
        _MainTex ("Albedo", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _Glossiness ("Smoothness", Range(0,1)) = 0.12
        _Metallic ("Metallic", Range(0,1)) = 0
        _Rim ("Rim strength", Range(0,3)) = 0.35
        _RimColor ("Rim colour", Color) = (1,0.86,0.62,1)
        _Flash ("Hit flash", Range(0,1)) = 0
        _FlashColor ("Flash colour", Color) = (1,0.92,0.8,1)
        _Emission ("Emission", Color) = (0,0,0,0)
        _SeeThrough ("See-through cutout", Float) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows addshadow
        #pragma target 3.0
        sampler2D _MainTex;
        fixed4 _Color, _RimColor, _FlashColor, _Emission;
        half _Glossiness, _Metallic, _Rim, _Flash, _SeeThrough;
        float4 _HkHole;   // xyz = hero position, w = radius (0 = off); set globally each frame
        float4 _HkCam;    // xyz = camera position
        struct Input { float2 uv_MainTex; float3 viewDir; float3 worldPos; float4 screenPos; };
        void surf (Input IN, inout SurfaceOutputStandard o)
        {
        #ifndef UNITY_PASS_SHADOWCASTER
            if (_SeeThrough > 0.5 && _HkHole.w > 0.0 && IN.worldPos.y > 0.5)
            {
                float3 a = _HkCam.xyz, b = _HkHole.xyz + float3(0, 1, 0), ab = b - a;
                float t = saturate(dot(IN.worldPos - a, ab) / dot(ab, ab));
                float d = length(IN.worldPos - (a + ab * t));
                float k = (1.0 - smoothstep(_HkHole.w * 0.55, _HkHole.w, d)) * step(t, 0.97);
                float2 px = floor(IN.screenPos.xy / max(IN.screenPos.w, 1e-5) * _ScreenParams.xy);
                float dither = frac(sin(dot(px, float2(12.9898, 78.233))) * 43758.5453);
                if (k > 0.0) clip(dither - k * 0.88);
            }
        #endif
            fixed4 c = tex2D(_MainTex, IN.uv_MainTex) * _Color;
            o.Albedo = c.rgb;
            o.Metallic = _Metallic;
            o.Smoothness = _Glossiness;
            half rim = 1.0 - saturate(dot(normalize(IN.viewDir), o.Normal));
            o.Emission = _Emission.rgb + _RimColor.rgb * pow(rim, 3.0) * _Rim + _FlashColor.rgb * _Flash;
            o.Alpha = c.a;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
