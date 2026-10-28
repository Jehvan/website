// Characters and props: Standard lighting + rim light (readability from the top-down camera),
// hit flash and a fade used when corpses sink away.
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
        half _Glossiness, _Metallic, _Rim, _Flash;
        struct Input { float2 uv_MainTex; float3 viewDir; };
        void surf (Input IN, inout SurfaceOutputStandard o)
        {
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
