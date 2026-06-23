/**
 * models.cjs — LibTV 模型能力映射
 *
 * 更新模型库时只需要改这个文件，不用改 libtv-cli.cjs
 * 每个模型支持的能力：
 *   minDuration / maxDuration: 支持的范围（闭区间）
 *   durations: null=自由区间，非空=枚举值
 *   supportMultiClip: Wan 2.6 多机位
 *   supportCameraMovement: Hailuo 专用镜头运动
 *   supportSound: enableSound
 *   support1080P: resolution=1080P
 */

const MODELS = {
  'Happy Horse 1.0': {
    minDuration: 3,
    maxDuration: 15,
    durations: null,              // 自由
    supportMultiClip: false,
    supportCameraMovement: false,
    supportSound: false,
    support1080P: false,
  },
  'Wan 2.6': {
    minDuration: 5,
    maxDuration: 10,
    durations: [5, 10],           // 枚举
    supportMultiClip: true,       // multiClip=1
    supportCameraMovement: false,
    supportSound: true,           // enableSound=on
    support1080P: true,
  },
  'Hailuo 2.3 Fast': {
    minDuration: 6,
    maxDuration: 10,
    durations: [6, 10],           // 枚举
    supportMultiClip: false,
    supportCameraMovement: ['拉近', '拉远', '左摇', '右摇', '仰摄', '俯摄'],
    supportSound: false,
    support1080P: true,
  },
  'Seedance 1.5 Pro': {
    minDuration: 5,
    maxDuration: 10,
    durations: [5, 10],
    supportMultiClip: false,
    supportCameraMovement: false,
    supportSound: true,
    support1080P: true,
  },
};

/** 根据场景选模型 + 调参 */
function selectModel({ duration = 5, cameraMovement, userModel }) {
  // 有镜头方向 → Hailuo
  if (cameraMovement && ['拉近', '拉远', '左摇', '右摇', '仰摄', '俯摄'].includes(cameraMovement)) {
    const m = MODELS['Hailuo 2.3 Fast'];
    let segDuration = duration;
    // 适配到最近的枚举值
    if (m.durations) {
      const sorted = [...m.durations].sort((a, b) => a - b);
      segDuration = sorted.reduce((prev, curr) =>
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
      );
    }
    return {
      model: 'Hailuo 2.3 Fast',
      modelName: 'Hailuo 2.3 Fast',
      duration: segDuration,
      params: [
        '-s', 'resolution=1080P',
        '-s', `cameraMovement=${cameraMovement}`,
      ],
    };
  }

  // 长视频（>=60s）→ Wan 2.6 多镜头
  if (duration >= 60) {
    const m = MODELS['Wan 2.6'];
    let segDuration = duration;
    if (m.durations) {
      const sorted = [...m.durations].sort((a, b) => a - b);
      segDuration = sorted.reduce((prev, curr) =>
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
      );
    }
    return {
      model: 'Wan 2.6',
      modelName: 'Wan 2.6',
      duration: segDuration,
      params: [
        '-s', 'multiClip=1',
        '-s', 'enableSound=on',
        '-s', 'resolution=1080P',
      ],
    };
  }

  // 中视频（30-59s）→ Kling 3.0 智能分镜
  if (duration >= 30) {
    return {
      model: 'Kling 3.0',
      modelName: 'Kling 3.0',
      duration,
      params: [
        '-s', 'smartStoryboard=true',
      ],
    };
  }

  // 无镜头控制 → Happy Horse（默认）
  const model = userModel || 'Happy Horse 1.0';
  const m = MODELS[model] || MODELS['Happy Horse 1.0'];
  let segDuration = Math.min(Math.max(duration || 5, m.minDuration), m.maxDuration);
  if (m.durations) {
    const sorted = [...m.durations].sort((a, b) => a - b);
    segDuration = sorted.reduce((prev, curr) =>
      Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
    );
  }
  return {
    model,
    modelName: model,
    duration: segDuration,
    params: [],
  };
}

function getModelInfo(name) {
  return MODELS[name] || null;
}

module.exports = { MODELS, selectModel, getModelInfo };
