// Rivers and pools: tinted, slightly reflective, two scrolling ripple layers.
Shader "Highkeep/Water"
{
    Properties
    {
        _Color ("Deep colour", Color) = (0.12,0.22,0.24,0.85)
        _Shallow ("Ripple colour", Color) = (0.5,0.65,0.62,1)
        _Ripples ("Ripples", 2D) = "grey" {}
        _Tiling ("Tiling", Float) = 6
        _Flow ("Flow (xy, zw)", Vector) = (0.01,0.04,-0.02,0.015)
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        ZWrite Off
        CGPROGRAM
        #pragma surface surf Standard alpha:fade
        sampler2D _Ripples;
        fixed4 _Color, _Shallow;
        float _Tiling;
        float4 _Flow;
        struct Input { float3 worldPos; };
        void surf (Input IN, inout SurfaceOutputStandard o)
        {
            float2 uv = IN.worldPos.xz / _Tiling;
            fixed a = tex2D(_Ripples, uv + _Flow.xy * _Time.y).r;
            fixed b = tex2D(_Ripples, uv * 1.7 + _Flow.zw * _Time.y).r;
            fixed r = saturate((a + b) - 0.9);
            o.Albedo = lerp(_Color.rgb, _Shallow.rgb, r);
            o.Smoothness = 0.82;
            o.Metallic = 0.1;
            o.Alpha = _Color.a;
        }
        ENDCG
    }
}
