// Alpha-tested, double-sided cards (grass tufts) with a gentle wind sway on the upper vertices.
Shader "Highkeep/Foliage"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _Cutoff ("Alpha cutoff", Range(0,1)) = 0.4
        _Wind ("Wind", Float) = 0.08
    }
    SubShader
    {
        Tags { "Queue"="AlphaTest" "RenderType"="TransparentCutout" }
        Cull Off
        CGPROGRAM
        #pragma surface surf Lambert alphatest:_Cutoff vertex:vert addshadow
        sampler2D _MainTex;
        fixed4 _Color;
        float _Wind;
        struct Input { float2 uv_MainTex; };
        void vert (inout appdata_full v)
        {
            float3 wp = mul(unity_ObjectToWorld, v.vertex).xyz;
            float sway = sin(_Time.y * 1.7 + wp.x * 0.6 + wp.z * 0.4) * _Wind * v.texcoord.y;
            v.vertex.xyz += mul((float3x3)unity_WorldToObject, float3(sway, 0, sway * 0.5));
        }
        void surf (Input IN, inout SurfaceOutput o)
        {
            fixed4 c = tex2D(_MainTex, IN.uv_MainTex) * _Color;
            o.Albedo = c.rgb;
            o.Alpha = c.a;
        }
        ENDCG
    }
    FallBack "Transparent/Cutout/Diffuse"
}
