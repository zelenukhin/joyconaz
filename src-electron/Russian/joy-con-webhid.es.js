const Et = async (t) => {
  const e =
      ({
        subcommand: u,
        expectedReport: a,
        timeoutErrorMessage: r = 'timeout.',
      }) =>
      (p) =>
        new Promise((q, I) => {
          const b = setTimeout(() => {
              (p.removeEventListener('inputreport', L), I(new Error(r)));
            }, 5e3),
            L = (C) => {
              const O = C;
              if (O.reportId !== 33) return;
              const A = new Uint8Array(O.data.buffer);
              for (const [k, x] of Object.entries(a))
                if (A[Number(k) - 1] !== x) return;
              (p.removeEventListener('inputreport', L),
                clearTimeout(b),
                setTimeout(q, 50));
            };
          (p.addEventListener('inputreport', L),
            (async () =>
              await p.sendReport(
                1,
                new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, ...u])
              ))());
        }),
    n = e({
      subcommand: [34, 1],
      expectedReport: {
        13: 128,
        14: 34,
      },
    }),
    o = e({
      subcommand: [
        33, 33, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 243,
      ],
      expectedReport: {
        14: 33,
      },
    }),
    l = e({
      subcommand: [89],
      expectedReport: {
        14: 89,
        16: 32,
      },
      timeoutErrorMessage: 'ring-con not found.',
    }),
    h = e({
      subcommand: [
        92, 6, 3, 37, 6, 0, 0, 0, 0, 28, 22, 237, 52, 54, 0, 0, 0, 10, 100, 11,
        230, 169, 34, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 144, 168, 225, 52, 54,
      ],
      expectedReport: {
        14: 92,
      },
    }),
    s = e({
      subcommand: [90, 4, 1, 1, 2],
      expectedReport: {
        14: 90,
      },
    });
  (await n(t), await o(t), await l(t), await h(t), await s(t));
};
function St(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, 'default')
    ? t.default
    : t;
}
var pt, qt;
function At() {
  return (
    qt ||
      ((qt = 1),
      (pt = function (e, n) {
        n = n || {};
        const o = n.kp || 1,
          l = n.ki || 0;
        let s = 1 / (1e3 / e),
          u = n.doInitialisation !== !0,
          a = 2 * o;
        const r = 2 * l;
        let p = 1,
          q = 0,
          I = 0,
          b = 0,
          L = 0,
          C = 0,
          O = 0;
        function A(i, c, d, M, f, w) {
          let v, m, y, P, F, j, B;
          (M !== 0 &&
            f !== 0 &&
            w !== 0 &&
            ((v = (M * M + f * f + w * w) ** -0.5),
            (M *= v),
            (f *= v),
            (w *= v),
            (m = q * b - p * I),
            (y = p * q + I * b),
            (P = p * p - 0.5 + b * b),
            (F = f * P - w * y),
            (j = w * m - M * P),
            (B = M * y - f * m),
            r > 0
              ? ((L += r * F * s),
                (C += r * j * s),
                (O += r * B * s),
                (i += L),
                (c += C),
                (d += O))
              : ((L = 0), (C = 0), (O = 0)),
            (i += a * F),
            (c += a * j),
            (d += a * B)),
            (i *= 0.5 * s),
            (c *= 0.5 * s),
            (d *= 0.5 * s));
          const U = p,
            N = q,
            D = I;
          ((p += -N * i - D * c - b * d),
            (q += U * i + D * d - b * c),
            (I += U * c - N * d + b * i),
            (b += U * d + N * c - D * i),
            (v = (p * p + q * q + I * I + b * b) ** -0.5),
            (p *= v),
            (q *= v),
            (I *= v),
            (b *= v));
        }
        function k(i, c, d, M, f, w) {
          return {
            x: c * w - d * f,
            y: d * M - i * w,
            z: i * f - c * M,
          };
        }
        function x(i, c, d, M, f, w) {
          const v = -Math.atan2(i, Math.sqrt(c * c + d * d)),
            m = k(i, c, d, 1, 0, 0),
            y = k(1, 0, 0, m.x, m.y, m.z),
            P = Math.atan2(y.y, y.z),
            F = Math.cos(P),
            j = Math.sin(v),
            B = Math.sin(P),
            U = f * F - w * B,
            N = M * Math.cos(v) + f * B * j + w * F * j;
          return {
            heading: -Math.atan2(U, N),
            pitch: v,
            roll: P,
          };
        }
        function R(i) {
          const c = Math.cos(i.heading * 0.5),
            d = Math.sin(i.heading * 0.5),
            M = Math.cos(i.pitch * 0.5),
            f = Math.sin(i.pitch * 0.5),
            w = Math.cos(i.roll * 0.5),
            v = Math.sin(i.roll * 0.5);
          return {
            w: w * M * c + v * f * d,
            x: v * M * c - w * f * d,
            y: w * f * c + v * M * d,
            z: w * M * d - v * f * c,
          };
        }
        function _(i, c, d, M, f, w) {
          const v = x(i, c, d, M, f, w),
            m = R(v),
            y = (m.w * m.w + m.x * m.x + m.y * m.y + m.z * m.z) ** -0.5;
          ((p = m.w * y),
            (q = m.x * y),
            (I = m.y * y),
            (b = m.z * y),
            (u = !0));
        }
        function S(i, c, d, M, f, w, v, m, y, P) {
          ((s = P || s), u || _(M, f, w, v, m, y));
          let F,
            j,
            B,
            U,
            N,
            D,
            V,
            Q,
            $,
            g,
            E,
            W,
            lt,
            it,
            X,
            Y,
            at,
            Z,
            z,
            ct,
            G,
            K,
            tt,
            T;
          if (
            v === void 0 ||
            m === void 0 ||
            y === void 0 ||
            (v === 0 && m === 0 && y === 0)
          ) {
            A(i, c, d, M, f, w);
            return;
          }
          (M !== 0 &&
            f !== 0 &&
            w !== 0 &&
            ((F = (M * M + f * f + w * w) ** -0.5),
            (M *= F),
            (f *= F),
            (w *= F),
            (F = (v * v + m * m + y * y) ** -0.5),
            (v *= F),
            (m *= F),
            (y *= F),
            (j = p * p),
            (B = p * q),
            (U = p * I),
            (N = p * b),
            (D = q * q),
            (V = q * I),
            (Q = q * b),
            ($ = I * I),
            (g = I * b),
            (E = b * b),
            (W = 2 * (v * (0.5 - $ - E) + m * (V - N) + y * (Q + U))),
            (lt = 2 * (v * (V + N) + m * (0.5 - D - E) + y * (g - B))),
            (it = Math.sqrt(W * W + lt * lt)),
            (X = 2 * (v * (Q - U) + m * (g + B) + y * (0.5 - D - $))),
            (Y = Q - U),
            (at = B + g),
            (Z = j - 0.5 + E),
            (z = it * (0.5 - $ - E) + X * (Q - U)),
            (ct = it * (V - N) + X * (B + g)),
            (G = it * (U + Q) + X * (0.5 - D - $)),
            (K = f * Z - w * at + (m * G - y * ct)),
            (tt = w * Y - M * Z + (y * z - v * G)),
            (T = M * at - f * Y + (v * ct - m * z)),
            r > 0
              ? ((L += r * K * s),
                (C += r * tt * s),
                (O += r * T * s),
                (i += L),
                (c += C),
                (d += O))
              : ((L = 0), (C = 0), (O = 0)),
            (i += a * K),
            (c += a * tt),
            (d += a * T)),
            (i *= 0.5 * s),
            (c *= 0.5 * s),
            (d *= 0.5 * s));
          const et = p,
            J = q,
            H = I;
          ((p += -J * i - H * c - b * d),
            (q += et * i + H * d - b * c),
            (I += et * c - J * d + b * i),
            (b += et * d + J * c - H * i),
            (F = (p * p + q * q + I * I + b * b) ** -0.5),
            (p *= F),
            (q *= F),
            (I *= F),
            (b *= F));
        }
        return {
          update: S,
          init: _,
          getQuaternion() {
            return {
              w: p,
              x: q,
              y: I,
              z: b,
            };
          },
        };
      })),
    pt
  );
}
var ft, Mt;
function kt() {
  return (
    Mt ||
      ((Mt = 1),
      (ft = function (e, n) {
        n = n || {};
        const o = 1e3 / e;
        let l = n.beta || 0.4,
          h = n.doInitialisation !== !0,
          s = 1,
          u = 0,
          a = 0,
          r = 0,
          p = 1 / o;
        function q(A, k, x, R, _, S) {
          let i, c, d, M, f, w, v, m, y, P, F, j, B, U, N, D, V, Q, $, g, E, W;
          ((w = 0.5 * (-u * A - a * k - r * x)),
            (v = 0.5 * (s * A + a * x - r * k)),
            (m = 0.5 * (s * k - u * x + r * A)),
            (y = 0.5 * (s * x + u * k - a * A)),
            (R === 0 && _ === 0 && S === 0) ||
              ((i = (R * R + _ * _ + S * S) ** -0.5),
              (R *= i),
              (_ *= i),
              (S *= i),
              (P = 2 * s),
              (F = 2 * u),
              (j = 2 * a),
              (B = 2 * r),
              (U = 4 * s),
              (N = 4 * u),
              (D = 4 * a),
              (V = 8 * u),
              (Q = 8 * a),
              ($ = s * s),
              (g = u * u),
              (E = a * a),
              (W = r * r),
              (c = U * E + j * R + U * g - F * _),
              (d =
                N * W - B * R + 4 * $ * u - P * _ - N + V * g + V * E + N * S),
              (M =
                4 * $ * a + P * R + D * W - B * _ - D + Q * g + Q * E + D * S),
              (f = 4 * g * r - F * R + 4 * E * r - j * _),
              (i = (c * c + d * d + M * M + f * f) ** -0.5),
              (c *= i),
              (d *= i),
              (M *= i),
              (f *= i),
              (w -= l * c),
              (v -= l * d),
              (m -= l * M),
              (y -= l * f)),
            (s += w * p),
            (u += v * p),
            (a += m * p),
            (r += y * p),
            (i = (s * s + u * u + a * a + r * r) ** -0.5),
            (s *= i),
            (u *= i),
            (a *= i),
            (r *= i));
        }
        function I(A, k, x, R, _, S) {
          return {
            x: k * S - x * _,
            y: x * R - A * S,
            z: A * _ - k * R,
          };
        }
        function b(A, k, x, R, _, S) {
          const i = -Math.atan2(A, Math.sqrt(k * k + x * x)),
            c = I(A, k, x, 1, 0, 0),
            d = I(1, 0, 0, c.x, c.y, c.z),
            M = Math.atan2(d.y, d.z),
            f = Math.cos(M),
            w = Math.sin(i),
            v = Math.sin(M),
            m = _ * f - S * v,
            y = R * Math.cos(i) + _ * v * w + S * f * w;
          return {
            heading: -Math.atan2(m, y),
            pitch: i,
            roll: M,
          };
        }
        function L(A) {
          const k = Math.cos(A.heading * 0.5),
            x = Math.sin(A.heading * 0.5),
            R = Math.cos(A.pitch * 0.5),
            _ = Math.sin(A.pitch * 0.5),
            S = Math.cos(A.roll * 0.5),
            i = Math.sin(A.roll * 0.5);
          return {
            w: S * R * k + i * _ * x,
            x: i * R * k - S * _ * x,
            y: S * _ * k + i * R * x,
            z: S * R * x - i * _ * k,
          };
        }
        function C(A, k, x, R, _, S) {
          const i = b(A, k, x, R, _, S),
            c = L(i),
            d = (c.w * c.w + c.x * c.x + c.y * c.y + c.z * c.z) ** -0.5;
          ((s = c.w * d),
            (u = c.x * d),
            (a = c.y * d),
            (r = c.z * d),
            (h = !0));
        }
        function O(A, k, x, R, _, S, i, c, d, M) {
          ((p = M || p), h || C(R, _, S, i, c, d));
          let f,
            w,
            v,
            m,
            y,
            P,
            F,
            j,
            B,
            U,
            N,
            D,
            V,
            Q,
            $,
            g,
            E,
            W,
            lt,
            it,
            X,
            Y,
            at,
            Z,
            z,
            ct,
            G,
            K,
            tt,
            T,
            et,
            J,
            H,
            dt,
            rt;
          if (
            i === void 0 ||
            c === void 0 ||
            d === void 0 ||
            (i === 0 && c === 0 && d === 0)
          ) {
            q(A, k, x, R, _, S);
            return;
          }
          ((P = 0.5 * (-u * A - a * k - r * x)),
            (F = 0.5 * (s * A + a * x - r * k)),
            (j = 0.5 * (s * k - u * x + r * A)),
            (B = 0.5 * (s * x + u * k - a * A)),
            (R === 0 && _ === 0 && S === 0) ||
              ((f = (R * R + _ * _ + S * S) ** -0.5),
              (R *= f),
              (_ *= f),
              (S *= f),
              (f = (i * i + c * c + d * d) ** -0.5),
              (i *= f),
              (c *= f),
              (d *= f),
              (D = 2 * s * i),
              (V = 2 * s * c),
              (Q = 2 * s * d),
              ($ = 2 * u * i),
              (it = 2 * s),
              (X = 2 * u),
              (Y = 2 * a),
              (at = 2 * r),
              (Z = 2 * s * a),
              (z = 2 * a * r),
              (ct = s * s),
              (G = s * u),
              (K = s * a),
              (tt = s * r),
              (T = u * u),
              (et = u * a),
              (J = u * r),
              (H = a * a),
              (dt = a * r),
              (rt = r * r),
              (U =
                i * ct -
                V * r +
                Q * a +
                i * T +
                X * c * a +
                X * d * r -
                i * H -
                i * rt),
              (N =
                D * r +
                c * ct -
                Q * u +
                $ * a -
                c * T +
                c * H +
                Y * d * r -
                c * rt),
              (g = Math.sqrt(U * U + N * N)),
              (E =
                -D * a +
                V * u +
                d * ct +
                $ * r -
                d * T +
                Y * c * r -
                d * H +
                d * rt),
              (W = 2 * g),
              (lt = 2 * E),
              (w =
                -Y * (2 * J - Z - R) +
                X * (2 * G + z - _) -
                E * a * (g * (0.5 - H - rt) + E * (J - K) - i) +
                (-g * r + E * u) * (g * (et - tt) + E * (G + dt) - c) +
                g * a * (g * (K + J) + E * (0.5 - T - H) - d)),
              (v =
                at * (2 * J - Z - R) +
                it * (2 * G + z - _) -
                4 * u * (1 - 2 * T - 2 * H - S) +
                E * r * (g * (0.5 - H - rt) + E * (J - K) - i) +
                (g * a + E * s) * (g * (et - tt) + E * (G + dt) - c) +
                (g * r - lt * u) * (g * (K + J) + E * (0.5 - T - H) - d)),
              (m =
                -it * (2 * J - Z - R) +
                at * (2 * G + z - _) -
                4 * a * (1 - 2 * T - 2 * H - S) +
                (-W * a - E * s) * (g * (0.5 - H - rt) + E * (J - K) - i) +
                (g * u + E * r) * (g * (et - tt) + E * (G + dt) - c) +
                (g * s - lt * a) * (g * (K + J) + E * (0.5 - T - H) - d)),
              (y =
                X * (2 * J - Z - R) +
                Y * (2 * G + z - _) +
                (-W * r + E * u) * (g * (0.5 - H - rt) + E * (J - K) - i) +
                (-g * s + E * a) * (g * (et - tt) + E * (G + dt) - c) +
                g * u * (g * (K + J) + E * (0.5 - T - H) - d)),
              (f = (w * w + v * v + m * m + y * y) ** -0.5),
              (w *= f),
              (v *= f),
              (m *= f),
              (y *= f),
              (P -= l * w),
              (F -= l * v),
              (j -= l * m),
              (B -= l * y)),
            (s += P * p),
            (u += F * p),
            (a += j * p),
            (r += B * p),
            (f = (s * s + u * u + a * a + r * r) ** -0.5),
            (s *= f),
            (u *= f),
            (a *= f),
            (r *= f));
        }
        return {
          update: O,
          init: C,
          getQuaternion() {
            return {
              w: s,
              x: u,
              y: a,
              z: r,
            };
          },
        };
      })),
    ft
  );
}
var vt, It;
function xt() {
  if (It) return vt;
  It = 1;
  const t = 180 / Math.PI;
  function e(n) {
    n = n || {};
    const o = n.sampleInterval || 20,
      l = n.algorithm || 'Madgwick';
    let h;
    if (l === 'Mahony') h = At();
    else if (l === 'Madgwick') h = kt();
    else throw new Error(`AHRS(): Algorithm not valid: ${l}`);
    const s = h(o, n),
      u = this;
    Object.keys(s).forEach((a) => (u[a] = s[a]));
  }
  return (
    (e.prototype.toVector = function () {
      const o = this.getQuaternion(),
        l = 2 * Math.acos(o.w),
        h = Math.sin(l / 2);
      return {
        angle: l,
        x: o.x / h,
        y: o.y / h,
        z: o.z / h,
      };
    }),
    (e.prototype.getEulerAngles = function () {
      const o = this.getQuaternion(),
        l = o.w * o.w,
        h = o.x * o.x,
        s = o.y * o.y,
        u = o.z * o.z;
      return {
        heading: Math.atan2(2 * (o.x * o.y + o.z * o.w), h - s - u + l),
        pitch: -Math.asin(2 * (o.x * o.z - o.y * o.w)),
        roll: Math.atan2(2 * (o.y * o.z + o.x * o.w), -h - s + u + l),
      };
    }),
    (e.prototype.getEulerAnglesDegrees = function () {
      const o = this.getEulerAngles();
      return {
        heading: o.heading * t,
        pitch: o.pitch * t,
        roll: o.roll * t,
      };
    }),
    (vt = e),
    vt
  );
}
var Ft = xt();
const Lt = /* @__PURE__ */ St(Ft);
function Bt(t, e) {
  let n;
  for (const o of t) {
    const l = e(o);
    l !== void 0 && (n = n === void 0 ? l : n + l);
  }
  return n;
}
function ut(t, e = (n) => n) {
  const n = t == null ? 0 : t.length,
    o = Bt(t, e);
  return n ? o / n : Number.NaN;
}
function Ut(t) {
  let e;
  switch (t[0]) {
    case '8':
      e = 'full';
      break;
    case '4':
      e = 'medium';
      break;
    case '2':
      e = 'low';
      break;
    case '1':
      e = 'critical';
      break;
    case '0':
      e = 'empty';
      break;
    default:
      e = 'charging';
  }
  return e;
}
const Ct = {
    // biome-ignore lint/complexity/useSimpleNumberKeys:
    1: 'Left Joy-Con',
    // biome-ignore lint/complexity/useSimpleNumberKeys:
    2: 'Right Joy-Con',
    // biome-ignore lint/complexity/useSimpleNumberKeys:
    3: 'Pro Controller',
  },
  ht = 0.75,
  Nt = 0.0125,
  _t = Math.PI / 2;
function Pt(t, e, n, o) {
  const l = Date.now(),
    h = t.timestamp ? (l - t.timestamp) / 1e3 : 0;
  t.timestamp = l;
  const s = Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2);
  return (
    (t.alpha = (1 - Nt) * (t.alpha + e.z * h)),
    s !== 0 &&
      ((t.beta = ht * (t.beta + e.x * h) + (1 - ht) * ((n.x * _t) / s)),
      (t.gamma = ht * (t.gamma + e.y * h) + (1 - ht) * ((n.y * -_t) / s))),
    {
      alpha:
        o === 8198
          ? ((((-1 * (t.alpha * 180)) / Math.PI) * 430) % 90).toFixed(6)
          : ((((t.alpha * 180) / Math.PI) * 430) % 360).toFixed(6),
      beta: ((-1 * (t.beta * 180)) / Math.PI).toFixed(6),
      gamma:
        o === 8198
          ? ((-1 * (t.gamma * 180)) / Math.PI).toFixed(6)
          : ((t.gamma * 180) / Math.PI).toFixed(6),
    }
  );
}
function Dt(t) {
  const e = 180 / Math.PI,
    n = t.w * t.w,
    o = t.x * t.x,
    l = t.y * t.y,
    h = t.z * t.z;
  return {
    alpha: (e * Math.atan2(2 * (t.x * t.y + t.z * t.w), o - l - h + n)).toFixed(
      6
    ),
    beta: (e * -Math.asin(2 * (t.x * t.z - t.y * t.w))).toFixed(6),
    gamma: (
      e * Math.atan2(2 * (t.y * t.z + t.x * t.w), -o - l + h + n)
    ).toFixed(6),
  };
}
function nt(t) {
  const e = new DataView(t.buffer);
  return Number.parseFloat((244e-6 * e.getInt16(0, !0)).toFixed(6));
}
function ot(t) {
  const e = new DataView(t.buffer);
  return Number.parseFloat((0.06103 * e.getInt16(0, !0)).toFixed(6));
}
function st(t) {
  const e = new DataView(t.buffer);
  return Number.parseFloat((1694e-7 * e.getInt16(0, !0)).toFixed(6));
}
function Ht(t) {
  const e = t.slice(15, 26),
    n = e.slice(0, 1)[0],
    o = e.slice(1, 2)[0],
    l = e.slice(2, 3),
    h = e.slice(4, 10),
    s = [];
  for (const r of h) s.push(r.toString(16));
  const u = e.slice(11, 12);
  return {
    _raw: e.slice(0, 12),
    _hex: e.slice(0, 12),
    firmwareVersion: {
      major: n,
      minor: o,
    },
    type: Ct[l[0]],
    macAddress: s.join(':'),
    spiColorInUse: u[0] === 1,
  };
}
function Ot(t, e) {
  return {
    _raw: t.slice(0, 1),
    // index 0
    _hex: e.slice(0, 1),
  };
}
function jt(t, e) {
  return {
    _raw: t.slice(1, 2),
    // index 1
    _hex: e.slice(1, 2),
  };
}
function Jt(t, e) {
  return {
    _raw: t.slice(2, 3),
    // high nibble
    _hex: e.slice(2, 3),
    level: Ut(e.slice(2, 3)),
  };
}
function Qt(t, e) {
  return {
    _raw: t.slice(2, 3),
    // low nibble
    _hex: e.slice(2, 3),
  };
}
function Tt(t, e) {
  return {
    _raw: t.slice(1, 3),
    // index 1,2
    _hex: e.slice(1, 3),
  };
}
function $t(t, e) {
  return {
    _raw: t.slice(3, 6),
    // index 3,4,5
    _hex: e.slice(3, 6),
    // Byte 3 (Right Joy-Con)
    y: !!(1 & t[3]),
    x: !!(2 & t[3]),
    b: !!(4 & t[3]),
    a: !!(8 & t[3]),
    r: !!(64 & t[3]),
    zr: !!(128 & t[3]),
    // Byte 5 (Left Joy-Con)
    down: !!(1 & t[5]),
    up: !!(2 & t[5]),
    right: !!(4 & t[5]),
    left: !!(8 & t[5]),
    l: !!(64 & t[5]),
    zl: !!(128 & t[5]),
    // Byte 3,5 (Shared)
    sr: !!(16 & t[3]) || !!(16 & t[5]),
    sl: !!(32 & t[3]) || !!(32 & t[5]),
    // Byte 4 (Shared)
    minus: !!(1 & t[4]),
    plus: !!(2 & t[4]),
    rightStick: !!(4 & t[4]),
    leftStick: !!(8 & t[4]),
    home: !!(16 & t[4]),
    capture: !!(32 & t[4]),
    chargingGrip: !!(128 & t[4]),
  };
}
function Gt(t, e) {
  return {
    _raw: t.slice(3, 4),
    // index 3
    _hex: e.slice(3, 4),
  };
}
function Kt(t, e) {
  let n = t[6] | ((t[7] & 15) << 8);
  n = (n / 1995 - 1) * 2;
  let o = ((t[7] >> 4) | (t[8] << 4)) * -1;
  return (
    (o = (o / 2220 + 1) * 2),
    {
      _raw: t.slice(6, 9),
      // index 6,7,8
      _hex: e.slice(6, 9),
      horizontal: n.toFixed(1),
      vertical: o.toFixed(1),
    }
  );
}
function Vt(t, e) {
  let n = t[9] | ((t[10] & 15) << 8);
  n = (n / 1995 - 1) * 2;
  let o = ((t[10] >> 4) | (t[11] << 4)) * -1;
  return (
    (o = (o / 2220 + 1) * 2),
    {
      _raw: t.slice(9, 12),
      // index 9,10,11
      _hex: e.slice(9, 12),
      horizontal: n.toFixed(1),
      vertical: o.toFixed(1),
    }
  );
}
function Wt(t, e) {
  return {
    _raw: t.slice(4),
    // index 4
    _hex: e.slice(4),
  };
}
function Xt(t, e) {
  return {
    _raw: t.slice(12, 13),
    // index 12
    _hex: e.slice(12, 13),
  };
}
function Yt(t, e) {
  return {
    _raw: t.slice(13, 14),
    // index 13
    _hex: e.slice(13, 14),
  };
}
function Zt(t, e) {
  return {
    _raw: t.slice(14, 15),
    // index 14
    _hex: e.slice(14, 15),
  };
}
function zt(t, e) {
  return {
    _raw: t.slice(15),
    // index 15 ~
    _hex: e.slice(15),
  };
}
function te(t, e) {
  return [
    {
      x: {
        _raw: t.slice(13, 15),
        // index 13,14
        _hex: e.slice(13, 15),
        acc: nt(t.slice(13, 15)),
      },
      y: {
        _raw: t.slice(15, 17),
        // index 15,16
        _hex: e.slice(15, 17),
        acc: nt(t.slice(15, 17)),
      },
      z: {
        _raw: t.slice(17, 19),
        // index 17,18
        _hex: e.slice(17, 19),
        acc: nt(t.slice(17, 19)),
      },
    },
    {
      x: {
        _raw: t.slice(25, 27),
        // index 25,26
        _hex: e.slice(25, 27),
        acc: nt(t.slice(25, 27)),
      },
      y: {
        _raw: t.slice(27, 29),
        // index 27,28
        _hex: e.slice(27, 29),
        acc: nt(t.slice(27, 29)),
      },
      z: {
        _raw: t.slice(29, 31),
        // index 29,30
        _hex: e.slice(29, 31),
        acc: nt(t.slice(29, 31)),
      },
    },
    {
      x: {
        _raw: t.slice(37, 39),
        // index 37,38
        _hex: e.slice(37, 39),
        acc: nt(t.slice(37, 39)),
      },
      y: {
        _raw: t.slice(39, 41),
        // index 39,40
        _hex: e.slice(39, 41),
        acc: nt(t.slice(39, 41)),
      },
      z: {
        _raw: t.slice(41, 43),
        // index 41,42
        _hex: e.slice(41, 43),
        acc: nt(t.slice(41, 43)),
      },
    },
  ];
}
function ee(t, e) {
  return [
    [
      {
        _raw: t.slice(19, 21),
        // index 19,20
        _hex: e.slice(19, 21),
        dps: ot(t.slice(19, 21)),
        rps: st(t.slice(19, 21)),
      },
      {
        _raw: t.slice(21, 23),
        // index 21,22
        _hex: e.slice(21, 23),
        dps: ot(t.slice(21, 23)),
        rps: st(t.slice(21, 23)),
      },
      {
        _raw: t.slice(23, 25),
        // index 23,24
        _hex: e.slice(23, 25),
        dps: ot(t.slice(23, 25)),
        rps: st(t.slice(23, 25)),
      },
    ],
    [
      {
        _raw: t.slice(31, 33),
        // index 31,32
        _hex: e.slice(31, 33),
        dps: ot(t.slice(31, 33)),
        rps: st(t.slice(31, 33)),
      },
      {
        _raw: t.slice(33, 35),
        // index 33,34
        _hex: e.slice(33, 35),
        dps: ot(t.slice(33, 35)),
        rps: st(t.slice(33, 35)),
      },
      {
        _raw: t.slice(35, 37),
        // index 35,36
        _hex: e.slice(35, 37),
        dps: ot(t.slice(35, 37)),
        rps: st(t.slice(35, 37)),
      },
    ],
    [
      {
        _raw: t.slice(43, 45),
        // index 43,44
        _hex: e.slice(43, 45),
        dps: ot(t.slice(43, 45)),
        rps: st(t.slice(43, 45)),
      },
      {
        _raw: t.slice(45, 47),
        // index 45,46
        _hex: e.slice(45, 47),
        dps: ot(t.slice(45, 47)),
        rps: st(t.slice(45, 47)),
      },
      {
        _raw: t.slice(47, 49),
        // index 47,48
        _hex: e.slice(47, 49),
        dps: ot(t.slice(47, 49)),
        rps: st(t.slice(47, 49)),
      },
    ],
  ];
}
function ne(t) {
  const e = 5e-3 * t.length;
  return {
    x: Number.parseFloat((ut(t.map(([o]) => o)) * e).toFixed(6)),
    y: Number.parseFloat((ut(t.map(([, o]) => o)) * e).toFixed(6)),
    z: Number.parseFloat((ut(t.map(([, , o]) => o)) * e).toFixed(6)),
  };
}
function Rt(t) {
  const e = 5e-3 * t.length,
    n = [
      ut(t.map((o) => o[0])),
      ut(t.map((o) => o[1])),
      ut(t.map((o) => o[2])),
    ].map((o) => Number.parseFloat((o * e).toFixed(6)));
  return {
    x: n[0],
    y: n[1],
    z: n[2],
  };
}
function oe(t, e) {
  return {
    _raw: t.slice(38, 2),
    _hex: e.slice(38, 2),
    strain: new DataView(t.buffer, 39, 2).getInt16(0, !0),
  };
}
function se(t, e) {
  const n = new (Object.getPrototypeOf(t).constructor)(t.length + e.length);
  return (n.set(t, 0), n.set(e, t.length), n);
}
class bt extends EventTarget {
  eventListenerAttached = !1;
  quaternion;
  madgwick;
  device;
  lastValues;
  ledstate = 0;
  /**
   * Creates an instance of the JoyCon class.
   *
   * @param device - The HIDDevice instance representing the connected Joy-Con controller.
   *
   * Initializes the device and sets up the initial state for sensor values,
   * including timestamp, alpha, beta, and gamma.
   */
  constructor(e) {
    (super(),
      (this.device = e),
      (this.lastValues = {
        timestamp: null,
        alpha: 0,
        beta: 0,
        gamma: 0,
      }),
      (e.productId === 8198 || e.productId === 8199) &&
        ((this.madgwick = new Lt({
          sampleInterval: 10,
          algorithm: 'Madgwick',
        })),
        (this.quaternion = this.madgwick.getQuaternion())));
  }
  /**
   * Registers an event listener for a specific JoyCon event type.
   *
   * @typeParam K - The type of the JoyCon event to listen for, constrained to the keys of `JoyConEvents`.
   * @param type - The event type to listen for.
   * @param listener - The callback function that will be invoked when the event is dispatched.
   *                   The `this` context within the listener is bound to the current `JoyCon` instance,
   *                   and the event object is of the type corresponding to the event type.
   * @param options - Optional. An options object specifying characteristics about the event listener,
   *                  or a boolean indicating whether events of this type will be dispatched to the registered listener before being dispatched to any EventTarget beneath it in the DOM tree.
   */
  on(e, n, o) {
    super.addEventListener(e, n, o);
  }
  /**
   * Opens a connection to the Joy-Con device if it is not already opened,
   * and attaches an event listener for input reports.
   *
   * @returns {Promise<void>} A promise that resolves when the device is opened and the event listener is attached.
   */
  async open() {
    (this.device.opened || (await this.device.open()),
      this.device.addEventListener(
        'inputreport',
        this._onInputReport.bind(this)
      ));
  }
  /**
   * Sends a request to the Joy-Con device to retrieve device information.
   *
   * This method sends a specific output report to the device and listens for a
   * "deviceinfo" event. When the event is received, it resolves with the device
   * information, excluding any raw or hexadecimal data fields.
   *
   * @returns A promise that resolves with the cleaned device information object.
   */
  async getRequestDeviceInfo() {
    const o = [0, 0, 0, 0, 0, 0, 0, 0, 0, ...[2]],
      l = new Promise((h) => {
        const s = ({ detail: u }) => {
          const { _raw: a, _hex: r, ...p } = u;
          h(p);
        };
        this.addEventListener('deviceinfo', s, {
          once: !0,
        });
      });
    return (await this.device.sendReport(1, new Uint8Array(o)), l);
  }
  /**
   * Requests the current battery level from the Joy-Con device.
   *
   * Sends a specific output report to the device to query the battery level,
   * then listens for a "batterylevel" custom event. Once the event is received,
   * it resolves with the battery level information, excluding any raw or hex data.
   *
   * @returns {Promise<unknown>} A promise that resolves with the cleaned battery level data.
   */
  async getBatteryLevel() {
    const o = [0, 0, 0, 0, 0, 0, 0, 0, 0, ...[80]],
      l = new Promise((h) => {
        const s = ({ detail: u }) => {
          const { _raw: a, _hex: r, ...p } = u;
          h(p);
        };
        this.addEventListener('batterylevel', s, {
          once: !0,
        });
      });
    return (await this.device.sendReport(1, new Uint8Array(o)), l);
  }
  /**
   * Enables the Simple HID mode on the connected Joy-Con device.
   *
   * This method sends a specific output report to the device to switch it into
   * Simple HID mode, which allows for basic input/output communication.
   *
   * @returns {Promise<void>} A promise that resolves once the command has been sent.
   * @throws {DOMException} If the report cannot be sent to the device.
   */
  async enableSimpleHIDMode() {
    const o = [0, 0, 0, 0, 0, 0, 0, 0, 0, ...[3, 63]];
    await this.device.sendReport(1, new Uint8Array(o));
  }
  /**
   * Enables the "Standard Full Mode" on the Joy-Con device by sending the appropriate subcommand.
   *
   * This mode allows the Joy-Con to report all standard input data, including button presses,
   * analog stick positions, and sensor data. The method constructs the required data packet
   * and sends it to the device using the HID report protocol.
   *
   * @returns {Promise<void>} A promise that resolves once the command has been sent.
   * @throws {Error} If the device communication fails.
   */
  async enableStandardFullMode() {
    const o = [0, 0, 0, 0, 0, 0, 0, 0, 0, ...[3, 48]];
    await this.device.sendReport(1, new Uint8Array(o));
  }
  /**
   * Enables the IMU (Inertial Measurement Unit) mode on the Joy-Con device.
   *
   * Sends a subcommand to the device to activate the IMU, which allows the Joy-Con
   * to start reporting motion sensor data such as accelerometer and gyroscope readings.
   *
   * @returns A promise that resolves when the command has been sent to the device.
   * @throws Will throw an error if sending the report to the device fails.
   */
  async enableIMUMode() {
    const o = [0, 0, 0, 0, 0, 0, 0, 0, 0, ...[64, 1]];
    await this.device.sendReport(1, new Uint8Array(o));
  }
  /**
   * Disables the IMU (Inertial Measurement Unit) mode on the connected Joy-Con device.
   *
   * Sends a subcommand to the device to turn off IMU functionality, which includes
   * the accelerometer and gyroscope sensors. This can be useful for reducing power
   * consumption or when IMU data is not needed.
   *
   * @returns A promise that resolves when the command has been sent to the device.
   * @throws Will throw an error if sending the report to the device fails.
   */
  async disableIMUMode() {
    const o = [0, 0, 0, 0, 0, 0, 0, 0, 0, ...[64, 0]];
    await this.device.sendReport(1, new Uint8Array(o));
  }
  /**
   * Enables the vibration feature on the connected Joy-Con device.
   *
   * This method sends a specific output report to the device to activate vibration.
   * It constructs the required data packet, including the subcommand for enabling vibration,
   * and transmits it using the WebHID API.
   *
   * @returns A promise that resolves when the vibration command has been sent.
   * @throws {DOMException} If sending the report to the device fails.
   */
  async enableVibration() {
    const o = [0, 0, 1, 64, 64, 0, 1, 64, 64, ...[72, 1]];
    await this.device.sendReport(1, new Uint8Array(o));
  }
  /**
   * Disables the vibration feature on the connected Joy-Con controller.
   *
   * Sends a specific output report to the device to turn off vibration.
   * This method constructs the appropriate data packet and sends it using the WebHID API.
   *
   * @returns A promise that resolves when the vibration disable command has been sent.
   */
  async disableVibration() {
    const o = [0, 0, 1, 64, 64, 0, 1, 64, 64, ...[72, 0]];
    await this.device.sendReport(1, new Uint8Array(o));
  }
  /**
   * Enables RingCon.
   *
   * @memberof JoyCon
   * @seeAlso https://github.com/mascii/demo-of-ring-con-with-web-hid
   */
  async enableRingCon() {
    await Et(this.device);
  }
  /**
   * Enables the USB HID joystick report mode for the connected device.
   *
   * This method checks if the device supports a specific output report (with reportId 0x80).
   * If supported, it sends a sequence of USB HID reports to the device to enable joystick reporting.
   * The sequence of reports is required to properly initialize the device for joystick input over USB.
   *
   * @returns {Promise<void>} A promise that resolves once the reports have been sent.
   */
  async enableUSBHIDJoystickReport() {
    this.device.collections[0].outputReports?.find((n) => n.reportId === 128) !=
      null &&
      (await this.device.sendReport(128, new Uint8Array([1])),
      await this.device.sendReport(128, new Uint8Array([2])),
      await this.device.sendReport(1, new Uint8Array([3])),
      await this.device.sendReport(128, new Uint8Array([4])));
  }
  /**
   * Sends a rumble (vibration) command to the Joy-Con device with the specified frequency and amplitude parameters.
   *
   * @param lowFrequency - The low frequency value for the rumble effect (in Hz). Must be between 40.875885 and 626.286133.
   * @param highFrequency - The high frequency value for the rumble effect (in Hz). Must be between 81.75177 and 1252.572266.
   * @param amplitude - The amplitude (strength) of the rumble effect. Must be between 0 (off) and 1 (maximum).
   * @returns A promise that resolves when the rumble command has been sent to the device.
   *
   * @remarks
   * This method encodes the frequency and amplitude values into the format expected by the Joy-Con hardware,
   * clamps the input values to their valid ranges, and sends the resulting data packet via HID.
   * The rumble effect is applied to both left and right motors of the Joy-Con.
   */
  async rumble(e, n, o) {
    const l = (b, L, C) => Math.min(Math.max(b, L), C),
      s = new Uint8Array(9);
    s[0] = 0;
    let u = l(e, 40.875885, 626.286133),
      a = l(n, 81.75177, 1252.572266);
    ((a = (Math.round(32 * Math.log2(a * 0.1)) - 96) * 4),
      (u = Math.round(32 * Math.log2(u * 0.1)) - 64));
    const r = l(o, 0, 1);
    let p;
    r === 0
      ? (p = 0)
      : r < 0.117
        ? (p = (Math.log2(r * 1e3) * 32 - 96) / (5 - r ** 2) - 1)
        : r < 0.23
          ? (p = Math.log2(r * 1e3) * 32 - 96 - 92)
          : (p = (Math.log2(r * 1e3) * 32 - 96) * 2 - 246);
    let q = Math.round(p) * 0.5;
    const I = q % 2;
    (I > 0 && --q,
      (q = q >> 1),
      (q += 64),
      I > 0 && (q |= 32768),
      (s[1] = a & 255),
      (s[2] = p + ((a >>> 8) & 255)),
      (s[3] = u + ((q >>> 8) & 255)),
      (s[4] += q & 255));
    for (let b = 0; b < 4; b++) s[5 + b] = s[1 + b];
    await this.device.sendReport(16, new Uint8Array(s));
  }
  /**
   * Sets the blinking pattern for the Home LED on the Right Joy-Con device.
   *
   * Sends a subcommand to the device to control the Home LED.
   *
   * @param miniCycleDuration: Global mini cycle duration. 0-15. 0: off, 1: 8ms, ... , 15: 175ms
   * @param numCycles: Number of full cycles. 0-15. 0: repeat forever.
   * @param startIntensity: Initial LED intensity. 0-15.
   * @param cycleData: Array of {@link HomeLEDpatterns}. The maximum count of the array is 15.
   */
  /* Inspired by the JoyConSwift library */
  async setHomeLEDPattern(e, n, o, l) {
    const h = (L, C, O) => Math.min(Math.max(L, C), O),
      u = Math.min(l.length, 15),
      a = (u << 4) | h(e, 0, 15),
      r = (h(o, 0, 15) << 4) | h(n, 0, 15),
      p = [a, r],
      q = {
        intensity: 15,
        fadeDuration: 0,
        duration: 0,
      },
      I = l.slice(0, u).concat(Array(16 - u).fill(q));
    for (let L = 0; L < 8; L++) {
      const C = I[L * 2],
        O = I[L * 2 + 1],
        A = h(C.intensity, 0, 15),
        k = h(C.fadeDuration, 0, 15),
        x = h(C.duration, 0, 15),
        R = h(O.intensity, 0, 15),
        _ = h(O.fadeDuration, 0, 15),
        S = h(O.duration, 0, 15);
      (p.push((A << 4) | R), p.push((k << 4) | x), p.push((_ << 4) | S));
    }
    p.pop();
    const b = [0, 0, 0, 0, 0, 0, 0, 0, 0, 56, ...p];
    await this.device.sendReport(1, new Uint8Array(b));
  }
  /**
   * Turn `on` or `off` the Home LED on the Right Joy-Con device.
   *
   * @param {boolean} on - If true, the LED will be turned on permanently. Turn the LED off otherwise.
   *
   */
  async setHomeLED(e) {
    e === !0
      ? await this.setHomeLEDPattern(1, 0, 15, [])
      : await this.setHomeLEDPattern(0, 1, 0, []);
  }
  /**
   * Sets the LED state on the Joy-Con device.
   *
   * Sends a subcommand to the device to control the LED indicators.
   *
   * @param n - The LED state value to set. The value determines which LEDs are turned on or off.
   * @returns A promise that resolves when the command has been sent to the device.
   */
  async setLEDState(e) {
    const n = [0, 0, 0, 0, 0, 0, 0, 0],
      o = [48, e];
    await this.device.sendReport(1, new Uint8Array([...n, 0, ...o]));
  }
  /**
   * Sets the specified LED on the Joy-Con controller.
   *
   * Updates the internal LED state by turning on the LED at the given index `n`,
   * then sends the updated state to the device.
   *
   * @param n - The index of the LED to turn on (0-based).
   * @returns A promise that resolves when the LED state has been updated.
   */
  async setLED(e) {
    ((this.ledstate |= 1 << e), await this.setLEDState(this.ledstate));
  }
  /**
   * Resets (turns off) the LED at the specified index by clearing its corresponding bits
   * in the internal LED state and updates the device.
   *
   * @param n - The index of the LED to reset (0-based).
   * @returns A promise that resolves when the LED state has been updated.
   */
  async resetLED(e) {
    ((this.ledstate &= ~((1 << e) | (1 << (4 + e)))),
      await this.setLEDState(this.ledstate));
  }
  /**
   * Blinks the specified LED on the Joy-Con controller.
   *
   * This method updates the internal LED state by first turning off the LED at position `n`,
   * then setting the corresponding blink bit for that LED. It then sends the updated state
   * to the controller.
   *
   * @param n - The index of the LED to blink (typically 0-3).
   * @returns A promise that resolves when the LED state has been updated.
   */
  async blinkLED(e) {
    ((this.ledstate &= ~(1 << e)),
      (this.ledstate |= 1 << (4 + e)),
      await this.setLEDState(this.ledstate));
  }
  /**
   * Handles the HID input report event from a Joy-Con device, parses the incoming data,
   * and emits structured input events based on the report type.
   *
   * @param event - The HID input report event containing the data, reportId, and device.
   * @remarks
   * This method processes different types of input reports (e.g., 0x3f, 0x21, 0x30) by parsing
   * the raw data using various PacketParser methods. It extracts information such as button status,
   * analog stick positions, battery level, accelerometer and gyroscope data, and device info.
   * The parsed data is then dispatched to relevant handlers and listeners.
   *
   * @private
   */
  _onInputReport({ data: e, reportId: n, device: o }) {
    if (!e) return;
    const l = se(new Uint8Array([n]), new Uint8Array(e.buffer)),
      h = Array.from(l)
        .map((u) => u.toString(16).padStart(2, '0'))
        .join('');
    let s = {
      inputReportID: Ot(l, h),
    };
    switch (n) {
      case 63: {
        s = {
          ...s,
          buttonStatus: Tt(l, h),
          analogStick: Gt(l, h),
          filter: Wt(l, h),
        };
        break;
      }
      case 33:
      case 48: {
        if (
          ((s = {
            ...s,
            timer: jt(l, h),
            batteryLevel: Jt(l, h),
            connectionInfo: Qt(l, h),
            buttonStatus: $t(l, h),
            analogStickLeft: Kt(l, h),
            analogStickRight: Vt(l, h),
            vibrator: Xt(l, h),
          }),
          n === 33 &&
            (s = {
              ...s,
              ack: Yt(l, h),
              subcommandID: Zt(l, h),
              subcommandReplyData: zt(l, h),
              deviceInfo: Ht(l),
            }),
          n === 48)
        ) {
          const u = te(l, h),
            a = ee(l, h),
            r = Rt(a.map((I) => I.map((b) => b.rps ?? 0))),
            p = Rt(a.map((I) => I.map((b) => b.dps ?? 0))),
            q = ne(u.map((I) => [I.x.acc ?? 0, I.y.acc ?? 0, I.z.acc ?? 0]));
          (this.madgwick.update(r.x, r.y, r.z, q.x, q.y, q.z),
            (s = {
              ...s,
              accelerometers: u,
              gyroscopes: a,
              actualAccelerometer: q,
              actualGyroscope: { dps: p, rps: r },
              actualOrientation: Pt(this.lastValues, r, q, o.productId),
              actualOrientationQuaternion: Dt(this.quaternion),
              quaternion: this.quaternion,
              ringCon: oe(l, h),
            }));
        }
        break;
      }
    }
    (s.deviceInfo?.type && this._receiveDeviceInfo(s.deviceInfo),
      s.batteryLevel?.level && this._receiveBatteryLevel(s.batteryLevel),
      this._receiveInputEvent(s));
  }
  /**
   * Dispatches a "deviceinfo" custom event with the provided device information as its detail.
   *
   * @param deviceInfo - The information about the device to be included in the event detail.
   */
  _receiveDeviceInfo(e) {
    this.dispatchEvent(new CustomEvent('deviceinfo', { detail: e }));
  }
  /**
   * Dispatches a "batterylevel" custom event with the provided battery level detail.
   *
   * @param batteryLevel - The battery level information to include in the event detail.
   */
  _receiveBatteryLevel(e) {
    this.dispatchEvent(new CustomEvent('batterylevel', { detail: e }));
  }
  // To be overridden by subclasses
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _receiveInputEvent(e) {}
}
class ie extends bt {
  /**
   * Handles an input event packet by removing specific button statuses and dispatching a custom "hidinput" event.
   *
   * @param packet - The input event data containing button statuses and other information.
   *
   * The method sets the following button statuses to `undefined` in the `buttonStatus` object:
   * - x
   * - y
   * - b
   * - a
   * - plus
   * - r
   * - zr
   * - home
   * - rightStick
   *
   * After modifying the packet, it dispatches a `CustomEvent` named "hidinput" with the modified packet as its detail.
   */
  _receiveInputEvent(e) {
    const n = e.buttonStatus;
    ((n.x = void 0),
      (n.y = void 0),
      (n.b = void 0),
      (n.a = void 0),
      (n.plus = void 0),
      (n.r = void 0),
      (n.zr = void 0),
      (n.home = void 0),
      (n.rightStick = void 0),
      this.dispatchEvent(new CustomEvent('hidinput', { detail: e })));
  }
}
class ce extends bt {
  /**
   * Handles an input event packet from the Joy-Con device, sanitizes specific button statuses by setting them to `undefined`,
   * and dispatches a "hidinput" custom event with the modified packet as its detail.
   *
   * @param packet - The input event data received from the Joy-Con, expected to contain a `buttonStatus` property.
   */
  _receiveInputEvent(e) {
    const n = e.buttonStatus;
    ((n.up = void 0),
      (n.down = void 0),
      (n.left = void 0),
      (n.right = void 0),
      (n.minus = void 0),
      (n.l = void 0),
      (n.zl = void 0),
      (n.capture = void 0),
      (n.leftStick = void 0),
      this.dispatchEvent(new CustomEvent('hidinput', { detail: e })));
  }
}
class re extends bt {
  /**
   * Dispatches a "hidinput" custom event with the provided packet as its detail.
   *
   * @param packet - The input data received from the HID device.
   */
  _receiveInputEvent(e) {
    this.dispatchEvent(new CustomEvent('hidinput', { detail: e }));
  }
}
const le = async (t) => {
    let e = null;
    return (
      t.productId === 8198
        ? (e = new ie(t))
        : t.productId === 8199 &&
          t.productName === 'Joy-Con (R)' &&
          (e = new ce(t)),
      e || (e = new re(t)),
      await e.open(),
      await e.enableUSBHIDJoystickReport(),
      await e.enableStandardFullMode(),
      await e.enableIMUMode(),
      e
    );
  },
  yt = /* @__PURE__ */ new Map(),
  mt = [],
  gt = (t) => {
    const e = mt.indexOf(t);
    return e >= 0 ? e : (mt.push(t), mt.length - 1);
  },
  wt = async (t) => {
    const e = gt(t);
    (console.log(
      `HID connected: ${e} ${t.productId.toString(16)} ${t.productName}`
    ),
      yt.set(e, await le(t)));
  },
  ae = async (t) => {
    const e = gt(t);
    (console.log(
      `HID disconnected: ${e} ${t.productId.toString(16)} ${t.productName}`
    ),
      yt.delete(e));
  };
navigator.hid.addEventListener('connect', async ({ device: t }) => {
  wt(t);
});
navigator.hid.addEventListener('disconnect', ({ device: t }) => {
  ae(t);
});
document.addEventListener('DOMContentLoaded', async () => {
  const t = await navigator.hid.getDevices();
  for (const e of t) await wt(e);
});
const ue = async () => {
  const t = [
    {
      vendorId: 1406,
      // Nintendo Co., Ltd
    },
  ];
  try {
    const [e] = await navigator.hid.requestDevice({ filters: t });
    if (!e) return;
    await wt(e);
  } catch (e) {
    e instanceof Error ? console.error(e.name, e.message) : console.error(e);
  }
};
export {
  re as GeneralController,
  ie as JoyConLeft,
  ce as JoyConRight,
  ue as connectJoyCon,
  yt as connectedJoyCons,
};