// Grid navigation: A* paths for click-to-move and a shared flow field that leads enemies around obstacles.
using System;
using System.Collections.Generic;

namespace Highkeep.Core
{
    public sealed class Nav
    {
        public const int Cell = 16;
        readonly Layout L;
        public readonly int W, H;
        readonly byte[] blocked;
        readonly int[] field;
        readonly double radius;
        int fieldKey = -1;
        double fieldT = -1;

        static readonly int[,] NB = { { 1, 0, 10 }, { -1, 0, 10 }, { 0, 1, 10 }, { 0, -1, 10 }, { 1, 1, 14 }, { 1, -1, 14 }, { -1, 1, 14 }, { -1, -1, 14 } };

        public Nav(Layout layout, double r = 13)
        {
            L = layout;
            radius = r;
            W = (int)Math.Ceiling(L.W / Cell);
            H = (int)Math.Ceiling(L.H / Cell);
            blocked = new byte[W * H];
            field = new int[W * H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++)
                    blocked[y * W + x] = (byte)(L.PointBlocked((x + 0.5) * Cell, (y + 0.5) * Cell, r) ? 1 : 0);
        }

        int CellOf(double x, double y)
        {
            int cx = Math.Max(0, Math.Min(W - 1, (int)Math.Floor(x / Cell)));
            int cy = Math.Max(0, Math.Min(H - 1, (int)Math.Floor(y / Cell)));
            return cy * W + cx;
        }

        int NearestFree(int c)
        {
            if (blocked[c] == 0) return c;
            int cx = c % W, cy = c / W;
            for (int r = 1; r < 14; r++)
                for (int dy = -r; dy <= r; dy++)
                    for (int dx = -r; dx <= r; dx++)
                    {
                        if (Math.Max(Math.Abs(dx), Math.Abs(dy)) != r) continue;
                        int x = cx + dx, y = cy + dy;
                        if (x < 0 || y < 0 || x >= W || y >= H) continue;
                        if (blocked[y * W + x] == 0) return y * W + x;
                    }
            return c;
        }

        /// <summary>True when a body of the nav radius can walk the straight segment.</summary>
        public bool LineClear(double ax, double ay, double bx, double by)
        {
            double d = Math.Sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
            int n = (int)Math.Ceiling(d / 8);
            for (int i = 1; i <= n; i++)
            {
                double t = (double)i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
                if (blocked[CellOf(x, y)] != 0 && L.PointBlocked(x, y, radius - 3)) return false;
            }
            return true;
        }

        /// <summary>A* from start to target; smoothed waypoints in world px (excluding the start), or empty if unreachable.</summary>
        public List<(double x, double y)> FindPath(double sx, double sy, double tx, double ty)
        {
            var output = new List<(double x, double y)>();
            if (LineClear(sx, sy, tx, ty))
            {
                output.Add((tx, ty));
                return output;
            }
            int start = NearestFree(CellOf(sx, sy)), goal = NearestFree(CellOf(tx, ty));
            var g = new int[W * H];
            var from = new int[W * H];
            var closed = new bool[W * H];
            for (int i = 0; i < g.Length; i++) { g[i] = int.MaxValue; from[i] = -1; }
            int gx = goal % W, gy = goal / W;
            int Heur(int c)
            {
                int dx = Math.Abs(c % W - gx), dy = Math.Abs(c / W - gy);
                return 10 * (dx + dy) - 6 * Math.Min(dx, dy);
            }
            var open = new SortedSet<(int f, int c)>();
            g[start] = 0;
            open.Add((Heur(start), start));
            bool found = false;
            int guard = 0;
            while (open.Count > 0 && guard++ < 20000)
            {
                var top = open.Min;
                open.Remove(top);
                int c = top.c;
                if (closed[c]) continue;
                closed[c] = true;
                if (c == goal) { found = true; break; }
                int cx = c % W, cy = c / W;
                for (int k = 0; k < 8; k++)
                {
                    int dx = NB[k, 0], dy = NB[k, 1], x = cx + dx, y = cy + dy;
                    if (x < 0 || y < 0 || x >= W || y >= H) continue;
                    int n = y * W + x;
                    if (blocked[n] != 0 || closed[n]) continue;
                    if (dx != 0 && dy != 0 && (blocked[cy * W + x] != 0 || blocked[y * W + cx] != 0)) continue;   // no corner cutting
                    int ng = g[c] + NB[k, 2];
                    if (ng < g[n])
                    {
                        g[n] = ng;
                        from[n] = c;
                        open.Add((ng + Heur(n), n));
                    }
                }
            }
            if (!found) return output;
            var cells = new List<int>();
            for (int c = goal; c != -1 && c != start; c = from[c]) cells.Add(c);
            cells.Reverse();
            var pts = new List<(double x, double y)>();
            foreach (var c in cells) pts.Add(((c % W + 0.5) * Cell, (c / W + 0.5) * Cell));
            if (blocked[CellOf(tx, ty)] == 0) pts.Add((tx, ty));
            // string pulling: skip waypoints we can walk straight past
            double ax = sx, ay = sy;
            int idx = 0;
            while (idx < pts.Count)
            {
                int j = pts.Count - 1;
                while (j > idx && !LineClear(ax, ay, pts[j].x, pts[j].y)) j--;
                output.Add(pts[j]);
                ax = pts[j].x;
                ay = pts[j].y;
                idx = j + 1;
            }
            return output;
        }

        /// <summary>Distance field to (tx, ty), refreshed at most five times a second; enemies walk downhill on it.</summary>
        public void UpdateField(double tx, double ty, double time)
        {
            int key = NearestFree(CellOf(tx, ty));
            if (key == fieldKey || time - fieldT < 0.2) return;
            fieldKey = key;
            fieldT = time;
            for (int i = 0; i < field.Length; i++) field[i] = int.MaxValue;
            var q = new int[W * H];
            int qh = 0, qt = 0;
            field[key] = 0;
            q[qt++] = key;
            while (qh < qt)
            {
                int c = q[qh++], cx = c % W, cy = c / W, d = field[c] + 1;
                for (int k = 0; k < 4; k++)
                {
                    int x = cx + NB[k, 0], y = cy + NB[k, 1];
                    if (x < 0 || y < 0 || x >= W || y >= H) continue;
                    int n = y * W + x;
                    if (blocked[n] != 0 || field[n] <= d) continue;
                    field[n] = d;
                    q[qt++] = n;
                }
            }
        }

        /// <summary>Heading (radians) that follows the flow field from (x, y), or null when there is no route.</summary>
        public double? FieldHeading(double x, double y)
        {
            int c = NearestFree(CellOf(x, y)), cx = c % W, cy = c / W;
            int best = field[c], bx = 0, by = 0;
            for (int k = 0; k < 8; k++)
            {
                int dx = NB[k, 0], dy = NB[k, 1], nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                if (dx != 0 && dy != 0 && (blocked[cy * W + nx] != 0 || blocked[ny * W + cx] != 0)) continue;
                int n = ny * W + nx;
                if (field[n] < best) { best = field[n]; bx = dx; by = dy; }
            }
            if (bx == 0 && by == 0) return null;
            // aim at the centre of the next cell so bodies do not scrape corners
            return Math.Atan2((cy + by + 0.5) * Cell - y, (cx + bx + 0.5) * Cell - x);
        }
    }
}
