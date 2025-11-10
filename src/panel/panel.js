function getCSSVar(varName) {
  // 直接从 :root 获取，无需创建元素
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}
function singleLinear(points, x) {
  const p0 = points[0],
    p1 = points[1];
  if (x <= p0.x) return p0.y;
  if (x >= p1.x) return p1.y;
  const t = (x - p0.x) / (p1.x - p0.x);
  return p0.y + t * (p1.y - p0.y);
}

/**
 * 将数字字符串分割为数字数组，自动识别多种分割符
 * @param {string} str - 输入字符串，如 "1 2.0，-1"
 * @returns {number[]} 数字数组
 */
function parseNumberArray(str) {
  if (!str || typeof str !== "string") {
    return [];
  }

  // 移除首尾空白
  str = str.trim();
  if (str === "") return [];

  // 使用正则匹配所有可能的数字（包括负数、小数）
  // 正则说明：
  // -?        : 可选负号
  // \d*       : 0个或多个数字（处理 .5 这种情况）
  // \.?       : 可选小数点
  // \d+       : 1个或多个数字（确保至少有一个数字）
  const numberRegex = /-?\d*\.?\d+/g;
  const matches = str.match(numberRegex);

  if (!matches) return [];

  // 转换为数字并过滤无效值
  return matches
    .map((numStr) => parseFloat(numStr))
    .filter((num) => !isNaN(num));
}

/**
 * 提取数字字符串中的所有分割符（非数字部分）
 * @param {string} str - 输入字符串
 * @returns {string[]} 分割符数组
 */
function extractSeparators(str) {
  if (!str || typeof str !== "string") {
    return [];
  }

  str = str.trim();
  if (str === "") return [];

  // 移除所有数字、负号、小数点，剩下的就是分割符
  // 保留分割符的原始顺序和重复
  const numberRegex = /-?\d*\.?\d+/g;
  const separators = [];
  let lastIndex = 0;
  let match;

  // 遍历所有数字匹配，提取之间的分割符
  while ((match = numberRegex.exec(str)) !== null) {
    const separator = str.slice(lastIndex, match.index);
    if (separator) {
      separators.push(separator);
    }
    lastIndex = match.index + match[0].length;
  }

  // 添加末尾的分割符（如果有的话）
  const trailing = str.slice(lastIndex);
  if (trailing) {
    separators.push(trailing);
  }

  // 如果没有找到任何数字，整个字符串都是分割符
  if (separators.length === 0 && !str.match(numberRegex)) {
    return [str];
  }

  return separators;
}

/**
 * 将数字数组和分割符数组拼接成完整的字符串
 * @param {number[]} numbers - 数字数组
 * @param {string[]} separators - 分割符数组
 * @param {string} [defaultSeparator=' '] - 当分割符不足时的默认分割符
 * @returns {string} 拼接后的字符串
 */
function joinNumberArray(numbers, separators, defaultSeparator = " ") {
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return "";
  }

  if (!Array.isArray(separators)) {
    separators = [];
  }

  let result = String(numbers[0]);

  for (let i = 1; i < numbers.length; i++) {
    const separator =
      separators[i - 1] !== undefined ? separators[i - 1] : defaultSeparator;
    result += separator + String(numbers[i]);
  }

  // 如果有额外的前导或尾随分割符，需要处理
  // 但通常我们只关心数字之间的分割符
  return result;
}

// 插值
const Interpolate = {
  linear: function (points, x) {
    const n = points.length;
    if (n === 0) throw new Error("No points provided");
    if (n === 1) return points[0].y;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    // x 在最左
    if (x <= xs[0]) return ys[0];
    // x 在最右
    if (x >= xs[n - 1]) return ys[n - 1];

    // 找到 x 所在区间 [x_i, x_{i+1}]
    let i = 0;
    while (i < n - 1 && x > xs[i + 1]) {
      i++;
    }

    // 线性插值公式: y = y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    const x0 = xs[i],
      x1 = xs[i + 1];
    const y0 = ys[i],
      y1 = ys[i + 1];
    const t = (x - x0) / (x1 - x0);
    return y0 + t * (y1 - y0);
  },
  cubicSpline: function (points, x) {
    const n = points.length;
    if (n < 2) throw new Error("At least 2 points required");
    if (n === 2) return singleLinear(points, x); // 退化为线性

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    // 找到 x 所在区间 [x_i, x_{i+1}]
    let i = 0;
    if (x <= xs[0]) i = 0;
    else if (x >= xs[n - 1]) i = n - 2;
    else {
      while (i < n - 1 && x > xs[i + 1]) i++;
    }

    // 构建三对角方程组 (自然样条: M0 = Mn-1 = 0)
    const h = new Array(n - 1);
    for (let j = 0; j < n - 1; j++) {
      h[j] = xs[j + 1] - xs[j];
    }

    // 构建系数矩阵（仅存储非零对角线）
    const a = new Array(n - 2).fill(0); // 下对角
    const b = new Array(n - 1).fill(0); // 主对角（M1 到 M_{n-2}）
    const c = new Array(n - 2).fill(0); // 上对角
    const d = new Array(n - 1).fill(0); // 右侧向量

    for (let j = 0; j < n - 2; j++) {
      a[j] = h[j]; // 下对角
      b[j] = 2 * (h[j] + h[j + 1]); // 主对角
      c[j] = h[j + 1]; // 上对角
      d[j] =
        6 * ((ys[j + 2] - ys[j + 1]) / h[j + 1] - (ys[j + 1] - ys[j]) / h[j]);
    }

    // 解三对角方程组（追赶法）
    const M = new Array(n).fill(0); // M[0] = M[n-1] = 0 (自然边界)
    if (n > 2) {
      // 前向消元
      for (let j = 1; j < n - 2; j++) {
        const w = a[j - 1] / b[j - 1];
        b[j] -= w * c[j - 1];
        d[j] -= w * d[j - 1];
      }
      // 回代
      M[n - 2] = d[n - 3] / b[n - 3];
      for (let j = n - 4; j >= 0; j--) {
        M[j + 1] = (d[j] - c[j] * M[j + 2]) / b[j];
      }
    }

    // 在区间 i 计算三次样条
    const dx = x - xs[i];
    const hi = h[i];
    const yi = ys[i];
    const yi1 = ys[i + 1];
    const Mi = M[i];
    const Mi1 = M[i + 1];

    const term1 = ((Mi1 - Mi) / (6 * hi)) * dx * dx * dx;
    const term2 = (Mi / 2) * dx * dx;
    const term3 = ((yi1 - yi) / hi - (hi * (Mi1 + 2 * Mi)) / 6) * dx;
    const term4 = yi;

    return term1 + term2 + term3 + term4;
  },
  catmullRom: function (points, x) {
    const n = points.length;
    if (n < 2) throw new Error("At least 2 points required");
    if (n === 2) return singleLinear(points, x);

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    // 找到 x 所在区间 [x_i, x_{i+1}]
    let i = 0;
    if (x <= xs[0]) i = 0;
    else if (x >= xs[n - 1]) i = n - 2;
    else {
      while (i < n - 1 && x > xs[i + 1]) i++;
    }

    // Catmull-Rom 需要 4 个点: P_{i-1}, P_i, P_{i+1}, P_{i+2}
    const i0 = Math.max(0, i - 1);
    const i1 = i;
    const i2 = i + 1;
    const i3 = Math.min(n - 1, i + 2);

    // 归一化 t ∈ [0, 1] 在 [x_i, x_{i+1}] 区间
    const t = (x - xs[i1]) / (xs[i2] - xs[i1]);

    // Catmull-Rom 基函数 (张力=0.5)
    const t2 = t * t;
    const t3 = t2 * t;
    const p0 = ys[i0];
    const p1 = ys[i1];
    const p2 = ys[i2];
    const p3 = ys[i3];

    // 标准 Catmull-Rom 公式
    const result =
      0.5 *
      ((-p0 + 3 * p1 - 3 * p2 + p3) * t3 +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + p2) * t +
        2 * p1);

    return result;
  },
  pchip: function (points, x) {
    const n = points.length;
    if (n < 2) throw new Error("At least 2 points required");
    if (n === 2) return singleLinear(points, x);

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    // 计算每个点的导数 (d)
    const d = new Array(n);

    // 内部点导数
    for (let i = 1; i < n - 1; i++) {
      const dxPrev = xs[i] - xs[i - 1];
      const dxNext = xs[i + 1] - xs[i];
      const dyPrev = ys[i] - ys[i - 1];
      const dyNext = ys[i + 1] - ys[i];
      const sPrev = dyPrev / dxPrev;
      const sNext = dyNext / dxNext;

      if (sPrev * sNext <= 0) {
        d[i] = 0; // 变号，设导数为0（保单调）
      } else {
        // 加权调和平均
        d[i] = (sPrev * dxNext + sNext * dxPrev) / (dxPrev + dxNext);
      }
    }

    // 边界点导数
    {
      // 左端点
      const dx0 = xs[1] - xs[0];
      const dy0 = ys[1] - ys[0];
      const s0 = dy0 / dx0;
      if (n === 2 || s0 * d[1] <= 0) {
        d[0] = 0;
      } else if (Math.abs(d[1]) < Math.abs(s0)) {
        d[0] = 2 * s0 - d[1];
      } else {
        d[0] = s0;
      }
    }
    {
      // 右端点
      const dxN = xs[n - 1] - xs[n - 2];
      const dyN = ys[n - 1] - ys[n - 2];
      const sN = dyN / dxN;
      if (n === 2 || sN * d[n - 2] <= 0) {
        d[n - 1] = 0;
      } else if (Math.abs(d[n - 2]) < Math.abs(sN)) {
        d[n - 1] = 2 * sN - d[n - 2];
      } else {
        d[n - 1] = sN;
      }
    }

    // 找到 x 所在区间
    let i = 0;
    if (x <= xs[0]) i = 0;
    else if (x >= xs[n - 1]) i = n - 2;
    else {
      while (i < n - 1 && x > xs[i + 1]) i++;
    }

    // 三次 Hermite 插值
    const x0 = xs[i],
      x1 = xs[i + 1];
    const y0 = ys[i],
      y1 = ys[i + 1];
    const d0 = d[i],
      d1 = d[i + 1];
    const dx = x1 - x0;
    const t = (x - x0) / dx;

    const h00 = (1 + 2 * t) * (1 - t) * (1 - t);
    const h10 = t * (1 - t) * (1 - t);
    const h01 = t * t * (3 - 2 * t);
    const h11 = t * t * (t - 1);

    return h00 * y0 + h10 * dx * d0 + h01 * y1 + h11 * dx * d1;
  },
  polynomial: function (points, x) {
    const n = points.length;
    if (n === 0) throw new Error("No points provided");
    if (n === 1) return points[0].y;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    let result = 0;

    // 拉格朗日插值公式:
    // L(x) = Σ [ y_i * l_i(x) ]
    // l_i(x) = Π (x - x_j) / (x_i - x_j)  for j ≠ i
    for (let i = 0; i < n; i++) {
      let li = 1;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          // 避免除零（理论上 x_i ≠ x_j）
          if (xs[i] === xs[j]) {
            throw new Error(
              "Duplicate x values not allowed in polynomial interpolation"
            );
          }
          li *= (x - xs[j]) / (xs[i] - xs[j]);
        }
      }
      result += ys[i] * li;
    }

    return result;
  },
};

function CurveChart(element) {
  let selfObj = this;
  this.elementObj = element;
  this.onResize = (ev) => {};
  this.axis = null;
  this.params = {};

  if (null == this.elementObj || undefined == this.elementObj) {
    this.elementObj = document.createElement("canvas");
  }

  /**
   * @type {CanvasRenderingContext2D}
   */
  let ctx = this.elementObj.getContext("2d");

  // 获取设备像素比
  const dpr = window.devicePixelRatio || 1;

  this.elementObj.width = this.elementObj.clientWidth * dpr;
  this.elementObj.height = this.elementObj.clientHeight * dpr;
  window.addEventListener("resize", (ev) => {
    this.elementObj.width = this.elementObj.clientWidth * dpr;
    this.elementObj.height = this.elementObj.clientHeight * dpr;
    this.onResize(ev);
    selfObj.fresh();
  });

  // 缩放上下文，使绘图坐标与 CSS 像素一致
  ctx.scale(dpr, dpr);

  // 画面元素
  let actElems = new Set();
  let chartElems = {
    IndicatorLine: {
      trigger: (down, x, y) => {
        ctx.strokeStyle = getCSSVar("--vscode-button-background");
        ctx.setLineDash([6, 4]);
        ctx.lineCap = "round";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ctx.canvas.height);
        ctx.stroke();
      },
      valid: () => true,
    },
    Axis: function (valArr, params) {
      this.params = Object.assign(
        {
          self: this,
          valArr: valArr,
          x: 20, // 绘制偏移x
          y: 20, // 绘制偏移y
          width: ctx.canvas.width - 40, // 绘制宽度
          height: ctx.canvas.height - 40, // 绘制高度
          xSpace: 20 * dpr, // 每个值间距
          ySpaceMin: 20 * dpr, // 每个值间距
          ratio: 5, // 多少像素代表单位值
          yBase: -125, // 纵坐标基线代表的值
          xBase: -5, // 横坐标基线代表的值
          interpolate: Interpolate.cubicSpline,
          interTimes: 10, // 插值次数
          fittingMode: false, //拟合模式
          fittingPoints: [],
          decimalNum: 0, // 小数位数
          minVal: -100, // 最小值
          maxVal: 100, // 最大值
          onVauleChanged: (idx, val) => {
            console.log(`point ${idx} = ${val}`);
          },
        },
        params
      );
      this.status = {
        yTagWidth: 0,
        fittingCurve: null,
        mousedown: false,
        downed: false,
        downX: 0,
        downY: 0,
        oriParams: {},
      };

      function ValuePoint(params) {
        this.params = Object.assign(
          {
            pParams: null,
            index: 0,
            onVauleChanged: (idx, val) => {},
            radius: 3,
          },
          params
        );
        this.status = {
          mousedown: false,
          downed: false,
          downX: 0,
          downY: 0,
          // oriVal: 0,
          oriParams: {},
        };

        this.trigger = (down, x, y) => {
          const pointX = this.params.pParams.self.calcIdx2X(this.params.index);
          const pointY = this.params.pParams.self.calcVal2y(
            this.params.pParams.valArr[this.params.index]
          );
          // if (
          //   this.params.x > this.params.pParams.x + this.params.pParams.width ||
          //   this.params.x < this.params.pParams.x ||
          //   this.params.y >
          //     this.params.pParams.y + this.params.pParams.height ||
          //   this.params.y < this.params.pParams.y
          // ) {
          //   return false;
          // }
          ctx.fillStyle = getCSSVar("--vscode-button-background");
          ctx.beginPath();
          ctx.arc(pointX, pointY, this.params.radius * dpr, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.fill();
          const pointInPath = ctx.isPointInPath(x, y);

          // 值标签
          if (pointInPath || this.status.mousedown) {
            ctx.fillStyle = getCSSVar("--vscode-editorWidget-background");
            ctx.font = "12px non-serif";
            ctx.textAlign = "left";
            ctx.textBaseline = "bottom";
            const text = Number(
              this.params.pParams.valArr[this.params.index]
            ).toFixed(this.params.pParams.decimalNum);
            const textMeasure = ctx.measureText(text);
            const textHeight =
              textMeasure.actualBoundingBoxAscent +
              textMeasure.actualBoundingBoxDescent;
            const textWidth = textMeasure.width;
            ctx.roundRect(
              pointX + this.params.radius * 2 - 3,
              pointY - this.params.radius * 2 - textHeight - 3,
              textWidth + 6,
              textHeight + 6,
              this.params.radius
            );
            ctx.fill();
            ctx.fillStyle = getCSSVar("--vscode-foreground");
            ctx.fillText(
              text,
              pointX + this.params.radius * 2,
              pointY - this.params.radius * 2
            );
          }

          if (down && !this.status.downed && !this.params.pParams.fittingMode) {
            this.status.downed = true;
            this.status.downX = x;
            this.status.downY = y;
            if (pointInPath) {
              this.status.mousedown = true;
              this.status.oriParams = Object.assign({}, this.params);
              // this.status.oriVal =
              //   this.params.pParams.valArr[this.params.index];
            }
          }
          if (!down) {
            this.status.downed = false;
          }
          if (this.status.mousedown) {
            // let dy = (this.status.downY - y) / dpr / this.params.pParams.ratio;
            // this.params.pParams.valArr[this.params.index] =
            //   this.status.oriVal + dy;
            let val = this.params.pParams.self.calcY2Val(y);

            val = this.params.pParams.self.valueLimit(val);
            this.params.pParams.valArr[this.params.index] = val;

            this.params.radius = this.status.oriParams.radius * 1.25;
            this.params.onVauleChanged(
              this.params.index,
              this.params.pParams.valArr[this.params.index]
            );
          }
          if (!down && this.status.mousedown) {
            this.status.mousedown = false;
            this.params.radius = this.status.oriParams.radius;
          }
        };
        this.valid = () => {
          return true;
        };
      }

      function ControlPoint(params) {
        this.params = Object.assign(
          {
            pParams: null,
            index: 0,
            val: 0,
            radius: 3,
            fixed: false,
          },
          params
        );
        this.status = {
          mousedown: false,
          downed: false,
          downX: 0,
          downY: 0,
          oriParams: {},
        };

        this.trigger = (down, x, y) => {
          const pointX = this.params.pParams.self.calcIdx2X(this.params.index);
          const pointY = this.params.pParams.self.calcVal2y(this.params.val);
          let ret = false;
          ctx.fillStyle = getCSSVar("--vscode-editorWarning-foreground");
          ctx.beginPath();
          ctx.arc(pointX, pointY, this.params.radius * dpr, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.fill();

          const pointInPath = ctx.isPointInPath(x, y);
          ret = pointInPath;
          if (down && !this.status.downed) {
            this.status.downed = true;
            this.status.downX = x;
            this.status.downY = y;
            if (pointInPath) {
              this.status.mousedown = true;
              this.status.oriParams = Object.assign({}, this.params);
            }
          }
          if (!down) {
            this.status.downed = false;
          }
          if (this.status.mousedown) {
            this.params.index = this.params.pParams.self.calcX2Idx(x);
            this.params.val = this.params.pParams.self.calcY2Val(y);
            this.params.radius = this.status.oriParams.radius * 1.25;
            ret = true;
          }
          if (!down && this.status.mousedown) {
            this.status.mousedown = false;
            this.params.radius = this.status.oriParams.radius;
          }
          return ret;
        };
        this.valid = () => {
          return true;
        };
      }

      function FittingCurve(params) {
        this.params = Object.assign(
          {
            pParams: null,
            interpolate: Interpolate.cubicSpline,
          },
          params
        );
        this.status = {
          mousedown: false,
          downed: false,
          downX: 0,
          downY: 0,
          oriParams: {},
          pointCreated: false,
        };

        this.trigger = (down, x, y) => {
          if (this.params.pParams.fittingPoints.length) {
            ctx.save();
            ctx.strokeStyle = getCSSVar("--vscode-editorWidget-background");
            ctx.lineWidth = 2 * dpr;
            this.params.pParams.self.drawCurve(
              this.params.pParams.fittingPoints,
              this.params.interpolate
            );
            const curveY = this.params.interpolate(
              this.params.pParams.fittingPoints,
              x
            );
            const pointOnCurve = ctx.isPointInStroke(x, y);
            // Math.abs(curveY - y) <= ctx.lineWidth &&
            // x >= this.params.pParams.fittingPoints[0].x &&
            // x <=
            //   this.params.pParams.fittingPoints[
            //     this.params.pParams.fittingPoints.length - 1
            //   ].x;
            let trd = false;
            for (let i of this.params.pParams.fittingPoints) {
              ctx.save();
              if (i.trigger(down, x, y)) trd = true;
              ctx.restore();
            }

            if (pointOnCurve && !trd) {
              ctx.lineWidth = dpr;
              ctx.beginPath();
              ctx.arc(x, curveY, 3 * dpr, 0, 2 * Math.PI);
              ctx.closePath();
              ctx.stroke();
            }
            if (down && !this.status.downed && !trd) {
              this.status.downed = true;
              this.status.downX = x;
              this.status.downY = y;
              if (pointOnCurve) {
                this.status.mousedown = true;
                this.status.oriParams = Object.assign({}, this.params);
                this.status.pointCreated = false;
              }
            }
            if (!down) {
              this.status.downed = false;
            }
            if (this.status.mousedown) {
              this.params.index = this.params.pParams.self.calcX2Idx(x);
              this.params.val = this.params.pParams.self.calcY2Val(y);
              this.params.radius = this.status.oriParams.radius * 1.25;

              if (!this.status.pointCreated) {
                let newPoint = new ControlPoint({
                  pParams: this.params.pParams,
                  index: this.params.pParams.self.calcX2Idx(x),
                  val: this.params.pParams.self.calcY2Val(curveY),
                  fixed: false,
                });
                newPoint.status.mousedown = true;
                newPoint.status.downed = true;
                newPoint.status.downX = x;
                newPoint.status.downY = curveY;
                newPoint.status.oriParams = Object.assign({}, newPoint.params);
                this.params.pParams.fittingPoints.push(newPoint);
                console.log(newPoint);
                console.log(this.params.pParams.fittingPoints);
                this.status.pointCreated = true;
              }
            }
            if (!down && this.status.mousedown) {
              this.status.mousedown = false;
              this.params.radius = this.status.oriParams.radius;
            }

            ctx.restore();
          }
        };
        this.valid = () => {
          return true;
        };
      }

      let points = [];
      for (let i in valArr) {
        points.push(
          new ValuePoint({
            pParams: this.params,
            index: Number(i),
            onVauleChanged: this.params.onVauleChanged,
          })
        );
      }

      this.calcY2Val = (y) => {
        return (
          (this.params.y + this.params.height - y) / (this.params.ratio * dpr) +
          this.params.yBase
        );
      };
      this.calcVal2y = (val) => {
        return (
          this.params.y +
          this.params.height -
          (val - this.params.yBase) * this.params.ratio * dpr
        );
      };
      this.calcIdx2X = (idx) => {
        return (
          this.params.x +
          this.status.yTagWidth +
          (idx * this.params.xSpace - this.params.xBase)
        );
      };
      this.calcX2Idx = (x) => {
        return (
          (x - this.params.x - this.status.yTagWidth + this.params.xBase) /
          this.params.xSpace
        );
      };
      this.xIsInAxisDisplay = (x, tolerance) => {
        return (
          x <= this.params.x + this.params.width + tolerance &&
          x >= this.params.x - tolerance
        );
      };
      this.drawCurve = (pts, interpolate) => {
        if (pts.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 0; i <= pts.length * this.params.interTimes; i++) {
            let dx =
              pts[0].x +
              (pts[pts.length - 1].x - pts[0].x) *
                (i / (pts.length * this.params.interTimes));
            ctx.lineTo(dx, interpolate(pts, dx));
          }
          ctx.stroke();
        }
      };

      this.applyFitting = () => {
        if (this.params.fittingMode && this.status.fittingCurve) {
          const interpolate = this.status.fittingCurve.params.interpolate;
          for (let i in this.params.valArr) {
            let val = this.calcY2Val(
              interpolate(this.params.fittingPoints, this.calcIdx2X(i))
            );

            this.params.valArr[i] = this.valueLimit(val);
          }
        }
      };

      this.valueLimit = (val) => {
        if (this.params.minVal != null && val < this.params.minVal) {
          val = this.params.minVal;
        }
        if (this.params.maxVal != null && val > this.params.maxVal) {
          val = this.params.maxVal;
        }
        val =
          Math.round(val * Math.pow(10, this.params.decimalNum)) /
          Math.pow(10, this.params.decimalNum);
        return val;
      };

      this.clearFittingCurve = () => {
        this.params.fittingPoints = [];
      };
      this.trigger = (down, x, y, ev) => {
        let curvePoints = [];
        this.status.yTagWidth = 0;
        if (points.length != this.params.valArr.length) {
          points.length = this.params.valArr.length;
          for (let i in points) {
            if (points[i] == undefined) {
              points[i] = new ValuePoint({
                pParams: this.params,
                onVauleChanged: this.params.onVauleChanged,
              });
            }
            points[i].index = Number(i);
          }
        }
        if (this.params.valArr.length) {
          this.params.fittingPoints.sort((a, b) => {
            return a.params.index - b.params.index;
          });
          // console.log(this.params.fittingPoints);
          if (this.params.fittingPoints.length < 2) {
            this.params.fittingPoints.length = 2;

            if (this.params.fittingPoints[0] == undefined) {
              this.params.fittingPoints[0] = new ControlPoint({
                pParams: this.params,
                fixed: true,
                val: this.params.valArr[0],
                index: points[0].params.index,
              });
            }
            if (this.params.fittingPoints[1] == undefined) {
              this.params.fittingPoints[1] = new ControlPoint({
                pParams: this.params,
                fixed: true,
                val: this.params.valArr[this.params.valArr.length - 1],
                index: points[points.length - 1].params.index,
              });
            }
          }

          // 移除界外点、重复点
          for (
            let i = this.params.fittingPoints.length - 1, p = 0, last = null;
            i >= 0;
            i--
          ) {
            if (this.params.fittingPoints[i].params.fixed) {
              p++;
            }
            if (p != 1 && !this.params.fittingPoints[i].params.fixed) {
              this.params.fittingPoints[i] = undefined;
              continue;
            }
            // console.log(this.params.fittingPoints[i].params.index, last);
            if (this.params.fittingPoints[i].params.index == last) {
              last = this.params.fittingPoints[i].params.index;
              this.params.fittingPoints[i] = undefined;
            } else last = this.params.fittingPoints[i].params.index;
          }
          this.params.fittingPoints = this.params.fittingPoints.filter(
            (val) => {
              return val != undefined;
            }
          );
          // console.log(this.params.fittingPoints)

          // 首尾固定点
          this.params.fittingPoints[0].params.index = points[0].params.index;
          this.params.fittingPoints[
            this.params.fittingPoints.length - 1
          ].params.index = points[points.length - 1].params.index;
        }

        ctx.save();
        const displayRect = new Path2D();
        displayRect.rect(
          this.params.x,
          this.params.y,
          this.params.width,
          this.params.height
        );
        ctx.clip(displayRect, "evenodd");
        // 标签字体
        ctx.fillStyle = getCSSVar("--vscode-editorWidget-background");
        ctx.font = "12px non-serif";

        // 横轴轴距计算，tag宽度计算
        let ySpaceVal = this.params.ySpaceMin / this.params.ratio;
        // console.log("yval", ySpaceVal);
        // 0.001 0.002 0.005 0.01 0.02 0.05 0.1 0.2 0.5 1 2 5
        let ySpaceFactor = Math.floor(Math.log10(ySpaceVal));
        // console.log("fac", ySpaceFactor);
        if (ySpaceVal <= 1 * Math.pow(10, ySpaceFactor))
          ySpaceVal = 1 * Math.pow(10, ySpaceFactor);
        else if (ySpaceVal <= 2 * Math.pow(10, ySpaceFactor))
          ySpaceVal = 2 * Math.pow(10, ySpaceFactor);
        else if (ySpaceVal <= 5 * Math.pow(10, ySpaceFactor))
          ySpaceVal = 5 * Math.pow(10, ySpaceFactor);
        else ySpaceVal = 10 * Math.pow(10, ySpaceFactor);
        // console.log("yval", ySpaceVal);
        let ySpace = ySpaceVal * this.params.ratio * dpr;
        let yStartVal = ySpaceVal * Math.floor(this.params.yBase / ySpaceVal);
        let yStart = this.calcVal2y(yStartVal);
        // console.log(yStartVal);
        for (
          let i = yStart, o = yStartVal;
          i >= 0;
          i -= ySpace, o += ySpaceVal
        ) {
          // console.log(String(o), ctx.measureText(String(o)));
          this.status.yTagWidth = Math.max(
            this.status.yTagWidth,
            ctx.measureText(String(o)).width
          );
        }

        // 横轴+标签
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        for (
          let i = yStart, o = yStartVal;
          i >= 0;
          i -= ySpace, o += ySpaceVal
        ) {
          ctx.strokeStyle = getCSSVar("--vscode-editorWidget-background");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0 + this.params.x + this.status.yTagWidth, i);
          ctx.lineTo(
            this.params.width + this.params.x + this.status.yTagWidth,
            i
          );
          ctx.stroke();
          ctx.fillText(String(o), 0 + this.params.x + this.status.yTagWidth, i);
        }

        // 最大最小值线
        ctx.save();
        ctx.lineWidth = 2;
        if (this.params.minVal != null) {
          ctx.strokeStyle = "blue";
          ctx.beginPath();
          ctx.moveTo(
            0 + this.params.x + this.status.yTagWidth,
            this.calcVal2y(this.params.minVal)
          );
          ctx.lineTo(
            this.params.width + this.params.x + this.status.yTagWidth,
            this.calcVal2y(this.params.minVal)
          );
          ctx.stroke();
        }
        if (this.params.maxVal != null) {
          ctx.strokeStyle = "red";
          ctx.beginPath();
          ctx.moveTo(
            0 + this.params.x + this.status.yTagWidth,
            this.calcVal2y(this.params.maxVal)
          );
          ctx.lineTo(
            this.params.width + this.params.x + this.status.yTagWidth,
            this.calcVal2y(this.params.maxVal)
          );
          ctx.stroke();
        }
        ctx.restore();

        // 竖轴
        const axisRect = new Path2D();
        axisRect.rect(
          this.params.x + this.status.yTagWidth,
          this.params.y,
          this.params.width - this.status.yTagWidth,
          this.params.height
        );
        ctx.clip(axisRect, "evenodd");

        for (let i of points) {
          let pointX = this.calcIdx2X(i.params.index);
          let pointY = this.calcVal2y(this.params.valArr[i.params.index]);
          i.params.x = pointX;
          i.params.y = pointY;
          if (!this.xIsInAxisDisplay(pointX, this.params.xSpace)) {
            continue;
          }

          ctx.strokeStyle = getCSSVar("--vscode-editorWidget-background");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(i.params.x, this.params.y);
          ctx.lineTo(i.params.x, this.params.y + this.params.height);
          ctx.stroke();

          curvePoints.push({ x: pointX, y: pointY });
        }
        ctx.restore();

        ctx.rect(
          this.params.x + this.status.yTagWidth,
          this.params.y,
          this.params.width - this.status.yTagWidth,
          this.params.height
        );
        ctx.clip("evenodd");

        // 曲线
        ctx.save();
        if (this.params.fittingMode) {
          ctx.globalAlpha = 0.65;
          ctx.setLineDash([8, 4]);
        }
        if (curvePoints.length) {
          ctx.save();
          ctx.strokeStyle = getCSSVar("--vscode-editorWidget-background");
          ctx.lineWidth = 2 * dpr;
          this.drawCurve(curvePoints, this.params.interpolate);
          ctx.restore();
        }

        // 点
        for (let i = points.length - 1; i >= 0; i--) {
          ctx.save();
          points[i].trigger(down, x, y);
          ctx.restore();
        }
        ctx.restore();

        // 拟合曲线
        if (this.params.fittingMode) {
          for (let i of this.params.fittingPoints) {
            i.x = this.calcIdx2X(i.params.index);
            i.y = this.calcVal2y(i.params.val);
          }
          if (this.status.fittingCurve == null) {
            this.status.fittingCurve = new FittingCurve({
              pParams: this.params,
            });
          }
          this.status.fittingCurve.params.interpolate = this.params.interpolate;
          this.status.fittingCurve.trigger(down, x, y);
        }

        // 鼠标中键拖动轴
        if (down && !this.status.downed) {
          this.status.downed = true;
          this.status.downX = x;
          this.status.downY = y;
          if (ctx.isPointInPath(axisRect, x, y) && ev.button == 1) {
            this.status.mousedown = true;
            this.status.oriParams = Object.assign({}, this.params);
          }
        }
        if (!down) {
          this.status.downed = false;
        }
        if (this.status.mousedown) {
          const dx = x - this.status.downX;
          const dy = y - this.status.downY;
          const xBase = this.status.oriParams.xBase - dx;
          const yBase =
            this.status.oriParams.yBase + dy / this.params.ratio / dpr;
          const tolerance = this.params.xSpace * 4;
          if (
            xBase >= -tolerance &&
            xBase <=
              this.params.valArr.length * this.params.xSpace +
                tolerance -
                this.params.width
          ) {
            this.params.xBase = this.status.oriParams.xBase - dx;
          }
          this.params.yBase = yBase;
        }
        if (!down && this.status.mousedown) {
          this.status.mousedown = false;
          this.params.radius = this.status.oriParams.radius;
        }
      };
      this.valid = () => {
        return true;
      };
    },
  };
  actElems.add(chartElems.IndicatorLine);

  this.applyParams = (params) => {
    Object.assign(this.params, params);
    if (this.axis != null) {
      Object.assign(this.axis.params, this.params);
    }
    this.fresh();
  };

  this.applyFitting = () => {
    if (this.axis != null) {
      this.axis.applyFitting();
    }
    this.fresh();
  };

  this.clearFittingCurve = () => {
    if (this.axis != null) {
      this.axis.clearFittingCurve();
    }
    this.fresh();
  };

  this.setRatio = (rt) => {
    if (this.axis != null) {
      const yMid = this.axis.calcY2Val(
        this.axis.params.y + this.axis.params.height / 2
      );
      this.params.ratio = rt;
      this.axis.params.ratio = rt;
      this.moveToMiddle(yMid);
    }
  };

  this.moveToMiddle = (val) => {
    if (this.axis != null) {
      const yBase =
        val - this.axis.params.height / 2 / this.axis.params.ratio / dpr;
      this.axis.params.yBase = yBase;
    }
    this.fresh();
  };

  this.getArrayMin = () => {
    if (this.axis != null)
      return this.axis.params.valArr.reduce((a, b) => Math.min(a, b));
    return NaN;
  };

  this.getArrayMax = () => {
    if (this.axis != null)
      return this.axis.params.valArr.reduce((a, b) => Math.max(a, b));
    return NaN;
  };

  this.getArrayMean = () => {
    if (this.axis != null)
      return (
        this.axis.params.valArr.reduce((a, b) => a + b) /
        this.axis.params.valArr.length
      );
    return NaN;
  };

  this.getSuitableRatio = (scale) => {
    if (this.axis != null) {
      const max = this.axis.params.valArr.reduce((a, b) => Math.max(a, b));
      const min = this.axis.params.valArr.reduce((a, b) => Math.min(a, b));
      if (max == min) return 1;
      const rt = (this.axis.params.height / dpr / (max - min)) * scale;
      return rt;
    }
    return 1;
  };

  this.loadArray = function (arr) {
    if (this.axis != null) {
      actElems.delete(this.axis);
    }
    this.axis = new chartElems.Axis(arr, this.params);
    actElems.add(this.axis);
  };

  this.fresh = function (down, x, y, ev) {
    ctx.reset();
    if (actElems.size > 0) {
      let needRemove = [];
      actElems.forEach((ce) => {
        if (ce.valid()) {
          ctx.save();
          ce.trigger(down, x, y, ev);
          ctx.restore();
        } else {
          needRemove.push(ce);
        }
      });
      for (let i of needRemove) {
        actElems.delete(i);
      }
    }
  };

  this.mouseEvents = new (function () {
    this.down = false;
    this.process = (ev) => {
      // console.log(this.down, ev.offsetX, ev.offsetY);
      selfObj.fresh(this.down, ev.offsetX * dpr, ev.offsetY * dpr, ev);
    };
  })();
  this.elementObj.addEventListener("mousedown", (ev) => {
    if (!this.mouseEvents.down) {
      this.mouseEvents.down = true;
      this.mouseEvents.process(ev);
    }

    ev.preventDefault();
    const handleMouseMove = (moveEvent) => {
      if (!this.mouseEvents.down) return;
      this.mouseEvents.process(moveEvent);
    };

    const handleMouseUp = (upEvent) => {
      if (!this.mouseEvents.down) return;
      this.mouseEvents.down = false;
      this.mouseEvents.process(upEvent);

      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
  this.elementObj.addEventListener("mousemove", (ev) => {
    if (this.mouseEvents.down) return;
    this.mouseEvents.process(ev);
  });
  this.elementObj.addEventListener("contextmenu", (e) => {
    e.preventDefault(); // 阻止默认右键菜单
    // 可在这里实现自定义右键菜单
    console.log("Custom right-click at", e.clientX, e.clientY);
  });

  this.elementObj.addEventListener("click", () => {
    this.elementObj.focus();
  });
}

window.onload = () => {
  const paramArea = document.querySelector("#param-area");
  const fittingBtn = document.querySelector("#fitting-btn");
  const adjustBtn = document.querySelector("#adjust-display-btn");
  const roundBtn = document.querySelector("#round-btn");
  const fittingApplyBtn = document.querySelector("#fitting-apply-btn");
  const interpolateSelect = document.querySelector("#interpolate-select");
  const decimalNumInput = document.querySelector("#decimal-num-input");
  const ratioInput = document.querySelector("#ratio-input");
  const minValInput = document.querySelector("#min-input");
  const minValInputValid = document.querySelector("#min-input-valid");
  const maxValInput = document.querySelector("#max-input");
  const maxValInputValid = document.querySelector("#max-input-valid");
  const plusInput = document.querySelector("#plus-input");
  const plusBtn = document.querySelector("#plus-btn");
  const multiInput = document.querySelector("#multi-input");
  const multiBtn = document.querySelector("#multi-btn");
  const story = document.querySelector("#story");

  const canvas = document.querySelector("#curve-editor canvas");

  let curveChart = new CurveChart(canvas);

  curveChart.onResize = (ev) => {
    const padding = 20;
    curveChart.applyParams({
      x: padding,
      y: padding,
      width: canvas.width - padding * 2,
      height: canvas.height - padding * 2,
    });
  };

  function adjustDisplay() {
    const val = curveChart.getArrayMean();
    const ratio = curveChart.getSuitableRatio(0.5);
    ratioInput.value = ratio;
    curveChart.setRatio(ratio);
    curveChart.moveToMiddle(val);
  }
  adjustBtn.addEventListener("click", adjustDisplay);

  function storyUpdate() {
    story.sepList = extractSeparators(story.value);
    story.valArr = parseNumberArray(story.value);
    curveChart.loadArray(story.valArr);
    adjustDisplay();
    curveChart.fresh();
  }
  story.addEventListener("change", storyUpdate);
  // story.addEventListener("click", storyUpdate);

  function valueChanged(idx, val) {
    story.value = joinNumberArray(story.valArr, story.sepList);
  }

  roundBtn.addEventListener("click", (ev) => {
    if (curveChart.axis != null) {
      for (let i = 0; i < curveChart.axis.params.valArr.length; i++) {
        curveChart.axis.params.valArr[i] = curveChart.axis.valueLimit(
          curveChart.axis.params.valArr[i]
        );
      }
    }
    curveChart.fresh();
    valueChanged();
  });

  fittingBtn.addEventListener("click", (ev) => {
    if (fittingBtn.classList.toggle("button-fitting-mode")) {
      fittingApplyBtn.classList.remove("button-disable");
      curveChart.applyParams({ fittingMode: true });
    } else {
      fittingApplyBtn.classList.add("button-disable");
      if (curveChart.axis != null) {
        curveChart.applyParams({ fittingMode: false });
        curveChart.clearFittingCurve();
      }
    }
  });
  fittingApplyBtn.addEventListener("click", (ev) => {
    if (!fittingApplyBtn.classList.contains("button-disable")) {
      curveChart.applyFitting();
      fittingBtn.click();
    }
    valueChanged();
  });

  decimalNumInput.addEventListener("change", (ev) => {
    if (decimalNumInput.value > 6) {
      decimalNumInput.value = 6;
    }
    if (decimalNumInput.value < 0) {
      decimalNumInput.value = 0;
    }
    decimalNumInput.value = Number(decimalNumInput.value).toFixed(0);
    curveChart.applyParams({ decimalNum: Number(decimalNumInput.value) });
    valueChanged();
  });

  ratioInput.addEventListener("change", (ev) => {
    if (ratioInput.value < ratioInput.step) {
      ratioInput.value = ratioInput.step;
    }
    // curveChart.applyParams({ ratio: Number(ratioInput.value) });
    curveChart.setRatio(Number(ratioInput.value));
  });

  if (!minValInputValid.checked) {
    minValInput.disabled = true;
  }
  minValInputValid.addEventListener("change", (ev) => {
    if (minValInputValid.checked) {
      minValInput.disabled = false;
      if (minValInput.value.length == 0) {
        minValInput.value = "0";
      }
      curveChart.applyParams({ minVal: Number(minValInput.value) });
    } else {
      minValInput.disabled = true;
      curveChart.applyParams({ minVal: null });
    }
  });
  if (!maxValInputValid.checked) {
    maxValInput.disabled = true;
  }
  maxValInputValid.addEventListener("change", (ev) => {
    if (maxValInputValid.checked) {
      maxValInput.disabled = false;
      if (maxValInput.value.length == 0) {
        maxValInput.value = "0";
      }
      curveChart.applyParams({ maxVal: Number(maxValInput.value) });
    } else {
      maxValInput.disabled = true;
      curveChart.applyParams({ maxVal: null });
    }
  });

  minValInput.addEventListener("change", (ev) => {
    if (maxValInputValid.checked && minValInput.value > maxValInput.value) {
      minValInput.value = maxValInput.value;
    }
    if (minValInputValid.checked) {
      curveChart.applyParams({ minVal: Number(minValInput.value) });
    }
  });
  maxValInput.addEventListener("change", (ev) => {
    if (minValInputValid.checked && maxValInput.value < minValInput.value) {
      maxValInput.value = minValInput.value;
    }
    if (maxValInputValid.checked) {
      curveChart.applyParams({ maxVal: Number(maxValInput.value) });
    }
  });

  plusBtn.addEventListener("click", (ev) => {
    if (curveChart.axis != null) {
      for (let i = 0; i < curveChart.axis.params.valArr.length; i++) {
        curveChart.axis.params.valArr[i] += Number(plusInput.value);
      }
    }
    curveChart.fresh();
    valueChanged();
  });

  multiBtn.addEventListener("click", (ev) => {
    if (curveChart.axis != null) {
      for (let i = 0; i < curveChart.axis.params.valArr.length; i++) {
        curveChart.axis.params.valArr[i] *= Number(multiInput.value);
      }
    }
    curveChart.fresh();
    valueChanged();
  });

  interpolateSelect.addEventListener("change", (ev) => {
    curveChart.applyParams({
      interpolate: Interpolate[interpolateSelect.value],
    });
  });

  // 初始参数
  curveChart.applyParams({
    interpolate: Interpolate[interpolateSelect.value],
    minVal: minValInputValid.checked ? Number(minValInput.value) : null,
    maxVal: minValInputValid.checked ? Number(maxValInput.value) : null,
    decimalNum: Number(decimalNumInput.value),
    ratio: Number(ratioInput.value),
    onVauleChanged: valueChanged,
  });

  storyUpdate();

  // curveChart.loadArray([
  //   12, 34, 51, 11, -13, 14, 15, 5, 1, 50, -12, 12, 34, 51, 11, -13, 14, 15, 5,
  //   1, 50, -12, 12, 34, 51, 11,
  // ]);
  // adjustDisplay();
  // curveChart.fresh();
};
