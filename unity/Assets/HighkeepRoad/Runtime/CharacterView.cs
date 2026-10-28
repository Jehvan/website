// A KayKit character in the world: model, animation state machine driven by the simulation, hit flash,
// target ring and hover highlight.
using System.Collections.Generic;
using Highkeep.Core;
using UnityEngine;

namespace Highkeep
{
    public sealed class CharacterView
    {
        public readonly GameObject Root;
        public readonly string Kind;
        readonly CharSpec spec;
        readonly CharAnim anim;
        readonly Renderer[] renderers;
        readonly MaterialPropertyBlock mpb = new MaterialPropertyBlock();
        readonly Transform model;
        GameObject ring, hoverRing;
        float flash, lastAtk = -1, oneShotT, deadSink;
        string oneShot;
        int attackIdx;
        Vector3 lastPos;
        bool hadPos;
        float yawSmooth;
        public float Radius = 0.5f;

        public CharacterView(string kind, Transform parent)
        {
            Kind = kind;
            spec = ModelCatalog.Chars[kind];
            Root = Res.Spawn(spec.Model, parent, Vector3.zero, 0f);
            Root.name = "char_" + kind;
            model = Root.transform.GetChild(0);
            renderers = Root.GetComponentsInChildren<Renderer>(true);
            foreach (var r in renderers)
                if (r is SkinnedMeshRenderer sk) sk.updateWhenOffscreen = true;
            var animator = Root.GetComponentInChildren<Animator>(true);
            if (animator == null) animator = model.gameObject.AddComponent<Animator>();
            anim = new CharAnim(animator, Res.Clips(spec.Model.Path), kind);
            anim.Play(spec.Idle, 1f, 0.01f);
            var sh = FxLib.Make("shadow", FxLib.Flat, FxLib.Alpha(FxLib.Shadow, Color.white), Root.transform);
            sh.transform.localPosition = new Vector3(0, 0.03f, 0);
            sh.transform.localScale = Vector3.one * (spec.Model.Height * 0.55f);
        }

        // ---------------------------------------------------------------- shared helpers
        void Face(float targetYaw, float dt, float rate = 14f)
        {
            yawSmooth = Mathf.LerpAngle(yawSmooth, targetYaw, 1f - Mathf.Exp(-rate * dt));
            Root.transform.rotation = Quaternion.Euler(0, yawSmooth, 0);
        }

        float MoveSpeed(Vector3 pos, float dt)
        {
            if (!hadPos) { lastPos = pos; hadPos = true; }
            float v = dt > 0 ? Vector3.Distance(new Vector3(pos.x, 0, pos.z), new Vector3(lastPos.x, 0, lastPos.z)) / dt : 0;
            lastPos = pos;
            return v;
        }

        void SetFlash(float f)
        {
            if (Mathf.Abs(f - flash) < 0.01f) return;
            flash = f;
            foreach (var r in renderers)
            {
                r.GetPropertyBlock(mpb);
                mpb.SetFloat("_Flash", f);
                r.SetPropertyBlock(mpb);
            }
        }

        public void SetRim(float rim, Color c)
        {
            foreach (var r in renderers)
            {
                r.GetPropertyBlock(mpb);
                mpb.SetFloat("_Rim", rim);
                mpb.SetColor("_RimColor", c);
                r.SetPropertyBlock(mpb);
            }
        }

        public void SetTargeted(bool on, float t)
        {
            if (on && ring == null)
            {
                ring = FxLib.Make("target", FxLib.Flat, FxLib.Add(FxLib.Ring, new Color(1f, 0.25f, 0.12f), 1.6f), Root.transform);
                ring.transform.localPosition = new Vector3(0, 0.05f, 0);
            }
            if (ring != null)
            {
                ring.SetActive(on);
                if (on)
                {
                    float s = Radius * 2.8f * (1f + Mathf.Sin(t * 6f) * 0.05f);
                    ring.transform.localScale = new Vector3(s, 1, s) / Mathf.Max(0.01f, Root.transform.localScale.x);
                    ring.transform.localRotation = Quaternion.Euler(0, t * 40f, 0);
                }
            }
        }

        public void SetHovered(bool on)
        {
            if (on && hoverRing == null)
            {
                hoverRing = FxLib.Make("hover", FxLib.Flat, FxLib.Add(FxLib.Ring, new Color(1f, 0.85f, 0.5f), 0.9f), Root.transform);
                hoverRing.transform.localPosition = new Vector3(0, 0.04f, 0);
            }
            if (hoverRing != null)
            {
                hoverRing.SetActive(on);
                float s = Radius * 2.5f;
                hoverRing.transform.localScale = new Vector3(s, 1, s) / Mathf.Max(0.01f, Root.transform.localScale.x);
            }
            SetRim(on ? 1.4f : spec.Model.Rim, on ? new Color(1f, 0.55f, 0.3f) : new Color(1f, 0.86f, 0.62f));
        }

        void PlayOneShot(string clip, float dur, float fade = 0.08f)
        {
            if (!anim.Has(clip)) return;
            oneShot = clip;
            oneShotT = dur;
            anim.Play(clip, anim.Length > 0 ? 1f : 1f, fade, true);
            float len = anim.Length;
            anim.SetSpeed(Mathf.Clamp(len / Mathf.Max(0.05f, dur), 0.4f, 4f));
        }

        // ---------------------------------------------------------------- hero
        public void UpdateHero(Player p, string cls, float dt, float t, double moveSpeedRef)
        {
            var pos = W3.Pos(p.X, p.Y);
            Root.transform.position = pos;
            float v = MoveSpeed(pos, dt);
            anim.Tick(dt);
            Face(W3.Yaw(p.Face), dt, p.Dash != null ? 30f : 14f);
            SetFlash(p.HitT > 0.12 ? 0.6f : 0f);
            if (p.Dead)
            {
                if (anim.Current != spec.Death) anim.Play(spec.Death, 1f, 0.1f, true);
                return;
            }
            oneShotT -= dt;
            // skills
            if (p.SkillAnim != null)
            {
                string clip = null;
                switch (p.SkillAnim)
                {
                    case "rush": clip = "Block"; break;
                    case "whirl": clip = "2H_Melee_Attack_Spinning"; break;
                    case "rally": clip = "Cheer"; break;
                    case "volley": clip = "2H_Ranged_Shoot"; break;
                    case "tumble": clip = "Dodge_Backward"; break;
                    case "nova": clip = "Spellcast_Raise"; break;
                    case "blink": clip = "Spellcast_Shoot"; break;
                    case "cast": clip = "Spellcast_Long"; break;
                }
                if (clip != null && anim.Current != clip)
                {
                    if (p.SkillAnim == "whirl") anim.Play(clip, 1.4f, 0.08f, true);
                    else PlayOneShot(clip, (float)System.Math.Max(0.3, p.SkillT));
                }
                lastAtk = (float)p.AtkT;
                return;
            }
            // basic attack: restart the swing whenever a new one begins
            if (p.AtkT >= 0 && (lastAtk < 0 || p.AtkT < lastAtk))
            {
                var atks = spec.Attacks;
                string clip = atks[attackIdx++ % atks.Length];
                double cd = D.Classes[cls].Attack.Cd;
                PlayOneShot(clip, (float)System.Math.Max(0.3, cd * 1.05));
            }
            lastAtk = (float)p.AtkT;
            if (oneShotT > 0 && oneShot != null) return;
            if (p.HitT > 0.15 && v < 0.5f && anim.Current != spec.Hit)
            {
                PlayOneShot(spec.Hit, 0.35f);
                return;
            }
            if (v > 0.6f) anim.Play(spec.Run, Mathf.Clamp(v / spec.RunRef, 0.6f, 1.8f), 0.12f);
            else anim.Play(spec.Idle, 1f, 0.2f);
        }

        // ---------------------------------------------------------------- enemies
        public void UpdateEnemy(Enemy e, float dt, float t)
        {
            float hover = spec.Hover && !e.Dead ? 0.5f + Mathf.Sin(t * 3f + e.Id) * 0.15f : 0f;
            var pos = W3.Pos(e.X, e.Y, hover);
            float v = MoveSpeed(pos, dt);
            anim.Tick(dt);
            SetFlash(e.HitT > 0.08 ? 0.75f : 0f);
            if (e.Dead)
            {
                if (anim.Current != spec.Death) anim.Play(spec.Death, 1.1f, 0.08f, true);
                deadSink = e.DeadT > 1.4 ? (float)(e.DeadT - 1.4) * 0.9f : 0f;
                Root.transform.position = pos - new Vector3(0, deadSink, 0);
                SetTargeted(false, t);
                return;
            }
            Root.transform.position = pos;
            Face(W3.Yaw(e.Face), dt, e.Type == "regent" && e.State == "charge" ? 30f : 10f);
            if (e.SpawnT > 0)
            {
                if (spec.Spawn != null && anim.Current != spec.Spawn) PlayOneShot(spec.Spawn, 0.7f, 0.01f);
                Root.transform.localScale = Vector3.one * Mathf.Clamp01(1.15f - (float)e.SpawnT * 0.6f);
                return;
            }
            Root.transform.localScale = Vector3.one;
            oneShotT -= dt;
            if (e.StunT > 0)
            {
                if (anim.Current != spec.Hit) PlayOneShot(spec.Hit, 0.4f);
                return;
            }
            // windups map onto the attack clip so the blow lands as the windup ends
            string atk = null;
            float windup = (float)e.D.Windup;
            if (e.Type == "regent")
            {
                switch (e.State)
                {
                    case "slam": atk = "2H_Melee_Attack_Chop"; windup = (float)e.Dur; break;
                    case "orbs": atk = "Spellcast_Raise"; windup = (float)e.Dur; break;
                    case "summon": atk = "Spellcast_Summon"; windup = (float)e.Dur; break;
                    case "charge":
                        if (e.ChargePhase == 0) { atk = "Taunt"; windup = (float)e.Dur; }
                        else { anim.Play("Running_C", 1.6f, 0.08f); return; }
                        break;
                }
            }
            else if (e.State == "windup") atk = spec.Attacks[0];
            if (atk != null)
            {
                if (anim.Current != atk) PlayOneShot(atk, windup * 1.6f + 0.2f, 0.06f);
                return;
            }
            if (oneShotT > 0 && oneShot != null) return;
            if (v > 0.25f)
            {
                string clip = v > spec.RunRef * 0.65f || !anim.Has(spec.Walk) ? spec.Run : spec.Walk;
                anim.Play(clip, Mathf.Clamp(v / (clip == spec.Run ? spec.RunRef : spec.RunRef * 0.55f), 0.5f, 1.8f), 0.15f);
            }
            else anim.Play(spec.Idle, 1f, 0.25f);
        }

        // ---------------------------------------------------------------- simple NPC (town)
        public void UpdateNpc(Vector3 pos, float yaw, bool moving, float dt)
        {
            float v = MoveSpeed(pos, dt);
            Root.transform.position = pos;
            anim.Tick(dt);
            Face(yaw, dt, 6f);
            if (moving && v > 0.1f) anim.Play(anim.Has(spec.Walk) ? spec.Walk : spec.Run, 1f, 0.25f);
            else anim.Play(spec.Idle, 1f, 0.3f);
        }

        public void Destroy()
        {
            anim.Destroy();
            if (Root) Object.Destroy(Root);
        }
    }
}
