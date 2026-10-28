// Painted stage floor (one texture over the whole map) multiplied by a tiling detail layer.
Shader "Highkeep/Ground"
{
    Properties
    {
        _MainTex ("Painted map", 2D) = "white" {}
        _Detail ("Detail (grey)", 2D) = "grey" {}
        _DetailTiling ("Detail tiling", Float) = 40
        _DetailStrength ("Detail strength", Range(0,1)) = 0.55
        _Color ("Tint", Color) = (1,1,1,1)
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        sampler2D _MainTex, _Detail;
        float _DetailTiling, _DetailStrength;
        fixed4 _Color;
        struct Input { float2 uv_MainTex; };
        void surf (Input IN, inout SurfaceOutputStandard o)
        {
            fixed3 c = tex2D(_MainTex, IN.uv_MainTex).rgb * _Color.rgb;
            fixed d = tex2D(_Detail, IN.uv_MainTex * _DetailTiling).r;
            fixed d2 = tex2D(_Detail, IN.uv_MainTex * _DetailTiling * 0.23 + 0.37).r;
            c *= lerp(1.0, (d * 0.6 + d2 * 0.4) * 2.0, _DetailStrength);
            o.Albedo = c;
            o.Smoothness = 0.05;
            o.Metallic = 0;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
