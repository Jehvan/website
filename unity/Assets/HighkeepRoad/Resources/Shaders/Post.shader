// Full-screen grade: bloom (prefilter -> blur -> composite), ACES filmic tone mapping, warm/cool split toning,
// saturation, vignette. Driven by PostFx.cs from OnRenderImage.
Shader "Hidden/Highkeep/Post"
{
    Properties { _MainTex ("", 2D) = "white" {} _Bloom ("", 2D) = "black" {} }
    CGINCLUDE
    #include "UnityCG.cginc"
    sampler2D _MainTex, _Bloom;
    float4 _MainTex_TexelSize;
    float _Threshold, _BloomStrength, _Exposure, _Saturation, _Vignette, _Contrast;
    float4 _ShadowTint, _HighlightTint;
    half3 Aces(half3 x) { return saturate((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); }
    half4 Prefilter (v2f_img i) : SV_Target
    {
        float2 d = _MainTex_TexelSize.xy;
        half3 c = tex2D(_MainTex, i.uv + d * float2(-1,-1)).rgb + tex2D(_MainTex, i.uv + d * float2(1,-1)).rgb
                + tex2D(_MainTex, i.uv + d * float2(-1,1)).rgb + tex2D(_MainTex, i.uv + d * float2(1,1)).rgb;
        c *= 0.25;
        half br = max(c.r, max(c.g, c.b));
        half k = max(0, br - _Threshold) / max(br, 1e-4);
        return half4(c * k, 1);
    }
    half4 Blur (v2f_img i) : SV_Target
    {
        float2 d = _MainTex_TexelSize.xy * 1.5;
        half3 c = tex2D(_MainTex, i.uv).rgb * 0.2;
        c += (tex2D(_MainTex, i.uv + d * float2(1,1)).rgb + tex2D(_MainTex, i.uv + d * float2(-1,1)).rgb
            + tex2D(_MainTex, i.uv + d * float2(1,-1)).rgb + tex2D(_MainTex, i.uv + d * float2(-1,-1)).rgb) * 0.2;
        return half4(c, 1);
    }
    half4 Composite (v2f_img i) : SV_Target
    {
        half3 c = tex2D(_MainTex, i.uv).rgb + tex2D(_Bloom, i.uv).rgb * _BloomStrength;
        c *= _Exposure;
        c = Aces(c);
        half l = dot(c, half3(0.2126, 0.7152, 0.0722));
        c = lerp(half3(l, l, l), c, _Saturation);
        c = lerp(c * _ShadowTint.rgb, c * _HighlightTint.rgb, smoothstep(0.05, 0.7, l));
        c = saturate((c - 0.5) * _Contrast + 0.5);
        float2 q = i.uv - 0.5;
        c *= saturate(1.0 - dot(q, q) * _Vignette);
        return half4(c, 1);
    }
    ENDCG
    SubShader
    {
        Cull Off ZWrite Off ZTest Always
        Pass { CGPROGRAM
               #pragma vertex vert_img
               #pragma fragment Prefilter
               ENDCG }
        Pass { CGPROGRAM
               #pragma vertex vert_img
               #pragma fragment Blur
               ENDCG }
        Pass { CGPROGRAM
               #pragma vertex vert_img
               #pragma fragment Composite
               ENDCG }
    }
}
