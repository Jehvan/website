// Cross-fading clip player on top of the Playables API: no AnimatorController asset needed, clips come straight
// out of the character FBX.
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Playables;

namespace Highkeep
{
    public sealed class CharAnim
    {
        readonly Dictionary<string, AnimationClip> clips;
        PlayableGraph graph;
        AnimationMixerPlayable mixer;
        AnimationClipPlayable cur, prev;
        float fade = 1f, fadeDur = 0.15f;
        public string Current { get; private set; }
        public float Time => cur.IsValid() ? (float)cur.GetTime() : 0f;
        public float Length { get; private set; } = 1f;
        readonly bool ok;

        public CharAnim(Animator animator, Dictionary<string, AnimationClip> clips, string name)
        {
            this.clips = clips;
            if (animator == null || clips == null || clips.Count == 0) return;
            animator.runtimeAnimatorController = null;
            animator.applyRootMotion = false;
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            graph = PlayableGraph.Create("Highkeep." + name);
            graph.SetTimeUpdateMode(DirectorUpdateMode.GameTime);
            var output = AnimationPlayableOutput.Create(graph, "anim", animator);
            mixer = AnimationMixerPlayable.Create(graph, 2);
            output.SetSourcePlayable(mixer);
            graph.Play();
            ok = true;
        }

        public bool Has(string clip) => clip != null && clips != null && clips.ContainsKey(clip);

        /// <summary>Play a clip (cross-fading from the current one). restart=false keeps a looping clip running.</summary>
        public void Play(string clip, float speed = 1f, float fadeTime = 0.15f, bool restart = false)
        {
            if (!ok || clip == null) return;
            if (!clips.TryGetValue(clip, out var c)) return;
            if (clip == Current && !restart)
            {
                cur.SetSpeed(speed);
                return;
            }
            if (prev.IsValid())
            {
                graph.Disconnect(mixer, 1);
                prev.Destroy();
            }
            if (cur.IsValid())
            {
                graph.Disconnect(mixer, 0);
                prev = cur;
                graph.Connect(prev, 0, mixer, 1);
                mixer.SetInputWeight(1, 1f);
            }
            cur = AnimationClipPlayable.Create(graph, c);
            cur.SetApplyFootIK(false);
            cur.SetSpeed(speed);
            cur.SetTime(0);
            graph.Connect(cur, 0, mixer, 0);
            mixer.SetInputWeight(0, prev.IsValid() ? 0f : 1f);
            Current = clip;
            Length = Mathf.Max(0.01f, c.length);
            fade = prev.IsValid() ? 0f : 1f;
            fadeDur = Mathf.Max(0.01f, fadeTime);
        }

        public void SetSpeed(float speed)
        {
            if (ok && cur.IsValid()) cur.SetSpeed(speed);
        }

        public void SetNormalizedTime(float t)
        {
            if (ok && cur.IsValid()) cur.SetTime(Mathf.Clamp01(t) * Length);
        }

        public void Tick(float dt)
        {
            if (!ok || fade >= 1f) return;
            fade = Mathf.Min(1f, fade + dt / fadeDur);
            mixer.SetInputWeight(0, fade);
            if (prev.IsValid()) mixer.SetInputWeight(1, 1f - fade);
            if (fade >= 1f && prev.IsValid())
            {
                graph.Disconnect(mixer, 1);
                prev.Destroy();
            }
        }

        public void Destroy()
        {
            if (graph.IsValid()) graph.Destroy();
        }
    }
}
