// Stage layouts (baked from the Python generator into JSON) plus collision helpers.
// World coordinates: x east, y SOUTH (towards the camera), in "px" units (25 px = 1 metre in the 3D view).
using System;
using System.Collections.Generic;

namespace Highkeep.Core
{
    /// <summary>mulberry32, identical to the Python/JS versions so seeded content matches.</summary>
    public sealed class Rng
    {
        uint a;
        public Rng(long seed) { a = unchecked((uint)seed); }

        public double Next()
        {
            unchecked
            {
                a += 0x6D2B79F5;
                uint t = a;
                t = (t ^ (t >> 15)) * (t | 1);
                t ^= t + (t ^ (t >> 7)) * (t | 61);
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }
    }

    public sealed class Prop
    {
        public string Kind;
        public double X, Y, Rot, S = 1;
        public Dictionary<string, object> Extra;
        public double Num(string k, double def = 0) => Json.Num(Extra, k, def);
        public bool Flag(string k) => Json.Bool(Extra, k);
    }

    public sealed class Obstacle
    {
        public bool Circle;
        public double X, Y, R, W, H, Rot;
    }

    public sealed class Bounds { public double X0, Y0, X1, Y1; }

    public sealed class Layout
    {
        public string Theme;
        public int Seed, Floor;
        public bool Boss, Indoor;
        public double W = D.WorldW, H = D.WorldH, RoadW = 40;
        public Bounds B = new Bounds { X0 = 30, Y0 = 30, X1 = D.WorldW - 30, Y1 = D.WorldH - 30 };
        public double StartX = 150, StartY = 600;
        public List<Prop> Props = new List<Prop>();
        public List<Obstacle> Obstacles = new List<Obstacle>();
        public List<(double x, double y)> Lights = new List<(double, double)>();
        public List<(double x, double y)> Road;
        public bool HasRiver;
        public double RiverX0, RiverX1;
        public bool HasBridge;
        public double BridgeX0, BridgeX1, BridgeY, BridgeW;
        public List<(double x, double y, double r)> Pools = new List<(double, double, double)>();
        public bool HasPlaza;
        public double PlazaX, PlazaY, PlazaR;
        public List<List<(double x, double y)>> Paths = new List<List<(double, double)>>();

        public IEnumerable<Prop> Of(string kind)
        {
            foreach (var p in Props) if (p.Kind == kind) yield return p;
        }

        static List<(double, double)> Pts(object o)
        {
            var l = new List<(double, double)>();
            foreach (var p in Json.Arr(o))
            {
                var a = Json.Arr(p);
                l.Add(((double)a[0], (double)a[1]));
            }
            return l;
        }

        public static Layout FromJson(string text)
        {
            var d = Json.Obj(Json.Parse(text));
            var L = new Layout
            {
                Theme = Json.Str(d, "theme"), Seed = Json.Int(d, "seed"), Floor = Json.Int(d, "floor"), Boss = Json.Bool(d, "boss"),
                Indoor = Json.Bool(d, "indoor"), W = Json.Num(d, "w", D.WorldW), H = Json.Num(d, "h", D.WorldH), RoadW = Json.Num(d, "road_w", 40),
            };
            var b = Json.Obj(d["bounds"]);
            L.B = new Bounds { X0 = Json.Num(b, "x0"), Y0 = Json.Num(b, "y0"), X1 = Json.Num(b, "x1"), Y1 = Json.Num(b, "y1") };
            var st = Json.Arr(d["start"]);
            L.StartX = (double)st[0];
            L.StartY = (double)st[1];
            foreach (var po in Json.Arr(d["props"]))
            {
                var pd = Json.Obj(po);
                var p = new Prop { Kind = Json.Str(pd, "kind"), X = Json.Num(pd, "x"), Y = Json.Num(pd, "y"), Rot = Json.Num(pd, "rot"), S = Json.Num(pd, "s", 1), Extra = pd };
                L.Props.Add(p);
            }
            foreach (var oo in Json.Arr(d["obstacles"]))
            {
                var a = Json.Arr(oo);
                if ((string)a[0] == "c") L.Obstacles.Add(new Obstacle { Circle = true, X = (double)a[1], Y = (double)a[2], R = (double)a[3] });
                else L.Obstacles.Add(new Obstacle { X = (double)a[1], Y = (double)a[2], W = (double)a[3], H = (double)a[4], Rot = (double)a[5] });
            }
            L.Lights = Pts(d.TryGetValue("lights", out var li) ? li : null);
            if (Json.Has(d, "road")) L.Road = Pts(d["road"]);
            if (Json.Has(d, "river"))
            {
                var r = Json.Obj(d["river"]);
                L.HasRiver = true;
                L.RiverX0 = Json.Num(r, "x0");
                L.RiverX1 = Json.Num(r, "x1");
            }
            if (Json.Has(d, "bridge"))
            {
                var r = Json.Obj(d["bridge"]);
                L.HasBridge = true;
                L.BridgeX0 = Json.Num(r, "x0");
                L.BridgeX1 = Json.Num(r, "x1");
                L.BridgeY = Json.Num(r, "y");
                L.BridgeW = Json.Num(r, "w");
            }
            foreach (var po in Json.Arr(d.TryGetValue("pools", out var pl) ? pl : null))
            {
                var pd = Json.Obj(po);
                L.Pools.Add((Json.Num(pd, "x"), Json.Num(pd, "y"), Json.Num(pd, "r")));
            }
            if (Json.Has(d, "plaza"))
            {
                var a = Json.Arr(d["plaza"]);
                L.HasPlaza = true;
                L.PlazaX = (double)a[0];
                L.PlazaY = (double)a[1];
                L.PlazaR = (double)a[2];
            }
            foreach (var po in Json.Arr(d.TryGetValue("paths", out var pa) ? pa : null)) L.Paths.Add(Pts(po));
            return L;
        }

        // ---------------------------------------------------------------- geometry
        public static double DistSeg(double px, double py, double ax, double ay, double bx, double by)
        {
            double dx = bx - ax, dy = by - ay;
            double l2 = dx * dx + dy * dy;
            if (l2 == 0) l2 = 1;
            double t = Math.Max(0, Math.Min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
            return Math.Sqrt(Sq(px - (ax + t * dx)) + Sq(py - (ay + t * dy)));
        }

        static double Sq(double v) => v * v;

        public double DistToRoad(double x, double y)
        {
            if (Road == null) return 9999;
            double d = 9999;
            for (int i = 0; i < Road.Count - 1; i++) d = Math.Min(d, DistSeg(x, y, Road[i].x, Road[i].y, Road[i + 1].x, Road[i + 1].y));
            return d;
        }

        /// <summary>Push a circle at (x, y) with radius r out of the bounds and every obstacle.</summary>
        public void Resolve(ref double px, ref double py, double r)
        {
            double x = Math.Max(B.X0 + r, Math.Min(B.X1 - r, px));
            double y = Math.Max(B.Y0 + r, Math.Min(B.Y1 - r, py));
            foreach (var o in Obstacles)
            {
                if (o.Circle)
                {
                    double dx = x - o.X, dy = y - o.Y, rr = o.R + r;
                    if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
                    double d2 = dx * dx + dy * dy;
                    if (d2 < rr * rr)
                    {
                        double d = Math.Sqrt(d2);
                        if (d == 0) d = 0.001;
                        x = o.X + dx / d * rr;
                        y = o.Y + dy / d * rr;
                    }
                }
                else
                {
                    double c = Math.Cos(-o.Rot), s = Math.Sin(-o.Rot);
                    double lx = (x - o.X) * c - (y - o.Y) * s, ly = (x - o.X) * s + (y - o.Y) * c;
                    double hw = o.W / 2, hh = o.H / 2;
                    double cx = Math.Max(-hw, Math.Min(hw, lx)), cy = Math.Max(-hh, Math.Min(hh, ly));
                    double dx = lx - cx, dy = ly - cy;
                    double d2 = dx * dx + dy * dy;
                    if (d2 > r * r) continue;
                    double nx, ny;
                    if (d2 > 1e-6)
                    {
                        double d = Math.Sqrt(d2);
                        nx = cx + dx / d * r;
                        ny = cy + dy / d * r;
                    }
                    else
                    {
                        double ex = hw - Math.Abs(lx), ey = hh - Math.Abs(ly);
                        if (ex < ey) { nx = (lx >= 0 ? 1 : -1) * (hw + r); ny = ly; }
                        else { nx = lx; ny = (ly >= 0 ? 1 : -1) * (hh + r); }
                    }
                    double cs = Math.Cos(o.Rot), sn = Math.Sin(o.Rot);
                    x = o.X + nx * cs - ny * sn;
                    y = o.Y + nx * sn + ny * cs;
                }
            }
            px = x;
            py = y;
        }

        public bool PointBlocked(double x, double y, double r = 4)
        {
            double tx = x, ty = y;
            Resolve(ref tx, ref ty, r);
            return Math.Abs(tx - x) > 0.5 || Math.Abs(ty - y) > 0.5;
        }
    }
}
